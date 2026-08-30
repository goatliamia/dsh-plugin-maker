# 官方插件开发文档吸收对照表（dsh-v0.1.1-rc.2）

> 吸收方法论：三层分类（①事实性→check 规则/模板候选，先与运行时实测对齐；②技术性→机制理解，落 check 规则与向导 references；③调性→只进定位/README/向导措辞，不进 check）。不吸收清单：文档里未经运行时验证的宣称、rc 阶段可能变的内容——check 规则绝不焊死「文档这么写」；**文档只是线索，实测才是证据**。机制化六条判据：①明确事实依据 ②能实测 ③能感知上游变化（check 规则须与 upstream.json 挂点配对）④错误代价足够高 ⑤修改代价足够低 ⑥能机器验证。
>
> 来源：deepseek-ai/deepseek-harness @ dsh-v0.1.1-rc.2（2026-08-29 经 GitHub API 拉取，缓存于仓库 `.upstream-docs/`，不进 git）。**本机安装的 DSH 运行时同为 0.1.1-rc.2**，实测对象=运行中实例（cordis_inspect）+ npm 检出处源码（`@deepseek-ai/dsh-*`）。
>
> 篇数校正：信号原说「cookbook 13 篇」，实测 **9 篇**（en+zh 各 9，共 18 文件）；cordis-tutorial 7 章+index（en+zh 各 8）；capability-seams 在 docs/ 根（40KB）+ .agents/notes 实现笔记。以实测为准。

## 1. 文档清单与三层归属

| 文档 | 三层归属 | 吸收落点 |
|---|---|---|
| cordis-tutorial/index | ②为主+③ | 机制观（一切皆插件的 Context 装配）；术语 |
| cordis-tutorial/01-first-plugin | ①为主+② | 插件三形态、cordis.yml 形状、响亮失败语义 |
| cordis-tutorial/02-lifecycle-and-effects | ②为主+① | effect/disposer、fiber 状态机 |
| cordis-tutorial/03-services | ①+② | inject/ctx.get、服务命名空间 |
| cordis-tutorial/04-events | ①+② | 五分发模式、waterfall next() 纪律 |
| cordis-tutorial/05-config | ①为主+② | Config=schema、apply(ctx,config)、!!js（仓库扩展） |
| cordis-tutorial/06-composition-and-hmr | ②为主+① | id/disabled、PENDING 合法语义、HMR=卸载+重载 |
| cordis-tutorial/07-into-the-harness | ①+② | defineTool、tools/result、inject ['tools'] |
| cookbook/adding-a-package | ①为主+③ | 官方仓库内包不变式（第三方插件仅参照）+命名词表 |
| cookbook/adding-a-tool | ①为主+② | defineTool 形状、五扩展点、展示纯函数 |
| cookbook/adding-a-conversation-node | ②为主+① | 挂载协议（conversationEvents/slots）；2026-08 笔记、rc 易变 |
| cookbook/adding-a-settings-card | ①+② | 设置卡挂载协议、namespace 配对、装载模型 |
| cookbook/adding-a-vendored-package | ①为主 | 官方 vendor 流程，第三方插件无关→不吸收 |
| cookbook/adding-an-llm-adapter | ①+② | LlmAdapter 协议义务=「约定」非框架强制→不落规则 |
| cookbook/extension-cookbook | ②为主+① | 微内核声明、扩展点清单（线索级） |
| cookbook/maintaining-dsh-code-review | 维护者向 | 不吸收 |
| cookbook/responding-to-pr-review-on-a-stack | 维护者向 | 不吸收 |
| docs/capability-seams.md | ①目录+②+③ | seam 三角色思想；角色分类为人工编辑不焊死 |
| .agents/notes/…/2026-06-13-capability-seams | ② | seam≠接口、don't split preemptively |

## 2. check 规则逐项对照表（现有规则）

「来源判定」= 规则成立依据：实测（运行时代码/行为证据）> 文档（官方文档线索）> 约定（maker 自身发布约定）。每条规则的「上游挂点」= upstream.json 中会在该契约变化时告警的路径。

