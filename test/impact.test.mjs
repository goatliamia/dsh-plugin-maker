import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { scanReferences } from '../lib/impact.mjs'

test('scanReferences 找到跨目录引用并排除 node_modules/.git', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'maker-impact-'))
  try {
    const pluginA = path.join(root, 'plugins', 'plugin-a', 'lib')
    const pluginB = path.join(root, 'plugins', 'plugin-b')
    mkdirSync(pluginA, { recursive: true })
    mkdirSync(pluginB, { recursive: true })
    writeFileSync(path.join(pluginA, 'index.js'), '// 引用 REQUIREMENTS.md 的地方\nconst p = "REQUIREMENTS.md"\n')
    writeFileSync(path.join(pluginB, 'README.md'), '# B\n无引用\n')
    mkdirSync(path.join(pluginB, 'node_modules'), { recursive: true })
    writeFileSync(path.join(pluginB, 'node_modules', 'x.md'), 'REQUIREMENTS.md 在 node_modules 里不该被扫到\n')

    const hits = await scanReferences('REQUIREMENTS.md', { roots: [path.join(root, 'plugins')] })
    // 两行都含关键词=2 命中；node_modules 里的 1 行被排除（若扫到会是 3）
    assert.equal(hits.length, 2)
    assert.equal(hits[0].line, 1)
    assert.ok(hits.every((hit) => hit.file.includes('plugin-a')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('scanReferences 无命中返回空数组', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'maker-impact-empty-'))
  try {
    writeFileSync(path.join(root, 'a.md'), '无关内容')
    const hits = await scanReferences('不存在的关键词xyz', { roots: [root] })
    assert.equal(hits.length, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
