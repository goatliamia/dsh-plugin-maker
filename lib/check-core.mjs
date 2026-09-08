// dsh-plugin-maker check 核心纯函数（零 DSH 依赖，可独立测试）：
// 迁移事实扫描 / 密钥自查 / 版本读取 / check 全量校验 / scaffold 模板。
// check 工具与 scaffold「生成即验证」共用；测试直接 import 本模块，不触碰 host 入口。
import { readFile, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { MIGRATION_FACTS } from '../facts/migrations.mjs'

/** 跨版本迁移事实卡扫描（数据真源 facts/migrations.mjs）：pattern 命中 → 命中对象；数据文件 pattern 非法时跳过该条不炸 check。 */
export function migrationHits(allText) {
  const hits = []
  for (const hop of MIGRATION_FACTS) {
    for (const f of hop.facts) {
      try {
        if (new RegExp(f.pattern).test(allText)) hits.push({ hop: hop.from + '→' + hop.to, message: f.message, source: f.source, verified: !!f.verified, review: !!f.review })
      } catch { /* 跳过 */ }
    }
  }
  return hits
}

export function migrationRow(h) {
  return '⚠️ ' + h.hop + '：' + h.message + '（来源：' + h.source + (h.verified ? '，已实测' : '，社区验证·待自测') + (h.review ? '，需人工复核' : '') + '）'
}

/** 官方包名 → 上游挂点路径（实测：本地安装包 repository.directory 提取，2026-09-09 对照 dsh-v0.1.3-alpha.2 校验）。
 *  只保留当前版本上游真实存在的路径：已移除的包（dsh-host-apiproxy / dsh-client-runtime）不再给挂靠建议，
 *  否则建议指向一个不存在的路径 = 用户配了 upstream 也永远盯不到东西。 */
const PACKAGE_HOOKS = {
  '@deepseek-ai/dsh-tools': 'packages/core/tools',
  '@deepseek-ai/dsh-llm': 'packages/llm/llm',
  '@deepseek-ai/dsh-session': 'packages/core/session',
  '@deepseek-ai/dsh-subagent': 'packages/subagent/subagent',
  '@deepseek-ai/dsh-agent': 'packages/core/agent',
  '@deepseek-ai/dsh-skill': 'packages/skill/skill',
  '@deepseek-ai/dsh-system-prompt': 'packages/core/system-prompt',
  '@deepseek-ai/dsh-host-webserver': 'packages/host/webserver',
  '@deepseek-ai/dsh-settings': 'packages/settings/settings',
  '@deepseek-ai/dsh-fs': 'packages/fs/fs',
  '@deepseek-ai/dsh-storage': 'packages/storage/storage',
  '@deepseek-ai/dsh-goal': 'packages/goal/goal',
  '@deepseek-ai/dsh-workflow': 'packages/workflow/workflow',
  '@deepseek-ai/dsh-jobs': 'packages/jobs/jobs',
  '@deepseek-ai/dsh-schedule': 'packages/schedule/schedule',
  '@deepseek-ai/dsh-web': 'packages/web/web',
  '@deepseek-ai/dsh-compaction': 'packages/compaction/compaction',
  '@deepseek-ai/dsh-attachment': 'packages/attachment/attachment',
  '@deepseek-ai/dsh-brand': 'packages/util/brand',
  '@deepseek-ai/dsh-file-reference': 'packages/context/file-reference',
  // 0.1.2→0.1.3 新增的插件常用面（0.1.3-alpha.1 起 dsh-util-values 承接 dsh-llm/dsh-session 的通用值工具）
  '@deepseek-ai/dsh-util-values': 'packages/util/values',
  '@deepseek-ai/dsh-persona': 'packages/preset/persona',
  '@deepseek-ai/dsh-session-persistence': 'packages/session/session-persistence',
  '@deepseek-ai/dsh-session-format': 'packages/session/session-format',
  '@deepseek-ai/dsh-agent-tool-presentation': 'packages/core/agent-tool-presentation',
}

/** 常用 inject 服务名 → 挂点（服务名 ≠ 包名的面）。
 *  0.1.2 起 apiProxy 已移除，这里不再给挂靠建议——迁移事实卡负责提示「这个服务不存在了」。 */
const INJECT_HOOKS = {
  webServer: 'packages/host/webserver',
  sessions: 'packages/core/session',
  tools: 'packages/core/tools',
  skills: 'packages/skill/skill',
  llm: 'packages/llm/llm',
  settings: 'packages/settings/settings',
  remote: 'packages/api/remotes',
}

/** 挂靠建议（帮助形态）：扫描插件源码用到的官方协议面（包引用 + inject 服务名），映射到上游挂点路径。
 *  只建议不代写——插件作者可以把命中的路径声明进自己仓库的 upstream.json 获得自动报警。 */
export function hookSuggestions(allText) {
  const found = []
  for (const [pkg, hookPath] of Object.entries(PACKAGE_HOOKS)) {
    if (allText.includes(pkg)) found.push({ path: hookPath, used: pkg })
  }
  for (const [name, hookPath] of Object.entries(INJECT_HOOKS)) {
    if (new RegExp('inject\\s*(?:=|:|[(])\\s*\\[[^\\]]*[\'"]' + name + '[\'"]').test(allText)) found.push({ path: hookPath, used: 'inject: ' + name })
  }
  const seen = new Set()
  return found.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)))
}

