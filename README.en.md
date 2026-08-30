# dsh-plugin-maker

[中文](./README.md) | English

> **Everything is a Plugin, but not everyone is a plugin developer.** Maker exists to handle the other half.
>
> **Before building a plugin, ask whether it needs to exist at all.**

`dsh-plugin-maker` is a toolkit for developing plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

It does not decide what a plugin should be. Instead, it helps answer a few practical questions before development begins:

* Is this already supported by DSH?
* Is there an existing plugin that can be reused?
* Does this actually need to be a plugin?
* What does this interface really look like today?
* Which parts are established contracts?
* After a DSH upgrade, which parts actually need to be re-verified?

**Maker focuses on reducing the repeated engineering cost of plugin development.**

---

## Why Maker

One of the core ideas of DSH is:

> **Everything Is a Plugin.**

Capabilities can be composed, replaced, and extended.

But greater freedom also moves more engineering work onto developers.

A seemingly simple plugin may require:

```text
Understand the requirement
→ check the DSH docs
→ inspect the source
→ find existing implementations
→ understand the interface
→ create the skeleton
→ implement
→ verify
→ package
→ install
→ verify again
```

When these steps are repeated from scratch, both developers and agents pay the same costs again and again.

DSH already provides a strong set of tutorials, cookbooks, and capability-seam documentation. They mostly answer:

> **“How do I use DSH?”**

Maker focuses on a slightly different question:

> **“How do I turn those established practices into repeatable development workflows?”**

---

## Core Ideas

### 1. Reuse before invent

Before writing code, check:

```text
Existing local capability
↓
Existing ecosystem plugin
↓
Native DSH capability
↓
Mature engineering practice
↓
Only then: build it yourself
```

Sometimes the most useful answer Maker can give is not:

> “Here is a new plugin.”

but:

> **“You do not need to build this.”**

If an existing solution only covers part of the requirement, the preferred approach is:

> **Reuse what already works and build only the missing part.**

---

### 2. Let deterministic mechanisms handle deterministic engineering work

Some tasks are not worth asking a model to rediscover every time.

For example:

* plugin directory structure;
* entry-point formats;
* bundle configuration;
* exports;
* registration patterns;
* verified DSH contracts;
* release requirements.

These are better expressed as:

> **Repeatable, machine-verifiable engineering operations.**

Maker therefore provides:

| Tool        | Purpose                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `scaffold`  | Generate a verified minimal plugin skeleton                                     |
| `check`     | Validate plugin contracts, release requirements, and known compatibility issues |
| `vet`       | Inspect an existing plugin before adopting it                                   |
| `adopt`     | Apply a small set of safe, deterministic changes automatically                  |
| `impact`    | Scan references and estimate the impact of a change                             |
| `checklist` | Turn confirmed development actions into executable checks                       |

---

### 3. Watch only what the plugin actually depends on

DSH is evolving quickly.

A plugin may depend on only a small number of runtime, package, or client surfaces.

Maker therefore does not try to treat every DSH change as equally relevant:

```text
Actual plugin dependencies
↓
Declare relevant upstream anchors
↓
Watch upstream changes
↓
If an anchor changes
↓
Re-verify the relevant part
```

The goal is not:

> “What changed everywhere in DSH?”

but:

> **“What changed that might actually affect this plugin?”**

---

## Included Skills

### `/plugin-studio-wizard`

A guided workflow for plugin requirements.

It starts with:

```text
Existing local capability?
↓
Existing ecosystem solution?
↓
Native DSH support?
↓
Does this really need to be built?
```

Only when a new implementation is actually needed does it move into the implementation path.

The wizard assists with the decision; it does not replace the developer's final authorization.

### `/five-step-research`

A lightweight research workflow for plugin development:

```text
Platform capabilities
→
Ecosystem solutions
→
Industry references
→
Engineering practice
→
Requirement validation
```

Use it to quickly determine whether something is actually worth building before implementation starts.

---

## Usage

### Scaffold a plugin

```text
plugin_maker_scaffold
```

Provide a plugin name and a short description to generate a minimal DSH-compatible skeleton.

### Check a plugin

```text
plugin_maker_check
```

Checks:

* plugin contract;
* bundle / exports;
* registration;
* release requirements;
* known migration facts;
* compatibility baseline.

### Vet an existing plugin

```text
plugin_maker_vet
```

Inspects an existing plugin and reports:

* current contract status;
* potential risk points;
* relevant DSH surfaces;
* suggested attachment points;
* areas that may need review.

### Apply safe changes

```text
plugin_maker_adopt
```

Applies only changes that are already known to be safe, deterministic, and verifiable.

### Analyze change impact

```text
plugin_maker_impact
```

Before deleting a document, renaming something, changing an interface, or modifying semantics, scan references first to reduce accidental omissions.

### Run the development checklist

```text
plugin_maker_checklist
```

Turns already-confirmed development actions into a repeatable checklist so they do not have to be remembered from scratch every time.

---

## An Important Boundary

Maker is **not an automatic plugin generator**.

It does not try to do:

```text
Requirement
→ automatically decide everything
→ automatically design the architecture
→ automatically write the entire plugin
```

Instead:

```text
Requirement
↓
Decide whether it needs to exist
↓
Check existing capabilities
↓
Reduce the problem to what is actually missing
↓
Automate deterministic engineering work
↓
Leave open-ended decisions to the developer
```

Maker is therefore not primarily about:

> **Giving an agent more decisions to make.**

It is about:

> **Reducing the repeated engineering cost around decisions that have already been made.**

---

## Standalone Use

Maker can run independently.

All six tools and both Skills work without requiring other collaboration plugins.

`check` and `vet` work with arbitrary plugin directories, not only plugins generated by Maker.

Collaboration-related actions are automatically hidden when the corresponding collaboration capability is not installed.

Upstream watching runs daily by default; when nothing changes, it produces no additional output.

See:

* [`docs/standalone.md`](./docs/standalone.md)
* [`docs/upstream-watch.md`](./docs/upstream-watch.md)

for more details.

---

## Why Open Source Now

Maker originally had deeper coupling with several internal collaboration mechanisms.

After continued separation, its boundaries are now clear enough for independent use as a DSH development tool.

Keeping it entirely inside one environment would also make it harder to learn what should happen next.

The next important question is:

> **How will unfamiliar developers actually use it?**

Will they need:

* Scaffold?
* Check?
* Vet?
* Research?
* Impact?
* Or something we have not thought of yet?

Only the real plugin ecosystem can answer that.

So:

> **This release does not mean Maker is finished. It means the internal experimentation phase is ending and external use is beginning.**

---

## Current Status

The current version is defined by the GitHub tags.

The project currently covers:

* plugin scaffolding;
* plugin contract checks;
* third-party plugin vet / adopt;
* impact analysis;
* development checklists;
* upstream dependency watching;
* plugin development guidance;
* lightweight research workflows.

Known DSH migration facts are continuously added and verified through source inspection, documentation, and real runtime behavior.

---

## Installation

```bash
pnpm pack
dsh plugin --profile web add file:<path-to-this-directory>/dsh-plugin-maker-<version>.tgz
```

---

## Directory

```text
lib/
  tool implementations

skills/
  development wizard
  research skill

docs/
  standalone usage
  engineering conventions
  upstream watching
  issues and fix records
```

---

## One Sentence

> **DSH provides the freedom of plugins; Maker reduces the engineering cost of using that freedom.**

It is not trying to create more plugins.

It is trying to make the plugins that are actually worth creating easier to build, verify, and maintain.
