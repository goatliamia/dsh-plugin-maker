# 发布前合规检查清单

> 2026-08-27 dsh-quick-approve 0.1.0 翻车的教训。自研插件打包前逐项核对。

## 协议
- [ ] client bundle 用自注册格式: window.__ModuleLoader__.load({ id, factory: (require) => ({ inject, apply }) })
- [ ] 注册 id 与 cordis.patch.yml 行 id 完全一致
- [ ] 禁止 client.js 用 CommonJS 裸导出 (加载器 import 后找不到注册, 报 "loaded without registering")
- [ ] host 半用 ESM (export const inject / export function apply)

## 结构
- [ ] package.json: dsh.bundle.patch → cordis.patch.yml; dsh.client 声明 platform: web + inject
- [ ] cordis.patch.yml: - insert 单行挂载 (id + name 与包名一致)
- [ ] files 字段含 lib / cordis.patch.yml / README

## 流程
- [ ] 每次修复 bump 版本 (file: tarball 文件名含版本, 否则 pnpm 不更新)
- [ ] 装完必须重启 DSH, 且明确告知用户
- [ ] 打包前 grep 自查: 无 fetch/eval/外发; 依赖仅官方包