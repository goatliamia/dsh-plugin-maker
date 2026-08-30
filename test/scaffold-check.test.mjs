// 生成即验证回归测试：scaffold 模板产物必须 check 全绿——模板回归当场暴露，不靠用户手动发现
import { checkPlugin, scaffoldFiles } from '../lib/check-core.mjs'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const dir = path.join(os.tmpdir(), 'maker-scaffold-check-' + Date.now())
await mkdir(path.join(dir, 'lib'), { recursive: true })
const files = scaffoldFiles('dsh-test-plugin', 'test plugin', '0.1.1-rc.2')
for (const [rel, content] of Object.entries(files)) await writeFile(path.join(dir, rel), content, 'utf8')

const out = await checkPlugin(dir)
let pass = 0
const check = (ok, label) => { pass += ok ? 1 : 0; console.log((ok ? 'PASS ' : 'FAIL ') + label) }

check(!out.includes('❌'), '骨架 check 无 ❌（模板全绿）')
check(out.includes('契约校验'), '含契约校验节')
check(out.includes('发布合规'), '含发布合规节')
check(out.includes('升级基线'), '含升级基线节')
check(out.includes('跨版本迁移事实卡'), '含迁移事实卡节')
check(out.includes('0.1.1-rc.2'), '报告当前 DSH 版本')

await rm(dir, { recursive: true, force: true })
console.log('RESULT: ' + pass + '/6')
if (pass !== 6) process.exitCode = 1
