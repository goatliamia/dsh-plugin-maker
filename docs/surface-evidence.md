# 综合汇报：Capability Facade 的收益与权衡（完整实验线）

日期：2026-09-09 · 数据来源：`experiments/` 全部实验，registry 级 + 真机 headless

---

## 0. 一句话结论

> **facade 不是"更优雅的通用方案"，而是一个有明确收益区的局部优化：**
> **稳定组合 → 1 次调用、总 token 降 ~41%；组合之外 → 必须有可发现的出口，否则成本爆炸。**
> **ToolSearch 与 Facade 不是竞争关系，分别处理"能力发现"与"决策边界压缩"。**

---

## 1. 实验线（按顺序）

| # | 实验 | 回答的问题 | 关键结论 |
| --- | --- | --- | --- |
| 1 | registry 49 项断言 | 机制成立吗 | 声明式操作 + 嵌套 dispatch + 守卫照常 |
| 2 | 三臂 headless（raw/capability/hidden） | 能隐藏底层工具吗 | **不能**：可见性三合一，隐藏即不可 dispatch |
| 3 | ab-make A/B | 真实插件上变什么 | 根调用 2→1；工具数 6→7（加不不减） |
| 4 | ab-narrow A/B（6→1） | 收窄有没有用 | **surface ≠ 调用数**；严格任务下两臂同为 1 次 |
| 5 | scale 三臂（157 工具） | 大规模下谁赢 | schema 54KB→27/31KB；search 多一轮往返 |
| 6 | multi-task 五任务 | 哪些边界守得住 | 边界由"是否需要作者没预见的参数"决定 |
| 7 | exit / find / rename 五臂 | 出口与参数 | 出口必要且**必须可发现**；参数改名低收益 |
| 8 | token 测量（本次） | 真实 token 代价 | **schema 小 ≠ 总成本低** |

---

## 2. 表面体量与 token（本次新增）

同一任务、四个臂、真实 `ctx.tokenMeter` + schema 字节：

| 臂 | 可见工具 | schema 字节 | schema≈token | surface token | schema+surface | vs raw |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `raw` | 182 | 54,310 | 13,578 | 576 | 14,154 | — |
| `search` | 27 | 26,680 | 6,670 | 1,166 | **7,836** | **−45%** |
| `facade` | 40 | 31,040 | 7,760 | **576** | 8,336 | **−41%** |
| `find` | 41 | 33,334 | 8,334 | 2,347 | 10,681 | −25% |

### 关键发现：schema 与 surface 是**反向**的

- `search` 把 schema 压到最小（27 个工具），但**每次使用都要多一轮往返**，surface 翻倍；
- `facade` 的 schema 比 search 大 16%，但 **surface 和 raw 一样低**（576）；
- 结果：两者总 token 接近（7.8K vs 8.3K），**都远低于 raw**；
- `find` 的出口让模型多查了几次（surface 2,347），总 token 反而不如 facade。

**结论：优化目标不该是"schema 越小越好"，而是"schema + 使用代价"之和。**

---

## 3. 行为数据（调用数，顺序跑）

| 任务 | raw | search | facade | find |
| --- | ---: | ---: | ---: | ---: |
| 覆盖任务（页数/仓库） | 1–34 | 12–138 | **1–7** | 2–7 |
| 不覆盖任务（标题/日志） | 8–48 | 11–25 | 13–71 | **13–15** |

- **覆盖任务**：facade 最省（1–7 次）；
- **不覆盖任务**：方差极大（13–71），出口的**可发现性**决定成本。

---

## 4. 设计原则（实验支持）

| 原则 | 证据 |
| --- | --- |
| 只封装**确定性**组合 | 线性管线无分支；但"步骤结果为空不跳过"需作者显式声明依赖 |
| 输入必须**显式传递** | `repo` 无 `from` → 静默读默认资源（实测） |
| 按**任务覆盖面**验证 | 工具级正确 ≠ 任务级正确（T3/T4） |
| 出口**必须可发现** | 按名调用 → 467 次猜名字；加 search/list → 15 次 |
| 参数用**调用方词汇** | 低收益（15→13），但零成本；真正的变量是原语是否接受调用方词汇 |
| **不做**万能 dispatcher | `call(toolName,args)` 会把窄接口变回宽接口 |

---

## 5. 决策表

| 场景 | 做法 | 成本 |
| --- | --- | --- |
| 有稳定组合 | 声明 1 个语义操作 | 1 个 schema |
| 原语互相独立 | **不做 facade** | 0 |
| 能力空间巨大不可预测 | search → call | 每用一次多一轮 |
| 既有组合又有长尾 | facade + **可发现出口** | 操作数 +1 |
| 覆盖不确定 | 操作返回 `covered:false` + 原因 | 声明期望字段 |

---

## 6. 诚实标注

- 多数格子 **N=1–3**，调用数方差极大（1–482），是方向性证据不是统计结论；
- `schema+surface` 中 schema 部分用 `bytes/4` 估算（tokenMeter 报的 `totalTokens` 是另一套口径，两者不可直接相加）；
- 池子是**真实规格的合成池**，不是真实 MCP server（沙箱下 stdio MCP 不可用）；
- 未测：缓存命中率、`covered:false` 误报率、多轮任务下的收敛行为。

---

## 7. 仓库索引

| 文件 | 内容 |
| --- | --- |
| `experiments/REPORT.md` | 三臂机制实验（隐藏约束） |
| `experiments/ab-make/REPORT.md` | 真实插件 A/B |
| `experiments/ab-narrow/REPORT.md` | 6→1 收窄 A/B |
| `experiments/scale/REPORT.md` | 157 工具三臂 |
| `experiments/scale/MULTI-TASK-REPORT.md` | 五任务边界 |
| `experiments/scale/EXIT-REPORT.md` / `FIND-REPORT.md` | 出口与可发现性 |
| `experiments/scale/TRADEOFF-REPORT.md` | 五臂权衡 |
| `experiments/scale/tokens/summary.json` | **本次 token 数据** |