| # | 规则 | 实测证据 | 文档出处 | 上游挂点 | 来源判定 | 处置 |
|---|---|---|---|---|---|---|
| 1 | package.json 有 dsh.bundle.patch | dsh-app-boot/lib/index.js L549：profile bundle 缺 dsh.bundle → 响亮 throw | （无直接描述） | packages/bundle | 实测 | 保留 |
| 2 | cordis.patch.yml 有 insert 层 | @deepseek-ai/cordis-plugin-include applyEntryPatches L57-84：insert 推入条目列表、非 insert 补丁按 id+name 匹配 | tutorial 01/06 cordis.yml 形状 | packages/bundle | 实测 | 保留 |
| 3 | client 自注册 __ModuleLoader__.load | dsh-client-modules lib/index.js L212+（boot 队列）、lib/client.js L202「bundle loaded without registering」 | cookbook adding-a-package（client 侧） | packages/client | 实测 | 保留 |
| 4 | client 注册 id = 包名 | client-modules lib/client.js L202：bundle 执行后未注册 row id → 响亮 throw | 同上 | packages/client | 实测 | 保留 |
| 5 | exports 有 ./package.json | client-modules lib/index.js L276 `require.resolve('${spec}/package.json')`、L381-386 catch→null=客户端行静默不装载 | 文档未明说（maker 实机坑） | packages/client | 实测 | 保留 |
| 6 | host ESM export apply | cordis-plugin-loader L736-741 unwrapExports：**运行时对 CJS/default 导出有归一化**；官方三形态（函数/对象/Service 类）皆可挂 | tutorial 01 三形态 | docs/ + vendor/loader | 实测+文档 | **调整**：放宽为「函数形态或 extends Service」，措辞改为「官方写法约束」（见 §4） |
| 7 | host 代码绝不读 ctx.config | cordis_inspect Service 目录无 config 服务（2026-08-30 实测） | 无 | docs/ | 实测 | 保留 |
| 8 | 无 required:false | dsh-tools lib/types/schema.js L78-79：`required must be true when present` → authorError | tutorial 05 / cookbook adding-a-tool（required 语义） | packages/tools | 实测 | 保留 |
| 9 | waterfall 监听必须透传 next() | cordis_inspect Event 目录：tools/pre-execute、tools/post-execute、tools/execute 均为 waterfall（2026-08-30 实测） | tutorial 04 + extension-cookbook | packages/tools | 实测 | 保留 |
| 10 | 可发布（无 private:true） | —— | 官方仓库内包 private:true（第三方插件无此要求） | docs/ | 约定 | 保留（注明：发布合规是 maker 约定，非运行时契约） |
| 11 | 有 repository 字段 | —— | 同上 | docs/ | 约定 | 保留 |
| 12 | 有 dsh-plugin 关键词 | —— | 同上 | docs/ | 约定 | 保留 |
| 13 | 入口文件在（main/exports 解析） | Node 解析语义 | —— | —— | 约定 | 保留 |
| 14 | 升级基线（报告 DSH 版本） | dshVersion() 读安装包 | —— | —— | 自身机制 | 保留 |
| 15 | 密钥自查 | git grep 全历史 | —— | —— | 自身机制 | 保留 |

## 3. 官方有而我们没拦的（候选 → 裁决）

