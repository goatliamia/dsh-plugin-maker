// dsh-plugin-maker 动作清单条款表：把「设计硬约束」变成「执行时的动作入口」。
// 每条 = 任务类型 → 必须执行的动作清单（来源=各仓库 AGENTS.md/ADR 的硬约束条款）。
// 域划分（域划分定案）：maker=开发期机械面；错误域（监听/守卫/模式表/踩坑沉淀）归 dsh-retro；
// 协作协议层（收件箱/change 信号/Decision/ExternalRef）归 project-context-bridge。
// 跨域条目标注〔归口〕：未装对应插件时跳过该条即可，不影响 maker 工具本身可用（详见 docs/standalone.md）。
export const CHECKLISTS = {
  '开工': [
    'project_inbox 读桥收件箱并回执（空则零成本）〔归口：桥，未装则跳过〕',
    '读本项目 AGENTS.md，把涉及本任务的「必须/硬约束」条款列成动作清单',
    '动手前查 DSH 原生能力（cordis_inspect），能复用不开发',
  ],
  '改文件/改代码': [
    'impactPreview 影响分析（桥原生机制：subjectType/subjectId → 影响范围+建议变更；未装桥则用 plugin_maker_impact 扫引用面）',
    '按预览逐处更新，不绕过预览直接批量改文件',
    '改完 node --check 语法自检 + 测试全绿（沙箱内逐文件 in-process）',
    'change 信号投递受影响工作线〔归口：桥，未装则跳过〕',
  ],
  '发版本': [
    'tools/release.mjs 一条龙（校验→bump→pack→装 profile→commit→push），不手动拼',
    '重要 bug 补 docs/bugs/ 一条一文件（模板：现象/复现/影响/根因/修复/回归/不要再做）',
    'plugin_maker_check 全绿（契约/发布合规/密钥/waterfall 透传）',
    '更新桥 ExternalRef（版本/仓库身份）〔归口：桥，未装则跳过〕',
    '**更新 host 常驻插件（project-context-bridge、dsh-retro 的 host 半）后，主动提醒用户重启 DSH 才生效**；纯工具类插件（maker 工具）新会话生效——发版完即说，别等用户问〔仅适用装了桥/retro 的场景〕',
    '**本轮涉及的设计定案（能力边界/模式定义/取舍）必须补桥 Decision 或落 preset/git 文件**——对话记忆不算（三态能力表曾只在对话里，超长会话执行时凭记忆记错 deny 清单）',
  ],
  '废文档/改名/语义变更': [
    'impactPreview 查引用面（谁引用它；未装桥则用 plugin_maker_impact）',
    '逐处更新引用（含所有仓库文档/代码），不靠 grep 自觉',
    'change 信号投递所有受影响方〔归口：桥，未装则跳过〕',
    '桥 relation/ExternalRef 同步更新〔归口：桥，未装则跳过〕',
  ],
  '踩坑后': [
    'retro_learn 沉淀（无根因拒绝；global 落点过环境细节检查）〔归口：retro，未装则跳过〕',
    '重要坑进对应插件 patterns.mjs 模式表（watch/guard 规则）〔归口：retro，未装则跳过〕',
    '仓库 docs/bugs/ 一条一文件（maker 本域：修复档案跟仓库走）',
    '说「记住了」必须交代三要素：记住了什么+以什么形式存在+对模型负担（零负担/受控）——缺一条不算交代清楚；**「以什么形式」必须是可查真源（桥/code/git/preset 文件），对话历史不算**（三态能力表定案曾只在对话里，超长会话执行时凭记忆记错）',
    '**升级 Rule 前过升级闸门**（retro 演化设计第 3 节）：现象重复 ≠ 因果证据——Observation Evidence 只够「继续调查」，Causal Evidence 才够「成规则」；首错/因果未定 → 只沉淀不升级；升级前核对是否与已固化精准条款重复抽象；Rule 定案要桥 Decision 关联证据，不自动升级〔归口：retro〕',
    '**沉淀前先查底座**：现象已被底座机制**正确处理** → 仅保留必要观察，不形成新知识/约束；未被正确处理（插件误用底座/底座 bug/超出覆盖）才进入归因与模式判断——「存在相关机制」≠「正确处理该现象」',
  ],
  '调查/技术可行性': [
    '**先查底座**：官方/已有机制已正确覆盖需求 → 出口为 Reuse / 不做；「无需新增机制」是有效调查结论（判据=真正满足需求，不是"看起来像/理论上可以/社区有人做过"）',
    '**否定要证据**：对 DSH 原生能力下否定结论（不支持/做不到/需拆包/待实测）前，先查官方契约 + 最小实验验证——契约读一半就下否定结论会「保守地错」（三次实例：ctx.config 服务访问、工具 per-preset 假设、restrict 漏了 preset 行即 agent scope）',
    '五类调研缺一不可：①平台能力 ②同生态 ③行业参照 ④工程实践 ⑤需求验证（自用跳过）',
    '分栏汇报：可行性+形态判断+挂载点+成本，不写实现代码；**Reuse/不做 是成功完成的调查结论**，与 Not feasible 分开表述（防「没产出代码=没做成」的隐性激励）',
    '**调研结论必须带承接**：结论之后做什么动作、固化到哪（条款表/检查项/向导步骤/skill），不含糊留白',
    '**吸收上游知识分三层**：①事实性（契约形状/字段/路径）候选进 check/模板，但先与运行时实测对齐（文档≠实测时以实测为准并记差异）；②技术性（机制语义）进机制理解——机制也会变，吸收前提是「变化可感知」（check 规则必须与 upstream 挂点配对）；③调性（平台风格/术语）只进定位与向导措辞，不进规则。落成规则的判据：变化可感知+错误成本高+适配成本有界+可机器化+过闸门（筛子归条款表，闸门归 retro）',
  ],
}

export function checklistFor(taskType) {
  const target = String(taskType || '')
  // 先精确命中，再关键词包含（键包含输入 或 输入包含键，覆盖「改文件」→「改文件/改代码」与「我要发一个版本」→「发版本」）
  const key = Object.keys(CHECKLISTS).find((k) => k === target || k.includes(target) || target.includes(k))
  return key ? { type: key, items: CHECKLISTS[key] } : { type: '开工', items: CHECKLISTS['开工'] }
}

/** 协作条目过滤（去我们化·不误伤）：hasBridge/hasRetro 为假时隐藏标注对应归口的条目。
 *  检测源=协作工具是否已注册（project_inbox=桥侧入口、retro_learn=retro 入口）；
 *  未装协作件的对外环境自动得到干净清单，装了的全量可见。 */
export function visibleItems(items, { hasBridge = true, hasRetro = true } = {}) {
  return items.filter((item) => {
    if (!hasBridge && (item.includes('〔归口：桥') || item.includes('〔仅适用装了桥'))) return false
    if (!hasRetro && item.includes('〔归口：retro')) return false
    return true
  })
}
