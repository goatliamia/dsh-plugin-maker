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

/** 读当前安装的 DSH 版本（升级基线）。 */
export async function dshVersion() {
  try {
    const p = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
    const pkg = JSON.parse(await readFile(p, 'utf8'))
    return pkg.version || 'unknown'
  } catch { return 'unknown' }
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
      dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: ['@deepseek-ai/dsh-client-runtime'] } },
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
    'ℹ️ 当前 DSH 版本: ' + (await dshVersion()) + '（升级后请重跑此检查）',
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
