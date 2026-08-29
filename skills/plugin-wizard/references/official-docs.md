# 官方文档地图（deepseek-ai/deepseek-harness）

> 用法规则：**文档是线索，实测才是证据。** 判断任何契约（服务名/事件名/字段形状/挂载协议）时，先查这里对应的官方文档建立认知，再用运行时查询（cordis_inspect）+ 运行时包源码（npm 检出处 `node_modules/@deepseek-ai/dsh-*`）实测对齐；文档与实测不符时以实测为准。官方在 rc 阶段，文档会变——静态文档标注可能过期。
>
> 已按 dsh-v0.1.1-rc.2 吸收过一轮的内容见 `docs/upstream-doc-absorption.md`（三层分类 + check 规则对照表 + 差异处置）。

## 从零教程（写插件前先读）

`docs/cordis-tutorial/`（7 章 + index，每章可独立运行）：

| 章 | 主题 |
|---|---|
| index | 教程总览：一切皆插件的 Context 装配观 |
| 01-first-plugin | 插件三形态（函数/对象/Service 类）、cordis.yml 条目形状 |
| 02-lifecycle-and-effects | ctx.effect + disposer、fiber 状态机、卸载语义 |
| 03-services | inject 硬依赖 / ctx.get 可选依赖、服务命名空间 |
| 04-events | 五分发模式（emit/parallel/serial/bail/waterfall）、waterfall 必须透传 next() |
| 05-config | Config=schema 校验器（apply 前校验）、apply(ctx, config) |
| 06-composition-and-hmr | 条目 id/disabled、PENDING 是合法状态、HMR=卸载+重载 |
| 07-into-the-harness | defineTool、ctx.tools.register、tools/result |

## 实操配方（按需查）

`docs/cookbook/`（9 篇）：adding-a-package（官方包结构）、adding-a-tool（工具定义+扩展点）、adding-a-conversation-node（对话节点挂载）、adding-a-settings-card（设置卡+client 装载模型）、adding-an-llm-adapter（LLM 适配器协议）、adding-a-vendored-package（官方 vendor 流程）、extension-cookbook（扩展点总览：微内核、waterfall 策略层）、maintaining-dsh-code-review 与 responding-to-pr-review-on-a-stack（维护者向，与插件开发无关）。

## 能力接缝目录

`docs/capability-seams.md`：全部 Cordis 服务的三角色分类（seam=可替换能力=Service Definition+Service Provider+Consumer；core spine service；bundle/composition point）。查「哪个服务可以被第三方接管/往哪挂」先看它。注意：角色分类是人工编辑的（hybrid 维护），不把 seam 标签当运行时事实；运行时以 cordis_inspect 目录为准。

## 官方 docs/ 其他文档（未精读，按需取）

defensive-patterns、event-producer-consumer、cordis-api、cordis-primer、tool-catalog、web-styling——存在且带中文版，本向导未逐篇吸收；用到时直接读官方仓对应 ref。

## 源码路径

- 运行时包源码（本机 npm 检出处）：`%APPDATA%\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\*`（client-modules/client runner/tools/bundle 装载器都在此，check 规则的实测证据全部出自这里）。
- 官方仓：github.com/deepseek-ai/deepseek-harness（tag `dsh-v0.1.1-rc.2`）。
