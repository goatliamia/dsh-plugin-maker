// 跨版本迁移事实卡（数据真源）：check/vet 读取本文件做静态 ⚠️ 提示。
// 每条 = 一段版本迁移的破坏性变更：pattern 命中 → 提示（不参与 ❌ 判定——0.1.1 下这些写法合法，升到 to 版本前需迁移）。
// 证据纪律：source 标注证据链；verified=true=本仓库实测，false=社区验证待自测（文档是线索，实测才是证据）。
// 主要来源：官方 #5120 讨论 + william-jin-cmu/dsh-plugin-upgrade（MIT）hops 数据 + oh-my-dsh 验证报告 + zhu1090093659 dsh-web 20 包真实迁移。
// 新版本事实 = 新增一段对象，不改 lib/index.js（数据与机制分离）。
export const MIGRATION_FACTS = [
  {
    from: '0.1.1',
    to: '0.1.2',
    facts: [
      {
        pattern: '\\bapiProxy\\b|APIProxy|dsh-host-apiproxy|connection\\.api\\.',
        message: 'apiProxy 服务已整体移除（packages/host/apiproxy 无 0.1.2 版）——宿主平面跳过网关门面、直连领域服务（llm/sessionTitle 等）；客户端平面走 ctx.remote.<ns>.<method>()（inject 声明 remote 并在 dsh.client.inject 列贡献包）。注意：别把 apiProxy 换成 remote（那是客户端平面门面，宿主注入它仍会 pending 拖死启动）',
        source: 'oh-my-dsh Docker 全链路复现 + #5120 痛点#4 + 本生态桥 plugin.mjs L53 真实命中',
        verified: true,
      },
      {
        pattern: '\\bCallId\\b',
        message: 'CallId → ToolCallId（@deepseek-ai/dsh-llm），类型与构造器都改名（ToolExecution.callId/rootCallId/subCallId、chunk rows 用到）',
        source: 'william hops A§2（tsc+headless 评测）+ zhu dsh-web 20 包真实迁移',
        verified: false,
      },
      {
        pattern: "from '@deepseek-ai/dsh-llm'.*\\b(deepFreeze|assertNever)\\b|\\b(deepFreeze|assertNever)\\b.*from '@deepseek-ai/dsh-llm'",
        message: 'deepFreeze / assertNever 从 dsh-llm 移到 @deepseek-ai/dsh-util-values',
        source: 'william hops A§2 + zhu dsh-web 20 包真实迁移',
        verified: false,
      },
      {
        pattern: "\\b(JsonValue|isJsonValue|snapshotJsonValue)\\b.*from '@deepseek-ai/dsh-(session|tools)'|from '@deepseek-ai/dsh-(session|tools)'.*\\b(JsonValue|isJsonValue|snapshotJsonValue)\\b",
        message: 'JsonValue / isJsonValue / snapshotJsonValue 移到 @deepseek-ai/dsh-util-values',
        source: 'william hops A§3 + zhu dsh-web 20 包真实迁移',
        verified: false,
      },
      {
        pattern: '\\bisTokenDelta\\b',
        message: 'isTokenDelta 从 dsh-llm 移除——直接窄判 chunk.type === "text-delta"',
        source: 'william hops A§2',
        verified: false,
      },
      {
        pattern: '\\boffloadRequestImages\\b[^W]',
        message: 'offloadRequestImages → offloadRequestImagesWithPolicy',
        source: 'william hops A§2',
        verified: false,
      },
      {
        pattern: '\\bOFFLOADED_IMAGE_TEXT\\b',
        message: 'OFFLOADED_IMAGE_TEXT 常量 → offloadedImageText() 函数',
        source: 'william hops A§2',
        verified: false,
      },
      {
        pattern: '\\bTodoItem\\b.*dsh-session|dsh-session.*\\bTodoItem\\b',
        message: 'TodoItem 不再由 dsh-session 导出（todo 状态归 dsh-tool-todo）',
        source: 'william hops A§3',
        verified: false,
      },
      {
        pattern: 'tools/code-dispatch-log',
        message: 'hook tools/code-dispatch-log → tools/ptc-dispatch-log',
        source: 'william hops A§4',
        verified: false,
      },
      {
        pattern: '\\bCodeDispatch(Log|EventData|StartEventData)\\b',
        message: 'CodeDispatch* → PtcDispatch*（@deepseek-ai/dsh-tools）',
        source: 'william hops A§4',
        verified: false,
      },
      {
        pattern: "mode:\\s*['\"]?code['\"]?(\\s|$)",
        message: "tools mode 'code' → 'ptc'（config row / ToolPresentationMode）",
        source: 'william hops A§4',
        verified: false,
      },
      {
        pattern: "'code'\\s*\\|\\s*'both'|'native'\\s*\\|\\s*'code'",
        message: "ToolPresentationMode 字面量 'code' → 'ptc'",
        source: 'william hops A§4',
        verified: false,
      },
      {
        pattern: '\\b(PERSONA_ORDER|SDK_SECTION_ORDER)\\b',
        message: "order 常量已移除 → ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA' | 'TOOLS_SDK')",
        source: 'william hops A§5 + zhu dsh-web 真实迁移',
        verified: false,
      },
      {
        pattern: 'systemPrompt\\.(section|context)\\([^)]*order:\\s*-?[0-9]+|order:\\s*-?[0-9]+',
        message: '人工复核：内置 systemPrompt 段位移位（内置工具段 1000–2900、SDK 段 5000，0.1.1 的 100–199 已不在工具区）——用 getSectionOrder(name) + offset，写死数字的 order 可能跑到别的段前面',
        source: 'william hops A§5（zhu 真实案例：写死 order:116 加载正常但提示词位置错乱）',
        verified: false,
        review: true,
      },
      {
        pattern: 'dsh-client-runtime',
        message: '@deepseek-ai/dsh-client-runtime 无 0.1.2 版，其导出已拆到各包（SlotRegistry→dsh-client-ui-renderer/client、SessionRuntime/createScope→dsh-api-session-controller/client、Conversation*→dsh-client-ui-conversation/chat、workspace→dsh-client-ui-workspace）——依赖/注入处逐条核对 Part B 去向表',
        source: 'william hops Part B + zhu dsh-web 真实迁移',
        verified: false,
      },
      {
        pattern: 'dsh-agent/lib/types/runtime-types',
        message: 'Agent 类型的深导入断裂（runtime-types 不再在 0.1.2 该路径）——从包根导入',
        source: 'william hops A§6',
        verified: false,
      },
      {
        pattern: 'parent\\.options\\.(provider|model)',
        message: '人工复核：子模型路由改随 live request header → 用 parentAgentOptionsForDelegation(parent)',
        source: 'william hops A§7',
        verified: false,
        review: true,
      },
      {
        pattern: '"@deepseek-ai/dsh-[a-z-]+":\\s*"0\\.(0\\.|1\\.[01])',
        message: 'framework 依赖被精确钉死在 0.0.x/0.1.0/0.1.1 线（无 ^ 范围）→ 放宽为 ^ 范围（如 "^0.1.1-rc.2" 即接受 0.1.2 线；脚本化 bump 见 william scripts/bump-deps.mjs）',
        source: 'william hops A§1（maker 自身 2026-08-30 迁移：peer 从 "0.1.1-rc.2" 放宽为 "^0.1.1-rc.2"）',
        verified: true,
      },
      {
        pattern: '"@deepseek-ai/cordis":\\s*"\\^?4\\.0\\.[01]([^0-9]|$)',
        message: '@deepseek-ai/cordis → ^4.0.2',
        source: 'william hops A§1',
        verified: false,
      },
      {
        pattern: '"(cordis|schemastery)":\\s*"',
        message: '非 scoped 的 cordis/schemastery 依赖 → 改用 @deepseek-ai/ scoped 包（防两份副本）',
        source: 'william hops A§1',
        verified: false,
      },
    ],
  },
]
