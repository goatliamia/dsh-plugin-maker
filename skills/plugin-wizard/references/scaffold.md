# 骨架与落地（第五步）

> 官方从零教程：docs/cordis-tutorial（01-first-plugin → 07-into-the-harness）。本页骨架=教程契约的最小机器化；契约细节以官方教程+运行时实测为准（`references/official-docs.md`、`docs/upstream-doc-absorption.md`）。

## bundle 最小骨架
- package.json: name/version/main lib/index.js/type module/exports(. 与 ./client)/files/dsh.bundle.patch/dsh.client.inject
- cordis.patch.yml:
  ```yaml
  - insert:
      - id: <插件名>
        name: <包名>
  ```
- lib/index.js（host）:
  ```js
  export const inject = []
  export function apply() {}
  ```
- lib/client.js（client，自注册）:
  ```js
  window.__ModuleLoader__.load({
    id: '<插件名>',
    factory: () => ({ inject: [], apply(ctx) {} })
  })
  ```

## 本地安装
```sh
pnpm pack                     # 产出 <name>-<version>.tgz
dsh plugin --profile web add file:<绝对路径>.tgz   # 或 link: 目录
# 重启 DSH 生效
```

## skill 骨架
目录：`skills/<name>/SKILL.md` + `references/*.md`
SKILL.md：YAML frontmatter（name + 第三人称 description）+ 正文 <500 行渐进披露。

## 脚本/自动化
- 脚本放项目 scripts/；可注册为任务看板任务（cron）
- preset：复制 `~/.dsh/.agent-presets/standard` 改（勿改自带）