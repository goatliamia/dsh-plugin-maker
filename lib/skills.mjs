// dsh-plugin-maker 自带 skill provider：把包内 skills/ 注册进 DSH 原生 skill 目录（ctx.skills）。
// 单一真源 = 插件包自身 skills/ 目录：随包发版更新，不做 ~/.dsh/skills 外部副本（副本会腐烂）。
// 原生呈现：skill 被调用时 GUI 原生渲染「Skill 行 → Instructions 卡片」，无需 client UI。
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

// 与官方 BUNDLED_SKILL_RANK（600）一致：项目/用户 skill（100-500）可覆盖包自带 skill，包自带兜底。
const RANK = 600
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/

/** 极简 frontmatter 解析：只取单行 key: value 的 name/description/whenToUse，正文原样保留。 */
function parseSkill(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { meta: {}, content: text }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, content: text.slice(m[0].length).replace(/^\r?\n+/, '') }
}

/** 扫包内 skills/ 一层目录：<dir>/SKILL.md，取 frontmatter name 为 skill 名。 */
async function discover(root) {
  const out = []
  let entries
  try { entries = await readdir(root) } catch { return out }
  for (const name of entries) {
    const dir = path.join(root, name)
    try {
      const st = await stat(dir)
      if (!st.isDirectory()) continue
      const file = path.join(dir, 'SKILL.md')
      const text = await readFile(file, 'utf8')
      const { meta, content } = parseSkill(text)
      const skillName = String(meta.name || '')
      if (!NAME_RE.test(skillName)) continue
      out.push({ skillName, description: String(meta.description || ''), whenToUse: meta.whenToUse ? String(meta.whenToUse) : '', dir, file, content })
    } catch {}
  }
  return out
}

export function createMakerSkillProvider({ root }) {
  return {
    name: 'dsh-plugin-maker',
    async list() {
      const skills = await discover(root)
      return skills.map((s) => ({
        name: s.skillName,
        description: s.description,
        ...(s.whenToUse ? { whenToUse: s.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'bundled',
        provider: 'dsh-plugin-maker',
        resourceBase: { kind: 'directory', path: s.dir },
        rank: RANK,
        locator: s.file,
        path: s.file,
      }))
    },
    async get(candidate) {
      try {
        const text = await readFile(candidate.locator, 'utf8')
        const { meta, content } = parseSkill(text)
        return {
          name: String(meta.name || candidate.name),
          description: String(meta.description || candidate.description),
          ...(meta.whenToUse ? { whenToUse: String(meta.whenToUse) } : {}),
          invocation: candidate.invocation,
          source: candidate.source,
          provider: candidate.provider,
          resourceBase: candidate.resourceBase,
          content,
          path: candidate.path,
        }
      } catch { return undefined }
    },
  }
}
