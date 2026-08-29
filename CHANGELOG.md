# Changelog

## 0.6.6 — Reword the wizard roadmap note (2026-08-30)

- README (zh/en) and the standalone guide: the "known gap" note no longer reads like internal implementation notes (self-registration stub / native card reuse). It now states it in user terms: the wizard ships as a skill with card conclusions and yes/no confirmations, no extra UI needed; an interactive form-card wizard is on the roadmap.

## 0.6.5 — Absorb the official docs; calibrate check rules (2026-08-30)

- Read the official plugin docs at `dsh-v0.1.1-rc.2` (cordis-tutorial 7 chapters, cookbook 9 recipes, capability-seams) and archived the three-layer classification plus the rule-by-rule comparison in `docs/upstream-doc-absorption.md` — every check rule now states its evidence source (runtime code / official docs) and its upstream watch hook.
- Check: added `dsh.client` declaration validation (object shape, string `platform`, string-array `inject`/`external`) and the `exports["./client"]` requirement for client packages (both runtime-verified against `dsh-client-modules`); the host entry check now accepts the official Service-class form alongside `export function apply`.
- Vet: added a `dsh.client` shape fix and reworded the host-entry fix to the official three plugin forms.
- Wizard: the fulfillment-path ① check now points at the official cordis-tutorial first (docs are the trailhead, runtime is the evidence); new `references/official-docs.md` index.
- README (zh/en): repositioned — the official docs already join the methodology together; maker is the mechanization of the tutorial, not a replacement for it.

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
