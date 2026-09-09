// 验证 checklistFor 全部 5 类命中 + visibleItems 协作条目过滤（去我们化·不误伤）
// 2026-09-09：删掉「踩坑后」类目与 docs/bugs 档案要求——错误域/踩坑沉淀归 dsh-retro，
// maker 只做开发期机械面；无匹配输入统一落到「开工」清单（含踩坑类输入）。
const cases = [
  ['开工', '开工'],
  ['改文件', '改文件/改代码'],
  ['发版本', '发版本'],
  ['废文档', '废文档/改名/语义变更'],
  ['调查', '调查/技术可行性'],
  ['我要发版本', '发版本'],
  ['看不懂的任务', '开工'],
  ['踩坑', '开工'],
  ['沉淀教训', '开工'],
]
import('../lib/checklists.mjs').then((m) => {
  let pass = 0
  let total = 0
  const check = (ok, label) => { total++; pass += ok ? 1 : 0; console.log((ok ? 'PASS ' : 'FAIL ') + label) }

  for (const [input, expect] of cases) {
    const got = m.checklistFor(input).type
    check(got === expect, input + ' -> ' + got + (got === expect ? '' : ' (expect ' + expect + ')'))
  }

  check(Object.keys(m.CHECKLISTS).length === 5, '清单只有 5 类（踩坑后已归 dsh-retro）')

  // 不再要求写教训/坑档案：全清单零 docs/bugs 引用，且 bug 修复的硬要求是回归测试
  const all = Object.values(m.CHECKLISTS).flat()
  check(!all.some((i) => i.includes('docs/bugs')), '全清单不再要求 docs/bugs 档案')
  check(m.CHECKLISTS['发版本'].some((i) => i.includes('回归测试')), '发版本要求带回归测试（机器可验证）')

  // visibleItems：协作件未装 → 隐藏〔归口：桥〕条目；装齐 → 全量（不误伤）
  const startFull = m.CHECKLISTS['开工']
  check(m.visibleItems(startFull).length === startFull.length, '装齐协作件：开工清单全量可见（不误伤）')
  check(m.visibleItems(startFull, { hasBridge: false }).length === startFull.length - 1, '未装桥：开工清单隐藏 1 条〔归口：桥〕')
  const relFull = m.CHECKLISTS['发版本']
  check(m.visibleItems(relFull, { hasBridge: false }).length === relFull.length - 1, '未装桥：发版清单隐藏 1 条桥条目')

  console.log('RESULT: ' + pass + '/' + total)
  if (pass !== total) process.exitCode = 1
})