| 候选 | 文档出处 | 实测 | 裁决 |
|---|---|---|---|
| dsh.client 声明形状（对象、platform 字符串、inject/external 字符串数组、immediately 布尔） | adding-a-package / adding-a-settings-card | client-modules parseDshClient L120-134：违规=启动响亮 throw | **吸收成 check 规则**（六条判据全过：①✅ ②✅ ③packages/client 挂点✅ ④启动即崩✅ ⑤package.json 静态可查✅ ⑥✅） |
| 声明 dsh.client 必须 exports["./client"] | 同上 | client-modules clientExportOf L136-146：缺失=throw「declares dsh.client but exports no ./client bundle」 | **吸收成 check 规则**（判据同上） |
| defineTool 五字段形状 + JSON Schema 关键字白名单（type/oneOf/properties/required/additionalProperties/items/enum/const+annotations，其余关键字=authorError） | adding-a-tool / tutorial 07 | dsh-tools lib/types/index.js L204 关键字白名单、schema.js required 校验 | **进 references 不落 check**：⑥机器验证难（defineTool 调用可跨行/动态拼装，正则静态拦会误报）；③配对挂点=packages/tools 已有，但修改代价>价值 |
| 服务/事件名清单（llm/shell/fs/sandbox/approval/skills/subagents/web/settings/credentials/storage…+agent/*、tools/* 事件） | capability-seams / extension-cookbook | cordis_inspect 目录 | **进 references 不落 check**：目录化事实、易变；查真源=cordis_inspect，官方文档标注可能过期 |
| conversation-node / settings-card 挂载协议 | 对应两篇 cookbook | 契约权威在 2026-08 .agents/notes、示例标 ignore-check | **进 references 索引不落 check**：形态面窄、rc 阶段日期最新、易变 |
| LLM adapter 协议义务（usage/finish 顺序、argumentsDelta、replayState…） | adding-an-llm-adapter | 文档自称「两个实现共同验证的约定」，非框架强制 | **不吸收为规则**（约定非强制、rc 易变）；references 指向官方文档 |
| cordis.yml 条目 id/disabled/!!js | tutorial 05/06 | 文档自称「本仓库 loader 扩展」 | **不吸收**（官方仓库扩展，非 Cordis 标准） |
| 命名词表（Controller/Store/…）、ctx key 单复数、host/client 不得共用 key | adding-a-package | —— | ③调性 → 只进向导措辞（references） |
| 微内核声明、seam 三角色 | capability-seams / extension-cookbook | 角色分类=人工编辑（gen-doc-graphs 手写分类） | ③+② → 定位/README 措辞 + references 机制理解；不焊死 seam 标签 |

## 4. 我们拦了但官方写法已变 / 差异

1. **host ESM export apply**：规则只认 `export function apply`，但官方教程（01-first-plugin）列明三形态——函数 / `export default` 对象 / `extends Service` 类；且运行时 `unwrapExports` 对 CJS/default 有归一化（CJS 也能挂）。差异处置：规则放宽为「函数形态或 extends Service」，文案改为「官方写法约束，非运行时硬门槛」；对象形态留给 vet 人工判断（regex 不可靠）。
2. **cookbook 篇数口径**：信号/桥里「13 篇」与实测 9 篇不符。以实测为准（§0 已校正）。
3. **官方仓库内包不变式**（adding-a-package 的 constraints/files/tsconfig 规则）是官方仓库内工作流，非第三方插件契约——maker 规则不吸收，只把「dsh.client/./client 导出」这种第三方同样受约束的部分保留。

## 5. 官方文档与实测不符 / 须实测对齐清单

**实测相符（已对齐，check 规则证据链）**：§2 表内 #1-#9 的实测证据列，逐条经运行时源码或 cordis_inspect 确认，与文档一致。

**文档宣称未验证/易变，不吸收**：
- tutorial 01：解析失败经 logger 报告、启动期可能丢失——未验证，不吸收。
- tutorial 02：异步 disposer 并发语义、serial 的 falsy 判定——运行时细节，进 references 作线索。
- tutorial 05：`!!js`/`disabled` 每次挂载求值=本仓库 loader 扩展——不吸收。
- cookbook adding-a-settings-card：`clientBundle`/tsdown preset「未发布，外包须复刻输出格式」——rc 阶段开放点，不吸收。
- cookbook adding-a-tool：五扩展点精确入参/顺序「由 dsh-tools README 定义」——本文未给全，须以 README+运行时为准。
- capability-seams：角色分类人工编辑（hybrid 维护模式）、proposed 笔记（工具 seam 强制 AbortSignal）未落地——不编码为规则。

## 6. 处置汇总

- **check 规则**：新增 2 条（dsh.client 形状、exports["./client"] 硬要求）；放宽 1 条（host 入口形态）；其余 13 条保留并补实测证据链（见 §2）。每条规则均回答「来自实测还是文档、文档变了怎么办」：§2 表内「实测证据 + 上游挂点」两列即答案——上游动挂点路径 → upstream-watch 告警 → 按 issue 复核该规则。
- **vet**：dsh.client 形状非法、host 入口缺 apply 的改法文案同步官方三形态与实测报错信息。
- **references**：新增 `skills/plugin-wizard/references/official-docs.md`（官方文档地图+用法规则）；ecosystem-scan.md 满足途径第①层、SKILL.md 铁律、scaffold.md 补官方教程入口。
- **README**：定位措辞改口——「官方给教程，maker 是教程的机器化」（中英双语）。
- **release.mjs**：不改（桥 Decision dec_mteow551_eba5c6fd8c8b：不为未实锤嫌疑改发布流程，预防动作=发版后重启提醒）。

## 7. 社区验证事实卡（0.1.2 升级，2026-08-30 吸收）

官方 #5120「升级 skill」征集期间由社区验证的迁移事实，按六条判据机制化（①明确事实依据 ②能实测 ③挂点配对 ④代价高 ⑤修改代价低 ⑥可机器验证）：

| 事实 | 证据 | 落点 | 上游挂点 |
|---|---|---|---|
| apiProxy 服务在 0.1.2 整体移除（packages/host/apiproxy）；inject apiProxy 的插件入口永远 pending（waiting for service: apiProxy），插件树不激活、宿主启动失败 | oh-my-dsh 验证报告（Docker 全链路：0.1.1 正控正常 / 0.1.2 复现爆炸 / 按 ALPHA1-01 卡片迁移后救活）+ #5120 痛点#4 + 本仓库生态桥插件 plugin.mjs L53 真实命中 | check ⚠️ 警告（inject 含 apiProxy 时提示迁移路线：宿主平面直连领域服务，客户端平面走 ctx.remote.*）+ vet 改法条目 | packages/host/apiproxy |

> 2026-08-30 形态升级：0.1.2 迁移事实全部落入数据文件 `facts/migrations.mjs`（20 条，来源逐条标注：oh-my-dsh 验证报告 / william hops（MIT）/ zhu dsh-web 20 包真实迁移；verified=true 仅 apiProxy 一条，其余社区验证待自测）。check/vet 读取数据文件扫描，新版本事实=新增数据段不改代码；回归测试 test/upgrade-facts.test.mjs（pattern 可编译 + 命中形态 + maker 自检文案隔离）。
