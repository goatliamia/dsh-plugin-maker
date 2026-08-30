// 迁移事实卡回归测试：pattern 可编译、命中形态、maker 自检白名单（bug 002 教训的机制化）
import { MIGRATION_FACTS } from '../facts/migrations.mjs'
import { hookSuggestions } from '../lib/check-core.mjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
const check = (ok, label) => { pass += ok ? 1 : 0; console.log((ok ? 'PASS ' : 'FAIL ') + label) }

const allPatterns = MIGRATION_FACTS.flatMap(h => h.facts.map(f => f.pattern))
check(allPatterns.length >= 20, '事实卡 ≥ 20 条（0.1.1→0.1.2 全量吸收）')

let compileOk = true
for (const p of allPatterns) { try { new RegExp(p) } catch { compileOk = false } }
check(compileOk, '所有 pattern 可编译')

const hit = (i, text) => new RegExp(MIGRATION_FACTS[0].facts[i].pattern).test(text)
// apiProxy（索引 0，verified=true）
check(hit(0, 'export const inject = ["apiProxy"]'), 'apiProxy 模块级注入命中')
check(hit(0, 'ctx.inject(["apiProxy", "agents"], cb)'), 'apiProxy ctx.inject 命中')
check(hit(0, 'const x = { inject: ["apiProxy"] }'), 'apiProxy 冒号形态命中')
check(hit(0, 'ctx.connection.api.sessions.rename()'), 'apiProxy 客户端门面 connection.api 命中')
// CallId（索引 1）
check(hit(1, 'const id: CallId = x'), 'CallId 命中')
check(!hit(1, 'const id: ToolCallId = x'), 'ToolCallId 不误报（边界）')
check(!hit(1, 'const id: rootCallId = x'), 'rootCallId 不误报（边界）')
// dsh-client-runtime（索引 14）
check(hit(14, "import x from '@deepseek-ai/dsh-client-runtime'"), 'dsh-client-runtime 导入命中')
// 无关文本零误报（CallId 事实不命中空文本）
check(!hit(1, '没有相关符号的普通文本'), '无关文本不误报')

// maker 自检白名单：lib/index.js 本身不含迁移事实的「假阳性字面量」——数据在 facts/ 不被扫描，
// 机制文件里不允许出现会命中 dsh-llm 迁移 pattern 的文案（bug 002 教训）。
const indexText = readFileSync(path.join(root, 'lib', 'index.js'), 'utf8')
check(!hit(1, indexText), 'maker 自身 lib/index.js 不被 CallId 事实命中（文案隔离）')
check(!hit(2, indexText), 'maker 自身不被 deepFreeze 导入事实命中')
check(!hit(3, indexText), 'maker 自身不被 JsonValue 导入事实命中')

// 挂靠建议（帮助形态）：包引用与 inject 服务名 → 上游挂点
const h1 = hookSuggestions("import { defineTool } from '@deepseek-ai/dsh-tools'\nexport const inject = ['apiProxy']")
check(h1.some(h => h.path === 'packages/core/tools'), '挂靠建议：dsh-tools 引用 → packages/core/tools')
check(h1.some(h => h.path === 'packages/host/apiproxy'), '挂靠建议：inject apiProxy → packages/host/apiproxy')
check(hookSuggestions('普通文本无任何官方面').length === 0, '挂靠建议：无官方面使用 → 空')
check(h1.length === new Set(h1.map(h => h.path)).size, '挂靠建议：同挂点去重')

console.log('RESULT: ' + pass + '/18')
if (pass !== 18) process.exitCode = 1
