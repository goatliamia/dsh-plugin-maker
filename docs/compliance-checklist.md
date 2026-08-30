# 发布前合规检查清单（投影版）

> 真源=机器检查：`plugin_maker_check`（规则见 lib/index.js，逐条证据见 docs/upstream-doc-absorption.md §2）+ release.mjs 安全闸 + 条款表。本文件是人读投影，逐项标注机制；机制更新以真源为准，本文件不新增约束。
> 来源：2026-08-27 dsh-quick-approve 0.1.0 翻车的教训，现已全部机制化（2026-08-30 审计标注）。

## 协议（真源：plugin_maker_check 规则 #1-#6）

- [ ] client bundle 用自注册格式: window.__ModuleLoader__.load({ id, factory: (require) => ({ inject, apply }) })（#3 client 自注册）
- [ ] 注册 id 与 cordis.patch.yml 行 id 完全一致（#4 client 注册 id = 包名）
- [ ] 禁止 client.js 用 CommonJS 裸导出 (加载器 import 后找不到注册, 报 "loaded without registering")（#5 exports ./package.json 缺失=客户端行静默不装载）
- [ ] host 半按官方三形态 (export function apply / export default 对象 / extends Service)（#6 host 入口形态）

## 结构（真源：plugin_maker_check 结构类规则）

- [ ] package.json: dsh.bundle.patch → cordis.patch.yml; dsh.client 声明 platform: web + inject（#1 dsh.bundle.patch + dsh.client 形状规则）
- [ ] cordis.patch.yml: - insert 单行挂载 (id + name 与包名一致)（#2 insert 层）
- [ ] files 字段含 lib / cordis.patch.yml / README（files 清单检查）

## 流程（真源：release.mjs 安全闸 + 条款表「发版本」）

- [ ] 每次修复 bump 版本 (file: tarball 文件名含版本, 否则 pnpm 不更新)（release.mjs 自动 bump）
- [ ] 装完必须重启 DSH, 且明确告知用户（条款表「发版本」第 5 条）
- [ ] 打包前 grep 自查: 无 fetch/eval/外发; 依赖仅官方包（release.mjs 安全闸 + #15 密钥自查）
