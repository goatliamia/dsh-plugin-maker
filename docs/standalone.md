# 单独使用 maker（不装 dsh-retro / project-context-bridge）

maker 是纯开发期机械工具，无运行时硬依赖：单独安装即可用全部工具与 skill。

## 工具面（全可用）

| 工具 | 用途 | 依赖 |
|---|---|---|
| `plugin_maker_scaffold` | 生成合规骨架 | 无 |
| `plugin_maker_check` | 契约/发布合规/升级基线/密钥检查 | 无 |
| `plugin_maker_vet` | 接盘体检出可照做的改造清单 | 无 |
| `plugin_maker_adopt` | 接盘安全项自动应用 | 无 |
| `plugin_maker_checklist` | 任务动作清单（硬约束执行入口） | 无（跨域条目带〔归口〕标注，未装桥/retro 时跳过对应条） |
| `plugin_maker_impact` | 引用面扫描 | 无（桥 impactPreview 的本地替代） |

## skill 面（全可用）

- `skills/plugin-wizard`：需求满足向导（文本版，已原生注册——`/plugin-studio-wizard` 斜杠触发或模型按触发词自动调用，GUI 原生渲染 Instructions 卡片；简报卡复用工具卡、确认门复用 `ask_user_question`，不新造 UI；图形表单卡片未完成，见下）
- `skills/research`：分类调研（`/five-step-research`）

skill 由 maker 自己的 host 半经原生 `ctx.skills.registerProvider` 注册（rank 600=bundled），单一真源 = 插件包内 `skills/` 目录，随包发版更新；项目/用户 skill 根目录（`.dsh/skills`、`~/.dsh/skills` 等）的同名 skill 可覆盖。

## 可选协作层（不是依赖）

- **project-context-bridge**：收件箱回执（`project_inbox`）、change 信号、Decision、ExternalRef 是跨会话协作协议。未装桥时：开工清单第 1 条跳过；改文件后的变更投递跳过；设计定案落 git 文件（preset/ADR）即可，不补桥 Decision。
- **dsh-retro**：`retro_learn`、patterns.mjs 模式表、升级闸门是运行期错误域机制。未装 retro 时：踩坑清单的 retro 归口条跳过；坑照样进本仓库 `docs/bugs/` 修复档案（跟仓库走）。

## 已知缺口

- **交互式表单卡片未完成**：向导以 skill 形态交付（结论卡片 + 每步「对 / 改」确认门，已原生注册，无需额外界面）；一步步点选的图形表单卡片在升级路线，不在当前版本。

## 安装

```
pnpm pack && dsh plugin --profile web add file:<本目录>/dsh-plugin-maker-<版本>.tgz
```
