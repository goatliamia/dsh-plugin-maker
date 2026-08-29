# dsh-plugin-maker — Agent Guide

Repository guide for AI agents (DSH / Copilot / Cursor / …) working on this codebase. Humans, read [README.md](./README.md) instead.

## What this repo is

A DeepSeek Harness plugin workshop: six tools (scaffold / check / vet / adopt / checklist / impact) and two bundled skills (plugin-studio-wizard, five-step-research). Positioning and principles live in README and [docs/manifesto.md](./docs/manifesto.md).

## Before changing code

- Read the contract first: tool schemas, client self-registration format, host ESM — verify against the runtime or existing source, never from memory.
- Baseline: `node --test test/` must be green before you start.
- Reuse before invent: check native DSH capability and existing ecosystem plugins first; only fill real gaps.

## After changing code

- `node --check` on every touched file + full `node --test test/` green.
- Bug fixes ship in the same commit as their `docs/bugs/` archive entry — four sections only (Problem / Root Cause / Correct Pattern / Regression), final knowledge, no trial-and-error history. GitHub Issue is the process source of truth; docs/bugs holds only "next person will hit this too" cases.

## Releases

Follow the fixed release flow (`release.mjs`, lives outside this repo):

```
node <path-to>/release.mjs <this-dir> <patch|minor|none> <feat|fix|docs|chore> <one-line summary>
```

It runs safety gate → bump → pack → install into the web profile → commit → push → tag → GitHub Release, failing loudly at any step. Before releasing, keep the previous version's tgz in the repo root — the profile's `file:` dependency points at it. After bumping a host plugin, remind the user that a DSH restart is needed.

## Conventions

- Commit messages are public-facing: feat/fix/docs/chore + a neutral summary, no internal jargon.
- `upstream.json` declares the official hook points; when it changes, sync `docs/upstream-watch.md` in the same commit.
- Standalone-first: the package must work with no companion plugins installed; collaboration-checklist entries hide automatically when their companions are absent.
