#!/usr/bin/env node
// upstream-watch — 上游 tag 盯梢：挂点声明(upstream.json) → tag 差 → 命中报告 → (--apply) 开 issue + 更新 pinned。
//
// 用法（Node >= 18，零依赖）:
//   node scripts/upstream-watch.mjs           # dry-run：只打印报告，不写任何东西
//   node scripts/upstream-watch.mjs --apply   # 开 issue（按 label+title 去重）+ 更新 upstream.json 的 pinned
//
// 认证: 优先 GH_TOKEN 环境变量；否则取 `gh auth token`（本地）。
// 原理: GitHub 不发布 Releases 时盯 tag；用 git/trees 拉两个 tag 的全文件集合做差，
//       比 compare API 的 300 文件上限可靠。命中挂点路径才算是"我们关心的变更"。
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CFG = JSON.parse(readFileSync(join(ROOT, 'upstream.json'), 'utf8'))
const APPLY = process.argv.includes('--apply')

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function gh(path, init) {
  // 注意：init.headers 必须与默认 headers 合并，不能整体替换——否则 POST 会丢掉 authorization（2026-08-30 实机 401）。
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'upstream-watch', ...(init && init.headers || {}) }
  if (token()) headers.authorization = 'Bearer ' + token()
  const res = await fetch('https://api.github.com' + path, Object.assign({}, init, { headers }))
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`)
  return body
}

/** 某 tag 的全部 blob 路径集合。树被截断（超大仓）时直接报错，宁可不报也不报错。 */
async function treeFiles(repo, ref) {
  const t = await gh(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`)
  if (t.truncated) throw new Error(`${repo}@${ref} 文件树被 GitHub 截断，需要换成 compare 方案`)
  return new Set((t.tree || []).filter((e) => e.type === 'blob').map((e) => e.path))
}

/** 同名 tag 的已开 issue 是否已存在（去重）。 */
async function alreadyOpened(title) {
  const q = `repo:${CFG.issue.repo} label:${CFG.issue.label} in:title ${JSON.stringify(title)} state:open`
  const r = await gh(`/search/issues?q=${encodeURIComponent(q)}`)
  return r.total_count > 0
}

function hitLines(oldFiles, newFiles, watch) {
  const lines = []
  for (const w of watch) {
    const changed = (f) => (oldFiles.has(f) ? !newFiles.has(f) : newFiles.has(f))
    const prefix = w.path.endsWith('/') ? w.path : w.path + '/'
    let count = 0
    for (const f of newFiles) if (f.startsWith(prefix) && changed(f)) count += 1
    for (const f of oldFiles) if (f.startsWith(prefix) && !newFiles.has(f)) count += 1
    if (count > 0) lines.push(`- \`${w.path}\`（${count} 个文件）→ ${w.impact}`)
  }
  return lines
}

async function main() {
  const reports = []
  let pinDirty = false

  for (const up of CFG.upstreams) {
    const tags = await gh(`/repos/${up.repo}/tags?per_page=1`)
    const latest = (tags[0] || {}).name
    if (!latest) { console.log(`⚠ ${up.repo}: 无 tag，跳过`); continue }
    if (latest === up.pinned) { console.log(`✓ ${up.repo}: ${up.pinned} 仍是最新`); continue }

    const oldFiles = await treeFiles(up.repo, up.pinned)
    const newFiles = await treeFiles(up.repo, latest)
    const hits = hitLines(oldFiles, newFiles, up.watch)
    if (hits.length === 0) { console.log(`✓ ${up.repo}: ${up.pinned} → ${latest}，但挂点无命中（其余改动不关心）`); continue }

    const cmp = await gh(`/repos/${up.repo}/compare/${encodeURIComponent(up.pinned)}...${encodeURIComponent(latest)}`)
    const report = {
      up,
      latest,
      commits: cmp.total_commits || 0,
      title: `[upstream] ${up.repo} ${up.pinned} → ${latest}`,
      body: `上游出新 tag：\`${latest}\`（当前 pin \`${up.pinned}\`，共 ${cmp.total_commits || '?'} commits）。\n\n挂点命中：\n${hits.join('\n')}\n\n动作：读官方 \`.agents/notes\` 对应笔记解读变更意图 → 评估影响面 → 适配修复并重跑 plugin_maker_check（升级基线）。`,
    }
    reports.push(report)
    console.log(`\n◆ ${report.title}\n${report.body}`)

    if (APPLY) {
      if (await alreadyOpened(report.title)) {
        console.log(`  ↳ 已有同题 issue，跳过`)
      } else {
        await gh(`/repos/${CFG.issue.repo}/issues`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: report.title, body: report.body, labels: [CFG.issue.label] }),
        })
        console.log(`  ↳ 已开 issue（${CFG.issue.repo}）`)
      }
      up.pinned = latest
      pinDirty = true
    }
  }

  if (pinDirty) {
    writeFileSync(join(ROOT, 'upstream.json'), JSON.stringify(CFG, null, 2) + '\n')
    console.log('\n★ upstream.json 的 pinned 已更新 —— 记得提交推送（Actions 会自动提交）')
  }
  if (!APPLY && reports.length > 0) {
    console.log('\n(dry-run：未做任何写入；确认后加 --apply 执行)')
  }
}

main().catch((e) => { console.error('upstream-watch 失败：' + e.message); process.exitCode = 1 })
