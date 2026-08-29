// dsh-plugin-maker host half: scaffold（生成）+ check（契约校验/发布合规/升级基线/密钥自查）+ vet/adopt（接盘改造）+ checklist（动作清单）+ impact（引用面扫描）
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { CHECKLISTS, checklistFor, visibleItems } from './checklists.mjs'
import { scanReferences } from './impact.mjs'
import { createMakerSkillProvider } from './skills.mjs'

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/

/** 解析 client 入口：exports['./client'] 可能是字符串，也可能是条件导出对象（{ types, default }）——取 default 分支。 */
function clientEntryOf(pkg) {
  const c = pkg && pkg.exports && pkg.exports['./client']
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && typeof c.default === 'string') return c.default
  return 'lib/client.js'
}

// 密钥/凭据模式：AI 生成代码常见的泄露形态（OpenAI/Anthropic 风格 key、GitHub PAT、AWS AKIA、私钥块、api_key/token 赋值）
const SECRET_PAT = 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|api[_-]?key[[:space:]]*[:=]|access[_-]?token[[:space:]]*[:=]'

/** 密钥自查：全 git 历史 grep 密钥模式 + 敏感文件追踪检查。无 git 仓库只做文件名检查。 */
function secretScan(dir) {
  const rows = []
  const isGit = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir, encoding: 'utf8' }).status === 0
  if (isGit) {
    const revs = spawnSync('git', ['rev-list', '--all'], { cwd: dir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    if (revs.status === 0 && revs.stdout.trim()) {
      const r = spawnSync('git', ['grep', '-I', '-n', '-E', SECRET_PAT, ...revs.stdout.trim().split(/\s+/)], { cwd: dir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      if (r.status === 1) rows.push('✅ 全历史无密钥模式（sk-/ghp_/AKIA/私钥/api_key/token）')
      else if (r.status === 0) rows.push('❌ 命中密钥模式——立即 revoke 并清理历史：\n' + r.stdout.split('\n').slice(0, 5).join('\n'))
      else rows.push('⚠️ 历史扫描失败: ' + String(r.stderr || '').split('\n')[0])
    } else {
      rows.push('ℹ️ 仓库无提交，跳过历史扫描')
    }
    const tracked = spawnSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
    const sensitive = String(tracked.stdout || '').split(/\r?\n/).filter((f) => /\.env|\.pem$|\.key$|credentials|settings\.ya?ml|\.sqlite|\.tgz$|\.log$/.test(f))
    rows.push(sensitive.length ? '❌ 敏感文件被追踪: ' + sensitive.slice(0, 5).join(', ') : '✅ 无 .env/密钥/credentials/日志/sqlite 被追踪')
  } else {
    rows.push('ℹ️ 无 git 仓库：只提醒——发布前确认无密钥文件被 `files` 字段打包')
  }
  return rows
}

/** 读当前安装的 DSH 版本（升级基线）。 */
async function dshVersion() {
  try {
    const p = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
    const pkg = JSON.parse(await readFile(p, 'utf8'))
    return pkg.version || 'unknown'
  } catch { return 'unknown' }
}

export const inject = ['tools']

export function apply(ctx) {
  // 自带 skill 注册（原生 ctx.skills provider）：包内 skills/plugin-wizard + skills/research 进 skill 目录，
  // 模型可调用、用户可 / 触发，GUI 原生渲染「Skill 行 → Instructions 卡片」。机会式挂载：无 skills 服务时跳过（fail-open）。
  const skills = typeof ctx.get === 'function' ? ctx.get('skills') : undefined
  if (skills && typeof skills.registerProvider === 'function') {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills')
    skills.registerProvider(() => createMakerSkillProvider({ root }))
  }

  // 动作清单：把「设计硬约束」变成「执行动作入口」——输入任务类型，返回必须执行的动作清单。
  ctx.tools.register(defineTool({
    name: 'plugin_maker_checklist',
    description: '动作清单（硬约束的执行入口）：输入任务类型（开工/改文件改代码/发版本/废文档改名语义变更/踩坑后/调查技术可行性），返回该任务必须执行的动作清单——来源=各仓库 AGENTS.md/ADR 的设计硬约束条款。开工或接手任何任务前先调用本工具拿清单，照单执行，不靠读完文档即过。',
    parameters: {
      taskType: { type: 'string', required: true, description: '任务类型关键词，如 发版本 / 改文件 / 废文档 / 改名 / 踩坑 / 调查 / 开工' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    presentCall(args) { return { card: 'generic', title: '查询动作清单', rawInput: String(args.taskType ?? '') } },
    presentResult(args, result) {
      if (result.isError) return undefined
      return { card: 'generic', title: '任务「' + checklistFor(String(args.taskType ?? '')).type + '」动作清单', content: result.content }
    },
    async execute(args) {
      const { type, items: fullItems } = checklistFor(String(args.taskType ?? ''))
      // 去我们化·不误伤：协作条目的可见性跟着协作件走——project_inbox（桥侧入口）/retro_learn（retro 入口）
      // 已注册就全量显示（我们自己的环境），未注册就隐藏对应〔归口〕条目（对外干净清单）。
      const hasBridge = !!(ctx.tools && typeof ctx.tools.get === 'function' && ctx.tools.get('project_inbox'))
      const hasRetro = !!(ctx.tools && typeof ctx.tools.get === 'function' && ctx.tools.get('retro_learn'))
      const items = visibleItems(fullItems, { hasBridge, hasRetro })
      const hidden = fullItems.length - items.length
      const catalog = Object.entries(CHECKLISTS).map(([key, list]) => key + '（' + list.length + ' 条）').join('、')
      const hiddenNote = hidden > 0 ? '\n（已隐藏 ' + hidden + ' 条协作条目：未检测到 project-context-bridge/dsh-retro；装上后自动出现）' : ''
      return '任务「' + type + '」动作清单（' + items.length + ' 条，照单执行）:\n  ' + items.join('\n  ') + hiddenNote + '\n\n可用任务类型: ' + catalog
    },
  }))

  // 引用面扫描：废文档/改名/语义变更前的「查引用面」动作入口（不靠 grep 自觉）。
  ctx.tools.register(defineTool({
    name: 'plugin_maker_impact',
    description: '引用面扫描（硬约束的执行端）：输入要删/改的文件名或关键词，扫描本机 Documents 工作区（根层 + plugins/ 各仓库源码，排除 node_modules/.git/tgz），输出引用清单（文件:行号:内容）。废文档/改名/语义变更前必调，逐处更新引用——这是 checklist「废文档」三步的第二步。',
    parameters: {
      keyword: { type: 'string', required: true, description: '文件名或关键词，如 REQUIREMENTS.md / dsh-project-react / CONVENTIONS' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    presentCall(args) { return { card: 'generic', title: '扫描引用面', rawInput: String(args.keyword ?? '') } },
    presentResult(args, result) {
      if (result.isError) return undefined
      return { card: 'generic', title: '「' + String(args.keyword ?? '').trim() + '」引用面', content: result.content }
    },
    async execute(args) {
      const keyword = String(args.keyword ?? '').trim()
      if (!keyword) return 'keyword 必填：要删/改的文件名或关键词'
      const home = os.homedir()
      const roots = [
        path.join(home, 'Documents'),
        ...(await readdir(path.join(home, 'Documents', 'plugins')).catch(() => [])).map((name) => path.join(home, 'Documents', 'plugins', name)),
      ]
      const hits = await scanReferences(keyword, { roots })
      if (!hits.length) return '引用面干净：工作区内未发现「' + keyword + '」的引用。'
      const lines = hits.map((hit) => hit.file.replace(home + path.sep, '') + ':' + hit.line + '  ' + hit.text)
      return '「' + keyword + '」引用面 ' + hits.length + ' 处（超过 60 处截断）:\n  ' + lines.join('\n  ') + '\n\n下一步: 逐处更新引用 → change 信号投递受影响方。'
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plugin_maker_scaffold',
    description: '为一个 DSH 插件需求生成合规的最小可运行骨架（package.json 的 dsh bundle 字段 / cordis.patch.yml / lib/index.js host ESM / lib/client.js 自注册 / README.md）。用法：name 小写 kebab-case、description、targetDir 绝对路径（建议放在 projects 下）。生成后建议跑 plugin_maker_check 校验，再 pnpm pack + dsh plugin add 安装。',
    parameters: {
      name: { type: 'string', required: true, description: '插件名，小写 kebab-case，如 dsh-my-plugin' },
      description: { type: 'string', required: true, description: '插件一句话说明' },
      targetDir: { type: 'string', required: true, description: '生成目录的绝对路径（不存在则创建）' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    presentCall(args) { return { card: 'generic', title: '生成插件骨架', rawInput: String(args.name ?? '') } },
    presentResult(args, result) {
      if (result.isError) return undefined
      return { card: 'generic', title: '骨架已生成：' + String(args.name ?? '').trim(), content: result.content }
    },
    async execute(args) {
      const name = String(args.name ?? '').trim()
      if (!NAME_RE.test(name)) return '无效插件名: 需小写字母数字与连字符，不以连字符开头'
      const dir = String(args.targetDir ?? '').trim()
      if (!path.isAbsolute(dir)) return 'targetDir 必须是绝对路径'
      const description = String(args.description ?? '').trim()
      const ver = await dshVersion()
      const files = {
        'package.json': JSON.stringify({
          name, version: '0.1.0', description,
          type: 'module', main: 'lib/index.js',
          exports: { '.': './lib/index.js', './client': './lib/client.js', './package.json': './package.json' },
          files: ['lib', 'cordis.patch.yml', 'README.md'], license: 'MIT',
          keywords: ['dsh-plugin', 'deepseek-harness'],
          repository: { type: 'git', url: 'git+https://github.com/YOUR_GITHUB_USERNAME/' + name + '.git' },
          engines: { node: '>=18' },
          dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: ['@deepseek-ai/dsh-client-runtime'] } },
        }, null, 2) + '\n',
        'cordis.patch.yml': '- insert:\n    - id: ' + name + '\n      name: ' + name + '\n',
        'lib/index.js': '// ' + name + ' host half (ESM)\nexport const inject = []\nexport function apply(ctx) {}\n',
        'lib/client.js': '// ' + name + ' client half (self-registering bundle)\nwindow.__ModuleLoader__.load({\n  id: ' + JSON.stringify(name) + ',\n  factory: () => ({ inject: [], apply(ctx) {} })\n})\n',
        'README.md': '# ' + name + '\n\n' + description + '\n\n生成自 plugin-maker scaffold（DSH ' + ver + '）。\n安装: pnpm pack && dsh plugin --profile web add file:<绝对路径>.tgz，重启 DSH 生效。\n',
      }
      await mkdir(path.join(dir, 'lib'), { recursive: true })
      const written = []
      for (const [rel, content] of Object.entries(files)) {
        await writeFile(path.join(dir, rel), content, 'utf8')
        written.push(rel)
      }
      return '已生成合规骨架到 ' + dir + '（基线 DSH ' + ver + '）:\n  ' + written.join('\n  ') + '\n\n下一步: 1) plugin_maker_check 校验 2) pnpm pack 3) 先 --profile scratch 单独验证（boot 起临时 profile，确认不崩） 4) 验证过再 --profile web add 装主 profile 5) 出问题 dsh plugin remove <name> 一键禁用 6) 升级 DSH 后逐个重跑 plugin_maker_check。'
    },
  }))

  // 契约校验 + 发布合规 + 升级基线：只读静态检查，不影响任何运行
  ctx.tools.register(defineTool({
    name: 'plugin_maker_check',
    description: '契约校验+发布合规+升级基线：静态检查一个 DSH 插件目录（package.json/cordis.patch.yml/lib）是否符合官方契约与发布清单，并报告当前 DSH 版本。只读，不影响运行。',
    parameters: {
      targetDir: { type: 'string', required: true, description: '插件目录绝对路径' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    presentCall(args) { return { card: 'generic', title: '插件检查', rawInput: String(args.targetDir ?? '') } },
    presentResult(args, result) {
      if (result.isError) return undefined
      return { card: 'generic', title: '插件检查：' + path.basename(String(args.targetDir ?? '')), content: result.content }
    },
    async execute(args) {
      const dir = String(args.targetDir ?? '').trim()
      if (!path.isAbsolute(dir)) return 'targetDir 必须是绝对路径'
      const ok = (c) => (c ? '✅' : '❌')
      const read = async (rel) => { try { return await readFile(path.join(dir, rel), 'utf8') } catch { return null } }
      const pkgText = await read('package.json')
      let pkg = null
      if (pkgText) { try { pkg = JSON.parse(pkgText) } catch {} }
      // 入口按 package.json 解析，不写死 lib/（入口可能在根目录，或经 export * 转发到 src/）。
      const hostEntry = (pkg && pkg.main) || 'lib/index.js'
      const clientEntry = clientEntryOf(pkg)
      const patch = await read('cordis.patch.yml')
      const client = await read(clientEntry)
      const host = await read(hostEntry)
      // 兜底扫描 src/ 文本（覆盖 export * 转发入口）。
      let srcText = ''
      const walk = async (rel, budget) => {
        let entries
        try { entries = await readdir(path.join(dir, rel), { withFileTypes: true }) } catch { return }
        for (const e of entries) {
          if (budget.n <= 0) return
          const p = path.join(rel, e.name)
          if (e.isDirectory()) await walk(p, budget)
          else if (/\.(mjs|js|cjs)$/.test(e.name)) {
            budget.n -= 1
            const t = await read(p)
            if (t) srcText += '\n' + t
          }
        }
      }
      await walk('src', { n: 120 })
      const hostAll = (host || '') + srcText
      const clientAll = (client || '') + srcText
      const all = [pkgText, patch, hostAll, clientAll].filter(Boolean).join('\n')
      // dsh.client 声明形状校验（实测：dsh-client-modules parseDshClient——platform 必须字符串、
      // inject/external 必须字符串数组、immediately 布尔；违规=启动响亮失败）
      const dshClient = pkg && pkg.dsh && typeof pkg.dsh === 'object' ? pkg.dsh.client : undefined
      const declaresClient = dshClient !== undefined
      const strArr = (v) => v === undefined || (Array.isArray(v) && v.every((s) => typeof s === 'string'))
      const dshClientOk = !declaresClient || (dshClient !== null && typeof dshClient === 'object'
        && typeof dshClient.platform === 'string'
        && strArr(dshClient.inject) && strArr(dshClient.external)
        && (dshClient.immediately === undefined || typeof dshClient.immediately === 'boolean'))
      const clientExport = pkg && pkg.exports && typeof pkg.exports === 'object' ? pkg.exports['./client'] : undefined
      const hasClientExport = typeof clientExport === 'string' || (!!clientExport && typeof clientExport === 'object' && typeof clientExport.default === 'string')
      const rows = [
        '契约校验（⑤）:',
        ok(!!pkg && !!(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch)) + ' package.json 有 dsh.bundle.patch',
        ok(dshClientOk) + ' dsh.client 声明合规（对象 + platform 字符串 + inject/external 字符串数组）',
        ok(!declaresClient || hasClientExport) + ' 声明 dsh.client 必须 exports["./client"]（实测：client-modules 扫描器缺失即启动报错）',
        ok(!!patch && /insert:/.test(patch || '')) + ' cordis.patch.yml 有 insert 层',
        ok(/__ModuleLoader__\.load/.test(clientAll)) + ' client 自注册 __ModuleLoader__.load',
        ok(!!pkg && !!pkg.name && clientAll.includes(pkg.name)) + ' client.js 注册 id = 包名',
        ok(!!pkg && !!pkg.exports && typeof pkg.exports === 'object' && !!pkg.exports['./package.json']) + ' exports 有 ./package.json（client-modules 扫描靠 require.resolve 读它，缺失=客户端行静默不装载）',
        ok(/(export\s+function\s+apply|extends\s+Service)/.test(hostAll)) + ' host 入口有插件形态（官方三形态：export function apply / export default 对象 / extends Service；运行时对 CJS 有归一化，本行拦偏离官方写法的入口，对象形态需人工确认）',
        ok(!/ctx\.config\s*[.(\[]/.test(hostAll)) + ' host 代码绝不读 ctx.config（Cordis 服务名解析，DSH 无 config 服务，访问即抛、启动树中止——0.2.8 实机事故）；配置用 apply(ctx, config) 第二参数',
        ok(!/required:\s*false\s*[,}]/.test(all)) + ' 无 required:false（实测：dsh-tools 对 required 非 true 即 authorError）',
        ok(!/tools\/(pre-execute|post-execute|execute)['"]/.test(hostAll) || /next\s*\(/.test(hostAll)) + ' waterfall 事件监听（tools/pre-execute/post-execute/execute）必须透传 next()——实机踩过：坏监听器锁死全部工具连自救都调不了，只能重启',
        '发布合规（⑥）:',
        ok(!!pkg && !pkg.private) + ' 可发布（无 private:true）',
        ok(!!pkg && !!(pkg.repository && pkg.repository.url)) + ' 有 repository 字段',
        ok(!!pkg && Array.isArray(pkg.keywords) && pkg.keywords.includes('dsh-plugin')) + ' 有 dsh-plugin 关键词',
        ok(!!host && !!client) + ' 入口文件在（main/exports 解析）',
        '升级基线（⑦）:',
        'ℹ️ 当前 DSH 版本: ' + (await dshVersion()) + '（升级后请重跑此检查）',
        '密钥自查（⑧）:',
        ...secretScan(dir),
        '危险操作自查（自我指涉）:',
        '⚠️ 重启/杀 DSH、改 harness 源码、改/删 cordis preset、卸载自己正依赖的插件 = 自杀操作',
        '⚠️ 动手前问一句「这东西在跑我吗？」是 → 交回人类；停→启必须原子化',
      ]
      return '插件检查 ' + dir + ':\n' + rows.join('\n')
    },
  }))

  // 接盘改造：把别人的插件体检成"可照做的改造清单"（转化，不是协议）。
  ctx.tools.register(defineTool({
    name: 'plugin_maker_vet',
    description: '接盘改造体检：对任意第三方 DSH 插件目录（不一定是 maker 生成的）出可照做的改造清单——每项违规给具体改法，而不是只有对错。重点覆盖实机踩过的坑：exports 缺 ./package.json（客户端行静默消失）、client id 不匹配、入口路径怪异、required:false、发布字段缺失。只读，不修改任何文件。改完重跑 plugin_maker_check。',
    parameters: {
      targetDir: { type: 'string', required: true, description: '插件目录绝对路径' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    presentCall(args) { return { card: 'generic', title: '接盘体检', rawInput: String(args.targetDir ?? '') } },
    presentResult(args, result) {
      if (result.isError) return undefined
      return { card: 'generic', title: '接盘体检：' + path.basename(String(args.targetDir ?? '')), content: result.content }
    },
    async execute(args) {
      const dir = String(args.targetDir ?? '').trim()
      if (!path.isAbsolute(dir)) return 'targetDir 必须是绝对路径'
      const read = async (rel) => { try { return await readFile(path.join(dir, rel), 'utf8') } catch { return null } }
      const pkgText = await read('package.json')
      let pkg = null
      if (pkgText) { try { pkg = JSON.parse(pkgText) } catch {} }
      const hostEntry = (pkg && pkg.main) || 'lib/index.js'
      const clientEntry = clientEntryOf(pkg)
      const patch = await read('cordis.patch.yml')
      const client = await read(clientEntry)
      const host = await read(hostEntry)
      let srcText = ''
      const walk = async (rel, budget) => {
        let entries
        try { entries = await readdir(path.join(dir, rel), { withFileTypes: true }) } catch { return }
        for (const e of entries) {
          if (budget.n <= 0) return
          const p = path.join(rel, e.name)
          if (e.isDirectory()) await walk(p, budget)
          else if (/\.(mjs|js|cjs)$/.test(e.name)) { budget.n -= 1; const t = await read(p); if (t) srcText += '\n' + t }
        }
      }
      await walk('src', { n: 120 })
      const hostAll = (host || '') + srcText
      const clientAll = (client || '') + srcText
      const fixes = []
      const fix = (title, how) => fixes.push('- 【' + title + '】\n   改法：' + how)
      if (!pkg) fix('package.json 读不出来或非法 JSON', '先修 JSON 语法（文件工具改，别用 PowerShell 序列化）')
      else {
        if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.bundle.patch) fix('缺 dsh.bundle.patch', 'package.json 加 "dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] } }')
        if (!pkg.exports || typeof pkg.exports !== 'object' || !pkg.exports['./package.json']) fix('exports 缺 ./package.json（实机坑：client-modules 扫描靠 require.resolve 读它，缺失=客户端行静默不装载，host 却正常）', 'exports 加 "./package.json": "./package.json"')
        if (!pkg.exports || typeof pkg.exports !== 'object' || !pkg.exports['./client']) fix('exports 缺 ./client 子路径', 'exports 加 "./client": "' + clientEntry + '"（指向真实 client bundle 文件）')
        if (pkg.dsh && pkg.dsh.client !== undefined && (pkg.dsh.client === null || typeof pkg.dsh.client !== 'object' || typeof pkg.dsh.client.platform !== 'string')) fix('dsh.client 声明形状非法', 'package.json 的 dsh.client 必须是对象且 platform 为字符串：\n    "dsh": { "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] } }\n  （实测：client-modules 扫描器 parseDshClient 违规=启动响亮报错）')
        if (pkg.private) fix('private:true', '本地用没关系；要发布到 npm/市场就去掉 private，再补 repository 和 keywords')
        if (!pkg.repository || !pkg.repository.url) fix('缺 repository 字段', '加 "repository": { "type": "git", "url": "git+https://github.com/<you>/' + (pkg.name || '插件名') + '.git" }')
        if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes('dsh-plugin')) fix('keywords 缺 dsh-plugin', '加 "keywords": ["dsh-plugin", "deepseek-harness"]')
      }
      if (!patch || !/insert:/.test(patch || '')) fix('cordis.patch.yml 缺 insert 层', '文件内容应为：\n   - insert:\n       - id: ' + (pkg && pkg.name ? pkg.name : '<包名>') + '\n         name: ' + (pkg && pkg.name ? pkg.name : '<包名>'))
      if (!/__ModuleLoader__\.load/.test(clientAll)) fix('client 不自注册', 'client 文件里加：\n   window.__ModuleLoader__.load({\n     id: ' + JSON.stringify(pkg && pkg.name ? pkg.name : '<包名>') + ',\n     factory: (require) => { ... 返回 { inject, apply } ... }\n   })')
      else if (pkg && pkg.name && !clientAll.includes(pkg.name)) fix('client 注册 id ≠ 包名（实机坑：改名漏改会崩整个实例）', '把注册 id 改成与包名一致：' + pkg.name)
      if (!/(export\s+function\s+apply|extends\s+Service)/.test(hostAll)) fix('host 入口没有插件形态', '官方三形态任选其一（见官方 cordis-tutorial 01 章）：export function apply(ctx) / export default { apply } / class X extends Service（构造器 super(ctx, name)）——host 入口（' + hostEntry + '）补上，或在入口 export * 转发到真正含 apply 的模块')
      if (/required:\s*false\s*[,}]/.test([pkgText, patch, hostAll, clientAll].join('\n'))) fix('存在 required:false（实机坑：可选字段要省略 required，写 false 会在 schema 校验崩溃）', '把 required: false 删掉；只有必填字段写 required: true')
      if (!client && !host) fix('入口文件按 main/exports 找不到', '确认 package.json 的 main 与 exports["./client"] 指向真实文件')
      if (fixes.length === 0) return '接盘体检 ' + dir + '：无硬伤 ✅（再跑 plugin_maker_check 确认发布合规与升级基线）'
      return '接盘体检 ' + dir + '——' + fixes.length + ' 项改造（照着改，改完重跑 plugin_maker_check）：\n\n' + fixes.join('\n\n')
    },
  }))

  // 接盘改造·自动应用：vet 清单里的安全项直接改好（转化，不是协议）。
  ctx.tools.register(defineTool({
    name: 'plugin_maker_adopt',
    description: '接盘改造·自动应用：把 plugin_maker_vet 清单里的安全项直接改好——exports 补 ./package.json、keywords 补 dsh-plugin、client 注册 id 改成包名；其余项（repository/缺 apply/private 等）留在报告里人工处理。改完请重跑 plugin_maker_check。有 git 的目录建议先提交。',
    parameters: {
      targetDir: { type: 'string', required: true, description: '插件目录绝对路径' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    presentCall(args) { return { card: 'generic', title: '接盘改造', rawInput: String(args.targetDir ?? '') } },
    presentResult(args, result) {
      if (result.isError) return undefined
      return { card: 'generic', title: '接盘改造完成：' + path.basename(String(args.targetDir ?? '')), content: result.content }
    },
    async execute(args) {
      const dir = String(args.targetDir ?? '').trim()
      if (!path.isAbsolute(dir)) return 'targetDir 必须是绝对路径'
      const read = async (rel) => { try { return await readFile(path.join(dir, rel), 'utf8') } catch { return null } }
      const pkgText = await read('package.json')
      let pkg = null
      if (pkgText) { try { pkg = JSON.parse(pkgText) } catch {} }
      if (!pkg) return 'package.json 读不出来，先手修 JSON'
      const clientEntry = clientEntryOf(pkg)
      const client = await read(clientEntry)
      const applied = []
      const manual = []
      // 1) exports 补 ./package.json（今晚实机坑）
      if (pkg.exports && typeof pkg.exports === 'object' && !pkg.exports['./package.json']) {
        pkg.exports['./package.json'] = './package.json'
        applied.push('exports 补 "./package.json": "./package.json"')
      } else if (!pkg.exports) {
        manual.push('exports 整个缺失（需要你确认导出面，不能自动生成）')
      }
      // 2) keywords 补 dsh-plugin
      if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes('dsh-plugin')) {
        const kw = Array.isArray(pkg.keywords) ? [...pkg.keywords] : []
        if (!kw.includes('dsh-plugin')) kw.push('dsh-plugin')
        pkg.keywords = kw
        applied.push('keywords 补 "dsh-plugin"')
      }
      // 3) client 注册 id 改成包名
      let clientText = client
      if (pkg.name && clientText) {
        const m = /id\s*:\s*['"]([^'"]+)['"]/.exec(clientText)
        if (m && m[1] !== pkg.name) {
          const old = m[1]
          clientText = clientText.replaceAll("'" + old + "'", "'" + pkg.name + "'").replaceAll('"' + old + '"', '"' + pkg.name + '"')
          applied.push('client 注册 id: ' + old + ' → ' + pkg.name)
        }
      }
      // 写回
      await writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8')
      if (clientText && clientText !== client) await writeFile(path.join(dir, clientEntry), clientText, 'utf8')
      // 不能自动的
      if (!pkg.repository || !pkg.repository.url) manual.push('repository 字段（需要你的仓库 URL）')
      if (!client && !clientText) manual.push('client 入口找不到，确认 exports["./client"]')
      const head = '接盘改造完成：自动应用 ' + applied.length + ' 项，需人工 ' + manual.length + ' 项。\n\n'
      const body = applied.map((a) => '✅ ' + a).concat(manual.map((m) => '⚠️ 人工: ' + m)).join('\n')
      return head + body + '\n\n改完重跑 plugin_maker_check；建议 git 提交前先 diff 一遍。'
    },
  }))
}
