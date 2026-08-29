---
title: checklistFor 匹配方向反了，长输入返回开工清单
date: 2026-08-28
status: fixed
---

# checklistFor 匹配方向反了，长输入返回开工清单

## Problem 现象
`plugin_maker_checklist` 对非精确输入全部落回开工清单：「改文件」「废文档」返回开工清单（应为对应清单）；「我要发一个版本」返回自身而非发版本清单；fallback 显示无意义的任务名。复现：`checklistFor('改文件')` → 「开工」。

## Root Cause 根因
① 匹配方向写反：`String(taskType).includes(k)`（输入包含键名）应为双向（键包含输入 or 输入包含键）——短输入（改文件）永远无法包含长键名（改文件/改代码）。② fallback 的 type 用了原始输入而非统一「开工」。当时没防住：没写测试直接装，靠验收撞出来。

## Correct Pattern 正确做法
`checklistFor` 顺序：精确命中 → 键包含输入 → 输入包含键 → fallback 恒「开工」（maker 0.3.10）。字符串匹配先想清楚「谁包含谁」，写进测试再上线。

## Regression 回归
`test/checklists.test.mjs` 8 用例全绿；实机重启后复验「改文件/废文档/我要发版本」三型命中。
