# dsh-plugin-maker — The Plugin Workshop

[中文](./README.md) | English

> **Everything is a plugin — but not everyone is a plugin developer.** This workshop exists to close that gap.
> **First judge what deserves to be a plugin.** That is its first principle in everything it does.

## Why it exists

DeepSeek Harness is built on "Everything is a Plugin": capabilities can be composed, replaced and extended. But freedom has a cost — plugin-ification moves work the platform used to own onto the user:

- What is the actual need?
- Does the Harness already support it natively?
- Does the ecosystem already have a plugin for it?
- What exactly is this interface now? Which parts are fixed contracts?
- Will this plugin keep working after the next DSH update?

For a human developer these are just engineering chores. For an Agent, they mean paying the same cognitive cost again every single time:

```
read docs → read source → find examples → guess API → write a bit → run → fail → search again → retry
```

Why should every Agent pay this cost all over again?

The official docs have actually already joined the methodology together: `docs/cordis-tutorial` (a seven-chapter from-scratch tutorial), `docs/cookbook` (practical recipes) and `docs/capability-seams` (the full capability-seam map). But a tutorial teaches "how to write" — it does not keep watch over "what exactly is this interface right now" for you. Contract changes, easy-to-hit pitfalls and publish gates still get re-stepped-on by every Agent individually.

**Maker's differentiation is not writing the tutorial again — it is mechanizing the tutorial**: tutorial contracts → check rules, the skeleton → scaffold templates, installation steps → vet/adopt, the official doc map → wizard references. It manages the engineering cost that plugin-ification freedom brings — not just helping an AI write plugins, it cares more about: should this thing become a plugin at all?

## Core principles

**① Reuse before invent — before writing anything, ask once: do we really need to write it?**

```
Already installed? → In the ecosystem? → Native to DSH? → A more mature pattern in the industry? → Only then: is it worth building?
```

The most common disease of open ecosystems is more and more plugins while the actually-needed capabilities stay unclear. So sometimes Maker's most important output is not "here is a new plugin" — it is: **"Don't build it. The foundation already solves it."** A good dev tool must not only tell an Agent *how* to do things, but also let it clearly say *not needed*.

**② The model handles what needs judgment; deterministic mechanisms handle what does not deserve to consume model intelligence.**

Fixed directory structures, entry forms, export requirements, bundle configs, verified API contracts — if the model regenerates these freely every time, every time is a new chance to get them wrong. Hence:

| Mechanism | What it does |
|---|---|
| **Scaffold** | Generates a verified skeleton instead of guessing from an empty directory |
| **Check** | Turns known Harness contracts into static checks |
| **Vet** | Examines third-party plugins before wiring them in and trial-erroring |
| **Adopt** | Auto-applies the small set of safe, deterministic fixes |
| **Impact** | Scans references before a change, removing "I don't think I affected anything else" guesswork |
| **Upstream** | DSH is still moving fast — watch the official hook points, get an automatic alert when they change, never assume today's working plugin works tomorrow |

None of this is invented from nothing: scaffolds, static checks, codemods, dependency updates and impact analysis are all mature software-engineering precedents. What is genuinely interesting is that they are now being placed inside an **Agent Harness that can act on its own**. Traditional engineering assumes "the human knows what to do; the tool just makes it faster." Agent engineering adds a new problem: **the Agent itself must be kept on the correct engineering path.** That is what Maker tries to solve: not making the model smarter, but reducing the chances that an unreliable environment strips away abilities it already has.

## Usage

1. **Generate**: `plugin_maker_scaffold` — plugin name + one-line description in, a compliant skeleton out.
2. **Validate**: `plugin_maker_check` — contracts (bundle/self-registration/id=package-name/required), publish compliance, upgrade baseline, ✅/❌ at a glance.
3. **Install**: `pnpm pack` + `dsh plugin --profile web add`.

**Wizards**: two bundled skills (available from the `/` slash menu; the model also auto-invokes them by trigger words). The GUI renders them natively as "Skill row → Instructions card":

- `/plugin-studio-wizard` — needs-first wizard: understand the need (two upfront questions: who is it for × why build) → fulfillment path check (already installed → ecosystem → build). Recommends existing solutions instead of building when possible; only true gaps go to build (form derivation → research → plan & compliance → delivery). Judgment belongs to the wizard, approval to the user.
- `/five-step-research` — categorized research (platform capability / same ecosystem / industry reference / engineering practice / need validation).

## Standalone use

maker is a pure development-time tool: all six tools and two skills have no hard dependencies and work standalone. Collaboration entries in the checklists (cross-session coordination, lesson-capture guidance) hide automatically when the corresponding companion plugins are not installed. See `docs/standalone.md`.

## Why open source now

Maker has finished its own decoupling: it was once deeply coupled with some of its author's companion mechanisms; now the boundaries are clear and it can be installed and used standalone. Continued solo development yields little new information — what it needs next is not more ideas from its author, but: **how will strangers actually use it?** Do they need Scaffold, Check, Vet, Research most — or something nobody expected? Only a real ecosystem can answer.

So this open-sourcing is not "Maker is finished." It is: **the internal experiment is over; the external experiment begins.**

## Known gaps and roadmap

- Most mature today: the plugin form (generate + validate + wizards); workflow / script / skill / preset forms are derived by the wizard from the need — no form menus.
- Interactive wizard card UI unfinished (`lib/client.js` is a self-registration stub): report cards reuse native tool cards and confirmation gates reuse `ask_user_question`; a graphical form-card UI is on the roadmap.

## Layout

- `lib/` — tools (scaffold + check + vet/adopt + checklist + impact)
- `docs/` — knowledge base (standalone use, compliance checklist, UX principles, upstream watch, bug fix archive)
- `skills/` — the wizard skill + the research skill

## Status

v0.6.5 (2026-08-30: full absorption & calibration against the official docs; first public release 0.6.0)

## Install

```
pnpm pack && dsh plugin --profile web add file:<path-to-this-dir>/dsh-plugin-maker-<version>.tgz
```