/** 解析 client 入口：exports['./client'] 可能是字符串，也可能是条件导出对象（{ types, default }）——取 default 分支。 */
export function clientEntryOf(pkg) {
  const c = pkg && pkg.exports && pkg.exports['./client']
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && typeof c.default === 'string') return c.default
  return 'lib/client.js'
}

// 密钥/凭据模式：AI 生成代码常见的泄露形态（OpenAI/Anthropic 风格 key、GitHub PAT、AWS AKIA、私钥块、api_key/token 赋值）
const SECRET_PAT = 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|api[_-]?key[[:space:]]*[:=]|access[_-]?token[[:space:]]*[:=]'

/** 密钥自查：全 git 历史 grep 密钥模式 + 敏感文件追踪检查。无 git 仓库只做文件名检查。 */
export function secretScan(dir) {
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

/** 读框架依赖线版本（升级基线）：优先 import.meta.resolve 出 maker 实际链接的 dsh-tools 版本（诚实反映运行时框架线），
 *  fallback 全局 npm 的 dsh CLI 安装。2026-08-30 实测教训：只读全局 npm 会在 0.1.2 宿主上误报 0.1.1。 */
export async function dshVersion() {
  try {
    const resolved = import.meta.resolve('@deepseek-ai/dsh-tools/package.json')
    const pkg = JSON.parse(await readFile(new URL(resolved), 'utf8'))
    if (pkg.version) return pkg.version
  } catch { /* fallthrough */ }
  try {
    const p = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
    const pkg = JSON.parse(await readFile(p, 'utf8'))
    return pkg.version || 'unknown'
  } catch { return 'unknown' }
}

/** 接盘体检（纯函数）：对任意插件目录出"可照做的改造清单"。只读，不修改任何文件。
 *  与 checkPlugin 一样从 lib/index.js 抽出来——这样别的插件（或实验）可以直接复用，
 *  不必把 maker 的六个模型可见工具全挂上。 */
export async function vetPlugin(dir) {
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
    if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.bundle.patch) fix('缺 dsh.bundle.patch', 'package.json 加 "dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web", "inject": [] } }')
    if (!pkg.exports || typeof pkg.exports !== 'object' || !pkg.exports['./package.json']) fix('exports 缺 ./package.json（实机坑：client-modules 扫描靠 require.resolve 读它，缺失=客户端行静默不装载，host 却正常）', 'exports 加 "./package.json": "./package.json"')
    if (!pkg.exports || typeof pkg.exports !== 'object' || !pkg.exports['./client']) fix('exports 缺 ./client 子路径', 'exports 加 "./client": "' + clientEntry + '"（指向真实 client bundle 文件）')
    if (pkg.dsh && pkg.dsh.client !== undefined && (pkg.dsh.client === null || typeof pkg.dsh.client !== 'object' || typeof pkg.dsh.client.platform !== 'string')) fix('dsh.client 声明形状非法', 'package.json 的 dsh.client 必须是对象且 platform 为字符串：\n    "dsh": { "client": { "platform": "web", "inject": [] } }\n  （实测：client-modules 扫描器 parseDshClient 违规=启动响亮报错）')
    if (pkg.private) fix('private:true', '本地用没关系；要发布到 npm/市场就去掉 private，再补 repository 和 keywords')
    if (!pkg.repository || !pkg.repository.url) fix('缺 repository 字段', '加 "repository": { "type": "git", "url": "git+https://github.com/<you>/' + (pkg.name || '插件名') + '.git" }')
    if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes('dsh-plugin')) fix('keywords 缺 dsh-plugin', '加 "keywords": ["dsh-plugin", "deepseek-harness"]')
  }
  if (!patch || !/insert:/.test(patch || '')) fix('cordis.patch.yml 缺 insert 层', '文件内容应为：\n   - insert:\n       - id: ' + (pkg && pkg.name ? pkg.name : '<包名>') + '\n         name: ' + (pkg && pkg.name ? pkg.name : '<包名>'))
  if (!/__ModuleLoader__\.load/.test(clientAll)) fix('client 不自注册', 'client 文件里加：\n   window.__ModuleLoader__.load({\n     id: ' + JSON.stringify(pkg && pkg.name ? pkg.name : '<包名>') + ',\n     factory: (require) => { ... 返回 { inject, apply } ... }\n   })')
  else if (pkg && pkg.name && !clientAll.includes(pkg.name)) fix('client 注册 id ≠ 包名（实机坑：改名漏改会崩整个实例）', '把注册 id 改成与包名一致：' + pkg.name)
  if (!/(export\s+function\s+apply|extends\s+Service)/.test(hostAll)) fix('host 入口没有插件形态', '官方三形态任选其一（见官方 cordis-tutorial 01 章）：export function apply(ctx) / export default { apply } / class X extends Service（构造器 super(ctx, name)）——host 入口（' + hostEntry + '）补上，或在入口 export * 转发到真正含 apply 的模块')
  if (/required:\s*false\s*[,}]/.test([pkgText, patch, hostAll, clientAll].join('\n'))) fix('存在 required:false（实机坑：可选字段要省略 required，写 false 会在 schema 校验崩溃）', '把 required: false 删掉；只有必填字段写 required: true')
  for (const h of migrationHits([pkgText, patch, hostAll, clientAll].join('\n'))) fix('跨版本迁移事实命中（' + h.hop + '）', h.message + '（来源：' + h.source + (h.verified ? '，已实测' : '，社区验证·待自测') + (h.review ? '，需人工复核' : '') + '）')
  if (!client && !host) fix('入口文件按 main/exports 找不到', '确认 package.json 的 main 与 exports["./client"] 指向真实文件')
  const hooks = hookSuggestions([hostAll, clientAll, pkgText].join('\n'))
  const hookSection = hooks.length ? '\n\n挂靠建议（可选·帮助形态，不代写）:\n' + hooks.map((h) => '  - 挂点 `' + h.path + '` ← 使用了 `' + h.used + '`').join('\n') + '\n    把命中的路径声明进自己仓库的 upstream.json（挂点格式与 watch 脚本见 maker 仓库 docs/upstream-watch.md），上游变化即自动报警。' : ''
  if (fixes.length === 0) return '接盘体检 ' + dir + '：无硬伤 ✅（再跑 plugin_maker_check 确认发布合规与升级基线）' + hookSection
  return '接盘体检 ' + dir + '——' + fixes.length + ' 项改造（照着改，改完重跑 plugin_maker_check）：\n\n' + fixes.join('\n\n') + hookSection
}

