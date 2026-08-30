# 单独使用 maker（不装 dsh-retro / project-context-bridge）

maker 是纯开发期机械工具，无运行时硬依赖：单独安装即可用全部工具与 skill。

## 工具面（全可用）

| 工具 | 用途 | 依赖 |
|---|---|---|
| `plugin_maker_scaffold` | 生成合规骨架 | 无 |
| `plugin_maker_check` | 契约/发布合规/升级基线/密钥检查 | 无 |
| `plugin_maker_vet` | 接盘体检出可照做的改造清单 | 无 |
| `plugin_maker_adopt` | 接盘安全项自动应用 | 无 |
| `plugin_maker_checklist` | 任务动作清单（硬约束执行入口） | 无（协作插件条目带〔归口〕标注，未装对应插件时自动跳过） |
| `plugin_maker_impact` | 引用面扫描 | 无（桥 impactPreview 的本地替代） |

## skill 面（全可用）

- `skills/plugin-wizard`：需求满足向导（文本版，已原生注册——`/plugin-studio-wizard` 斜杠触发或模型按触发词自动调用；呈现为文本输出 + `ask_user_question` 确认门（实机可弹），不依赖卡片渲染；图形表单卡片未完成，见下）
- `skills/research`：分类调研（`/five-step-research`）

skill 由 maker 自己的 host 半经原生 `ctx.skills.registerProvider` 注册（rank 600=bundled），单一真源 = 插件包内 `skills/` 目录，随包发版更新；项目/用户 skill 根目录（`.dsh/skills`、`~/.dsh/skills` 等）的同名 skill 可覆盖。

## 可选协作层（不是依赖）

- **project-context-bridge**（跨会话协作层）：收件箱回执（`project_inbox`）、变更通知、决策记录、外部引用组成跨会话协作协议。未装桥时：开工清单第 1 条跳过；改文件后的变更通知跳过；设计决策落 git 文件（docs 文档或 commit 信息）即可。
- **dsh-retro**（运行期错误学习）：`retro_learn` 教训沉淀、模式表、升级闸门。未装 retro 时：踩坑清单的 retro 归口条跳过；坑照样进你的插件仓库 `docs/bugs/` 修复档案（四段模板）。

## 已知缺口

- **交互式表单卡片未完成**：向导以 skill 形态交付（文本结论 + 每步「对 / 改」确认门，已原生注册，无需额外界面）；一步步点选的图形表单卡片在升级路线，不在当前版本。

## 安装

```
pnpm pack && dsh plugin --profile web add file:<本目录>/dsh-plugin-maker-<版本>.tgz
```
