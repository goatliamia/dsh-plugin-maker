---
title: upstream-watch --apply 开 issue 恒 401（POST headers 整体替换丢掉 authorization）
date: 2026-08-30
status: fixed
---

# upstream-watch --apply 开 issue 恒 401

## Problem 现象
`node scripts/upstream-watch.mjs` dry-run 正常（GET 都带 auth），`--apply` 开到 issue 的 POST 恒报 `HTTP 401 Requires authentication`——上游 0.1.2 的告警从未落地成 issue，cron 也从没跑过（repo 公开当天，零次 workflow runs），上游变动零感知。

## Root Cause 根因
`gh()` 里 `fetch(url, Object.assign({ headers }, init))`：`init` 自带 `headers: { 'content-type': 'application/json' }` 时，`Object.assign` 把整个 headers 对象**替换**成 init 的 headers，默认的 `authorization/accept/user-agent` 全丢。GET 调用不带 init.headers 所以正常，POST 必 401。当时没防住：脚本零测试、只在 dry-run 路径验过。

## Correct Pattern 正确做法
请求头必须**合并**而非覆盖：`const headers = { ...默认, ...(init && init.headers) }` 后再拼进 fetch init。带 POST 的脚本要有一条「真实写路径」冒烟（哪怕一次 --apply），dry-run 通过 ≠ 写路径通过。

## Regression 回归
修后重跑 `--apply`：两个上游 issue 均成功开出（deepseek-harness 0.1.2-alpha.2 + better-sidebar v0.18.0-alpha.0），upstream.json pin 更新并推送。cron 从周更改日更（没变化=零 issue 零提交，去重+pin 前移保证静默）。
