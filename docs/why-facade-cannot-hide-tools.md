# 约束记录：为什么 facade 不能隐藏底层工具

日期：2026-09-09 · 结论来源：registry 级测试 + 真机 headless 负对照

这份文档只记录一件事，以及它的三条证据。任何"把 N 个工具收敛成 M 个入口"的设计都必须
先接受这个约束。

---

## 约束

> **在 DSH 里，一个工具从模型面前隐藏的那一刻，也就从嵌套 dispatch 面前隐藏了。**
> 因此一个 facade **无法**既隐藏底层工具、又通过正常工具管线调用它们。

## 为什么

`@deepseek-ai/dsh-tools` 的设计是"**一个 visibility resolver 同时喂 presentation、lookup
和 dispatch**"（`ToolRuntime` 类注释原文）。三条路共用同一份可见集合，所以：

- `schemas()`（模型看到什么）、
- `get()`（谁能查到它）、
- `execute()` 内部的 `resolveExecution()`（谁能执行它）

是同一个答案。隐藏是**三合一**的，没有"对模型隐藏但对插件可见"的中间态。

PTC 模式是同一个原则的另一个例子：`mode: 'ptc'` 下模型直呼非 `run_code` 工具会得到
`UNKNOWN_TOOL`——**通告面与可调用面保持一致**。

## 三条证据

### 证据 1：被 restrict 的全局工具，嵌套 dispatch 也拿不到

```js
tools.register(defineTool({ name: 'pdf_extract', … }))
const scope = createScope(root, agent)
scope.ctx.get('tools').restrict({ deny: ['pdf_extract'] })

// 模型视图
tools.schemas(agent)          // → []（pdf_extract 消失）
// 嵌套 dispatch（parent token 已设置）
await tools.execute({ name: 'pdf_extract', agent, parent: exec.token, … })
// → { isError: true, error: { message: 'unknown tool "pdf_extract"', info: { code: 'UNKNOWN_TOOL' } } }
```

（`test/harness.mjs` 第 9 组）

### 证据 2：restrict 根本不能命名 scope 自己注册的工具

```js
scope.ctx.get('tools').register(defineTool({ name: 'scoped_primitive', … }))
scope.ctx.get('tools').restrict({ deny: ['scoped_primitive'] })
// → Error: tools.restrict() names unknown global tool "scoped_primitive"; known global tools: (none)
```

原因写在实现里：restriction 过滤的是 scope **继承**的东西（全局层 + 祖先层），
"**never what its OWN layer registers**"——这条豁免本身是为了让委派运行时给子 agent
注册的结构化输出工具不被子 agent 的能力过滤器误删。

（`test/harness.mjs` 第 10 组）

### 证据 3：host 面注册者连 restriction 都装不上

真机 headless 负对照（fixture 在 host 面尝试隐藏自己的实现工具）：

```json
{"arm":"hidden","event":"restrict","outcome":"refused",
 "message":"tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent — deny the tool for the intended agent instead"}
```

（`experiment/REPORT.md` §2.4）

## 那么正确的做法是什么

| 目标 | 做法 |
| --- | --- |
| 插件内部有 15 个操作，模型只看到 2 个 | **不要把 15 个注册成 model-facing tool**。注册 2 个语义操作，15 个操作走 service / 普通函数 |
| 已经注册了 N 个 model-facing 工具，想收敛 | facade 只能做"更好的入口"，surface 会变成 N + M。要真收窄，回到上一行 |
| 想让某个工具"对模型隐藏、但对某个插件可见" | DSH 当前不提供这个能力；需要上游新增机制（例如"仅内部注册"的 tool 层），不属于插件能解决的范围 |

## 对 facade 设计的影响（已落地）

- facade 不提供 `hide()` / `hideInternals()`；
- facade 在注册时**前置校验**每个 step 工具是否存在且可见，不存在直接抛错（fail-loud），
  避免运行到一半才 `UNKNOWN_TOOL`；
- README 与实验报告把这条约束写在最显眼的位置，避免使用者误以为 facade 是"工具收敛器"。
