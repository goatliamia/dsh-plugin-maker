// 验证 checklistFor 全部 6 类命中 + visibleItems 协作条目过滤（去我们化·不误伤）
const cases = [
  ['开工', '开工'],
  ['改文件', '改文件/改代码'],
  ['发版本', '发版本'],
  ['废文档', '废文档/改名/语义变更'],
  ['踩坑', '踩坑后'],
  ['调查', '调查/技术可行性'],
  ['我要发版本', '发版本'],
  ['看不懂的任务', '开工'],
]
import('../lib/checklists.mjs').then((m) => {
  let pass = 0
  let total = 0
  const check = (ok, label) => { total++; pass += ok ? 1 : 0; console.log((ok ? 'PASS ' : 'FAIL ') + label) }

  for (const [input, expect] of cases) {
    const got = m.checklistFor(input).type
    check(got === expect, input + ' -> ' + got + (got === expect ? '' : ' (expect ' + expect + ')'))
  }

  // visibleItems：协作件未装 → 隐藏〔归口：桥〕/〔归口：retro〕条目；装齐 → 全量（不误伤）
  const startFull = m.CHECKLISTS['开工']
  check(m.visibleItems(startFull).length === startFull.length, '装齐协作件：开工清单全量可见（不误伤）')
  check(m.visibleItems(startFull, { hasBridge: false, hasRetro: true }).length === startFull.length - 1, '未装桥：开工清单隐藏 1 条〔归口：桥〕')
  const pitFull = m.CHECKLISTS['踩坑后']
  check(m.visibleItems(pitFull, { hasBridge: true, hasRetro: false }).length === pitFull.length - 3, '未装 retro：踩坑清单隐藏 3 条〔归口：retro〕')
  const relFull = m.CHECKLISTS['发版本']
  check(m.visibleItems(relFull, { hasBridge: false, hasRetro: true }).length === relFull.length - 2, '未装桥：发版清单隐藏 2 条桥条目')

  console.log('RESULT: ' + pass + '/' + total)
  if (pass !== total) process.exitCode = 1
})
