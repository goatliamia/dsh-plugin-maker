// 验证 maker 自带 skill provider：发现包内 skills/ 两个 skill，get 剥 frontmatter 回正文
import { createMakerSkillProvider } from '../lib/skills.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills')
const provider = createMakerSkillProvider({ root })

const candidates = await provider.list()
const names = candidates.map((c) => c.name).sort()
const expectNames = ['five-step-research', 'plugin-studio-wizard']
let pass = 0
const check = (ok, label) => { pass += ok ? 1 : 0; console.log((ok ? 'PASS ' : 'FAIL ') + label) }

check(provider.name === 'dsh-plugin-maker', 'provider 名 = dsh-plugin-maker')
check(names.length === 2 && names.every((n, i) => n === expectNames[i]), '发现 2 个 skill: ' + names.join(', '))
check(candidates.every((c) => c.invocation.modelInvocable && c.invocation.userInvocable && c.source === 'bundled' && c.rank === 600 && c.resourceBase?.kind === 'directory'), 'candidate 携带 invocation/source/rank/resourceBase')

const wizard = await provider.get(candidates.find((c) => c.name === 'plugin-studio-wizard'))
check(!!wizard && wizard.content.startsWith('# Plugin Studio 向导') && !wizard.content.startsWith('---'), 'get 剥 frontmatter：正文以标题开头')

const research = await provider.get(candidates.find((c) => c.name === 'five-step-research'))
check(!!research && research.content.startsWith('# 五步分类调查'), 'get research 正文正确')

const missing = await provider.get({ ...candidates[0], locator: path.join(root, 'nope', 'SKILL.md') })
check(missing === undefined, 'get 读不到文件返回 undefined')

console.log('RESULT: ' + pass + '/6')
if (pass !== 6) process.exitCode = 1
