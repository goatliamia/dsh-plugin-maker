# Changelog

## 0.6.2 — Narrow the research skill trigger (2026-08-29)

- `five-step-research` no longer fires on bare trigger words like "调研/调查": its scope is now feasibility research before building something, and it explicitly excludes plain fact-checking ("does doc X exist", "is Y true") — those get answered directly, not through the five steps.

## 0.6.1 — Maintenance sync (2026-08-29)

- Upstream watch: add `packages/tools` (tool registry / pre-execute / post-execute / restrict contract) and `packages/webserver` (host route contract) hook points; hook-point table in `docs/upstream-watch.md` synced to v1.2.
- Wizard reference: the automation-task form now points to the bridge-owned task board (five columns, official apiProxy dispatch; cron scheduling not yet available). The third-party task board this project previously used has been retired.

## 0.6.0 — Initial public release (2026-08-29)

First public release of dsh-plugin-maker — the DeepSeek Harness plugin workshop.

- **Six tools**: `plugin_maker_scaffold` (compliant skeleton generation), `plugin_maker_check` (contract + publish compliance + upgrade baseline + secret scan), `plugin_maker_vet` (third-party plugin examination with actionable fix list), `plugin_maker_adopt` (auto-apply safe fixes), `plugin_maker_checklist` (task action checklists), `plugin_maker_impact` (reference scanning).
- **Two bundled skills**: `/plugin-studio-wizard` (needs-first wizard: clarify the need → fulfillment path check → build only real gaps) and `/five-step-research` (categorized feasibility research), registered natively and `/`-triggerable.
- **Tool result cards**: every tool renders as a native generic card in the GUI.
- **Upstream watch**: declared hook points against the official DSH repository, weekly diff → automatic issues.
- **Standalone packaging**: no hard dependencies; collaboration-checklist entries hide automatically when companion plugins are absent.
- **Docs**: bilingual README, standalone guide, compliance checklist, upstream-watch guide, bug archive (four-section knowledge projection), positioning manifesto.

See [docs/manifesto.md](docs/manifesto.md) for the full positioning.
