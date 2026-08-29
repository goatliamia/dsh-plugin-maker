// 引用面扫描：把「谁引用谁」从 grep 自觉变成工具（checklist「废文档」条目的执行端）。
// 范围=本机工作区：Documents 根层文本文件 + Documents/plugins/ 下各仓库源码（排除 node_modules/.git/*.tgz）。
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'dist', 'releases'])
const TEXT_RE = /\.(md|mjs|js|cjs|json|yml|yaml|txt)$/i
const MAX_FILES = 900
const MAX_HITS = 60
const LINE_LEN = 140

async function collectFiles(dir, files, budget) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (budget.n <= 0) return
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await collectFiles(full, files, budget)
    } else if (TEXT_RE.test(entry.name)) {
      budget.n -= 1
      files.push(full)
    }
  }
}

/** 全工作区引用扫描：返回 { file, line, text } 命中列表。 */
export async function scanReferences(keyword, { roots, maxHits = MAX_HITS } = {}) {
  const needle = String(keyword || '').toLowerCase()
  if (!needle) return []
  const files = []
  for (const root of roots) await collectFiles(root, files, { n: MAX_FILES })
  const hits = []
  for (const file of files) {
    if (hits.length >= maxHits) break
    let text
    try { text = await readFile(file, 'utf8') } catch { continue }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line.toLowerCase().includes(needle)) continue
      hits.push({ file, line: i + 1, text: line.trim().slice(0, LINE_LEN) })
      if (hits.length >= maxHits) break
    }
  }
  return hits
}
