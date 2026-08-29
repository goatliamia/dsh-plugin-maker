# 发布前合规清单（第四步，自建路径内）

> 详见 ../../docs/compliance-checklist.md。交付前逐项核对。
> **强度按前置问分级**：自用（满足需求/享受创造）→ 松（不发布，只保结构能跑）；给别人用 → 严（全项核对 + 密钥/外发审查）。

## 协议

- client bundle 必须自注册：`window.__ModuleLoader__.load({ id, factory: () => ({inject, apply}) })`；id 与 patch 行一致
- 禁止 client.js 用 CommonJS 裸导出（会报 loaded without registering）
- host 半用 ESM（export const inject / export function apply）

## 结构

- package.json：`dsh.bundle.patch` → cordis.patch.yml；`dsh.client` 声明 platform: web + inject
- cordis.patch.yml：`- insert` 单行挂载（id + name 与包名一致）
- files 含 lib / cordis.patch.yml / README

## 流程

- 每次修复 bump 版本（file: tarball 文件名含版本，否则不更新）
- 装完必须重启 DSH 生效
- 打包前 grep：无 fetch/eval/外发；依赖仅官方包
- 第三方插件先审查再装（Host 有完整 Node 权限）——审查看：外发面（fetch/心跳/遥测）、spawn 面、宿主权限使用

## Windows 已知坑

- PS5.1 `Set-Content -Encoding UTF8` 给 JSON 加 BOM → dsh JSON.parse 崩；一律 `[IO.File]::WriteAllText + UTF8Encoding($false)`
- 请求体发中文必须 UTF-8 字节，否则变 ?

## 原生优先检查（第 0 项，最重要）

- [ ] 这个需求 DSH 原生能力/现有组件能满足吗？（任务执行/开新会话/落板/状态同步…）——能 → 复用，不开发。

## 开发前读契约（步骤，非兜底）

- 写 tool 参数前：**先读 schema 契约**（cordis_inspect Tool / 现成插件源码的参数写法）。
- 参数格式：必填字段 `required: true`；可选字段**省略 required 属性**（不写 `required: false`）。
- 同理：client bundle 自注册格式、host ESM 等，动手前先读协议，不凭记忆。
