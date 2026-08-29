---
title: check 自检误报「host 读 ctx.config」（检测正则命中自己的说明文字）
date: 2026-08-29
status: fixed
---

# check 自检误报「host 读 ctx.config」

## Problem 现象
对 dsh-plugin-maker 仓库自身跑 `plugin_maker_check`，「host 代码绝不读 ctx.config」项报 ❌——lib/index.js 实际从未访问 ctx.config。自检假阳性：发版本闸门要求 check 全绿，误报卡住发布流程，也会误导其他插件作者。复现：`plugin_maker_check(targetDir = 本仓库)` → 该行 ❌。

## Root Cause 根因
检测正则 `/ctx\s*\.\s*config\b/` 对宿主入口全文匹配；check 工具自己的输出说明文字里含字面 "ctx.config"，自检时正则命中了自己的文案。

## Correct Pattern 正确做法
检测正则收紧为真实访问形态 `/ctx\.config\s*[.(\[]/`（后面必须紧跟属性/调用/下标），说明文案与清单文本不再误命中，真实读取仍被抓。检测文案里别嵌工具自己会匹配的字面量——写正则前先想「这段文案会被哪个正则扫到」。

## Regression 回归
`plugin_maker_check` 自检该行转 ✅；`node --test` 全绿。