/** scaffold 模板（纯数据+纯函数：check 工具与生成即验证共用，测试可直接调用）。 */
export function scaffoldFiles(name, description, ver) {
  return {
    'package.json': JSON.stringify({
      name, version: '0.1.0', description,
      type: 'module', main: 'lib/index.js',
      exports: { '.': './lib/index.js', './client': './lib/client.js', './package.json': './package.json' },
      files: ['lib', 'cordis.patch.yml', 'README.md'], license: 'MIT',
      keywords: ['dsh-plugin', 'deepseek-harness'],
      repository: { type: 'git', url: 'git+https://github.com/YOUR_GITHUB_USERNAME/' + name + '.git' },
      engines: { node: '>=18' },
      dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: [] } },
    }, null, 2) + '\n',
    'cordis.patch.yml': '- insert:\n    - id: ' + name + '\n      name: ' + name + '\n',
    'lib/index.js': '// ' + name + ' host half (ESM)\nexport const inject = []\nexport function apply(ctx) {}\n',
    'lib/client.js': '// ' + name + ' client half (self-registering bundle)\nwindow.__ModuleLoader__.load({\n  id: ' + JSON.stringify(name) + ',\n  factory: () => ({ inject: [], apply(ctx) {} })\n})\n',
    'README.md': '# ' + name + '\n\n' + description + '\n\n生成自 plugin-maker scaffold（DSH ' + ver + '）。\n安装: pnpm pack && dsh plugin --profile web add file:<绝对路径>.tgz，重启 DSH 生效。\n',
  }
}

/** check 全量校验（纯函数：只读目标目录，不依赖 ctx，供 check 工具与 scaffold 生成即验证共用）。 */
export async function checkPlugin(dir) {
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
  const migHits = migrationHits(all)
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
    'ℹ️ 框架依赖线（dsh-tools 解析版本）: ' + (await dshVersion()) + '（升级后请重跑此检查）',
    '跨版本迁移事实卡（⑧）:',
    ...(migHits.length ? migHits.map(migrationRow) : ['✅ 未命中已登记的迁移事实（' + MIGRATION_FACTS.length + ' 段版本事实常驻扫描，数据真源 facts/migrations.mjs）']),
    '密钥自查（⑨）:',
    ...secretScan(dir),
    '危险操作自查（自我指涉）:',
    '⚠️ 重启/杀 DSH、改 harness 源码、改/删 cordis preset、卸载自己正依赖的插件 = 自杀操作',
    '⚠️ 动手前问一句「这东西在跑我吗？」是 → 交回人类；停→启必须原子化',
  ]
  return '插件检查 ' + dir + ':\n' + rows.join('\n')
}
