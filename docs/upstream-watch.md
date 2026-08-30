# upstream-watch：上游盯梢机制

> 一句话：先声明"挂在哪些上游的哪些东西上"，上游出新 tag 时自动 diff 这些挂点，把变化变成 issue，由维护者按 issue 适配。避免"事后考古"。

## 为什么要它

DSH 0.1.1 大更新落地时，靠一次临时考古（tag 间 compare + 读实现日记）才知道它动了会话历史/Remote 传输/插件设置/存储结构。这种更新不是机械层换版本号，是契约层变化，靠"偶尔想起去看看"一定会漏。

## 机制（三层）

1. **挂点声明**：`upstream.json` —— 每个上游：pin 的 tag + 关心的路径 + 该路径变化影响插件的哪部分。这是"在哪里关联了它"的唯一事实源。
2. **检测**：`scripts/upstream-watch.mjs`（零依赖，Node ≥18）——拉两个 tag 的全文件树做集合差（比 compare API 的 300 文件上限可靠），命中挂点路径才报告。
3. **落地**：
   - GitHub Actions 周更 cron（`.github/workflows/upstream-watch.yml`）自动跑 `--apply`：开 issue（label `upstream-watch`，同题去重）+ 更新 pinned 并自动提交。
   - 维护者消费：`gh issue list --label upstream-watch` → 读官方 `.agents/notes` 对应笔记解读变更意图 → 评估影响面 → 适配修复 → 关 issue。

## 手动命令

```powershell
$env:GH_TOKEN = gh auth token          # 本地用 gh 的凭证
node scripts/upstream-watch.mjs        # dry-run：只看报告
node scripts/upstream-watch.mjs --apply # 开 issue + 更新 pinned（然后 push 交人）
```

## 成熟模式参照

这个"下游盯上游变更 → 自动开 issue"不是我们发明的，是 GitHub 上成熟维护方式：

- [Gumball12/yuki-no](https://github.com/Gumball12/yuki-no)：GitHub Action，跨仓追踪 head 仓库 commit → 在目标仓建 issue（文档翻译项目用）。
- [llm-d/llm-d 的 upstream-monitor workflow](https://github.com/llm-d/llm-d/blob/0ffa2847/.github/workflows/upstream-monitor.md)：同类上游监控。
- Vue 翻译生态 [Ryu-Cho](https://github.com/vuejs-translations/ryu-cho)：追踪上游文档变更批量建 issue。

为什么没直接用现成工具：上游（deepseek-harness）**不发 GitHub Releases、只有 tag**，且我们挂的是 monorepo 内具体路径而非 npm 依赖——Dependabot/Renovate 都覆盖不到"tag + 路径"这个组合，80 行脚本比引入黑盒更可控。

## 当前挂点（v1.4）

原则：**哪里用到协议就挂哪里**——只挂 maker 自己使用的协议点：现行形态（插件/skill/preset 注入/settings/UI 槽位）与路线图形态（workflow/定时/后台任务/goal/hook），全部挂官方。

| 上游 | pin | 关心（按面） |
|---|---|---|
| deepseek-ai/deepseek-harness | dsh-v0.1.1-rc.2 | 插件面：bundle/client/settings/web；宿主服务面：host/apiproxy（0.1.2 移除事实卡）；协作面：skill/preset/tools；路线图形态：workflow/schedule/jobs/goal/guard/hooks；契约源：docs/ + .agents/notes |
| omdsh-dev/DSH-better-sidebar | v0.16.1 | src（betterSidebar 服务契约） |

备注：`@deepseek-ai/dsh-tools` 出自官方 monorepo，随官方 tag 一并覆盖（其契约文档在官方 docs/tool-catalog）。任务看板类上游与 maker 的协议使用面无关，不挂。
