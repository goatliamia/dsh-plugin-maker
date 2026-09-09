/**
 * Tests for the read-only tool-surface analyzer (`lib/surface-analyze.mjs`).
 *
 * Usage: node --test test/surface.test.mjs
 *
 * The analyzer reads third-party plugin source, so its tests are about
 * *behaviour on inputs it does not control*: literal registrations, dynamic
 * names, declarations it cannot parse, and — most importantly — that it never
 * writes to the directory it analyzes.
 */

import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzePlugin, renderProposal, renderReport } from '../lib/surface-analyze.mjs'

let passed = 0
let failed = 0

function check(name, condition, detail) {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

function equal(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, `expected ${e}, got ${a}`)
}

/** Write a throwaway plugin directory with one source file. */
async function pluginFixture(source) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-analyze-'))
  await mkdir(join(root, 'lib'), { recursive: true })
  await writeFile(join(root, 'lib', 'index.js'), source, 'utf8')
  return root
}

/** Recursively snapshot a directory so a test can prove the analyzer wrote nothing. */
async function snapshot(root) {
  const entries = []
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        entries.push(`${entry.name}/`)
        await walk(full)
      } else {
        const info = await stat(full)
        entries.push(`${entry.name}:${info.size}:${info.mtimeMs}`)
      }
    }
  }
  await walk(root)
  return entries
}

const roots = []
async function fixture(source) {
  const root = await pluginFixture(source)
  roots.push(root)
  return root
}

/* ------------------------------------------------------------------ *
 * 1. literal registrations
 * ------------------------------------------------------------------ */

console.log('\n# 1. literal registrations')

{
  const root = await fixture(`
    import { defineTool } from '@deepseek-ai/dsh-tools'
    export function apply(ctx) {
      ctx.tools.register(defineTool({
        name: 'pdf_extract',
        description: 'Extract raw text from a PDF.',
        parameters: { path: { type: 'string', required: true } },
        output: OUT,
        async execute() { return {} },
      }))
      ctx.tools.register(defineTool({
        name: 'pdf.layout',
        description: 'Compute layout blocks.',
        parameters: { path: { type: 'string' }, mode: { type: 'string' } },
        output: OUT,
        async execute() { return {} },
      }))
      ctx.tools.register(defineTool({
        name: 'pdf_analyze',
        description: 'Analyze a PDF in one call.',
        parameters: { path: { type: 'string' } },
        output: OUT,
        async execute() { return {} },
      }))
    }
  `)

  const report = await analyzePlugin(root)
  equal('every literal tool is found', report.tools.map((tool) => tool.name).sort(), ['pdf.layout', 'pdf_analyze', 'pdf_extract'])
  equal('parameters are read from the spec', report.tools.find((tool) => tool.name === 'pdf.layout').parameters, ['path', 'mode'])
  equal('a verb-only name is primitive-like', report.tools.find((tool) => tool.name === 'pdf_extract').dynamic, false)
  equal('one candidate group is derived', report.candidates.map((candidate) => candidate.group), ['pdf'])
  equal('primitives and operations are separated', [
    report.candidates[0].primitiveLike,
    report.candidates[0].operationLike,
  ], [['pdf_extract', 'pdf.layout'], ['pdf_analyze']])
  check('the candidate carries a question, not a recommendation', report.candidates[0].question.includes('or independent capabilities'), report.candidates[0].question)
}

/* ------------------------------------------------------------------ *
 * 2. dynamic and unparseable input
 * ------------------------------------------------------------------ */

console.log('\n# 2. dynamic and unparseable input')

{
  const root = await fixture(`
    export function apply(ctx) {
      for (const kind of ['a', 'b']) {
        ctx.tools.register(defineTool({
          name: \`dyn_\${kind}\`,
          description: 'dynamic',
          parameters: {},
          output: OUT,
          async execute() { return {} },
        }))
      }
      ctx.tools.register(defineTool({
        name: 'plain_one',
        description: 'no parameters spec at all',
        output: OUT,
        async execute() { return {} },
      }))
    }
  `)

  const report = await analyzePlugin(root)
  const dynamic = report.tools.find((tool) => tool.name === 'dyn_${kind}')
  check('a template name is reported as dynamic, not guessed', dynamic !== undefined && dynamic.dynamic === true, JSON.stringify(report.tools))
  equal('a dynamic group yields no candidate', report.candidates, [])
  equal('a missing parameters spec is reported as dynamic, not empty', report.tools.find((tool) => tool.name === 'plain_one').parameters, undefined)
}

/* ------------------------------------------------------------------ *
 * 2b. the wrapper shape (regression: a real plugin registered nothing)
 * ------------------------------------------------------------------ */

console.log('\n# 2b. tools registered through a local wrapper')

{
  // Real shape from dsh-trajectory-tools: the plugin builds a local
  // `register(spec)` wrapper that calls defineTool internally, then passes
  // object literals to it. A `defineTool(`-only scan finds nothing here.
  const root = await fixture(`
    export function apply(ctx) {
      const register = (spec) => { ctx.tools.register(defineTool(spec)) }
      register({
        name: 'trajectory_find',
        description: 'Find events by literal substring.',
        parameters: { session: { type: 'string' }, query: { type: 'string' } },
        output: OUT,
        async execute() { return {} },
      })
      register({
        name: 'trajectory_window',
        description: 'Read a window of events.',
        parameters: { session: { type: 'string' }, from: { type: 'integer' }, to: { type: 'integer' } },
        output: OUT,
        async execute() { return {} },
      })
    }
  `)
  const report = await analyzePlugin(root)
  equal('wrapper-registered tools are found', report.tools.map((tool) => tool.name).sort(), ['trajectory_find', 'trajectory_window'])
  equal('their parameters are read', report.tools.find((tool) => tool.name === 'trajectory_window').parameters, ['session', 'from', 'to'])
  equal('they form a candidate group', report.candidates.map((candidate) => candidate.group), ['trajectory'])
  // An unrelated object literal with a name but no parameters must not match.
  const noise = await fixture(`
    export function apply(ctx) {
      const config = { name: 'not-a-tool', description: 'config object' }
      ctx.logger.info(config)
    }
  `)
  equal('a name-only object is not mistaken for a tool', (await analyzePlugin(noise)).tools, [])
}

/* ------------------------------------------------------------------ *
 * 3. existing capability declarations
 * ------------------------------------------------------------------ */

console.log('\n# 3. existing capability declarations')

{
  const root = await fixture(`
    export function apply(ctx) {
      const capabilities = ctx.get('capabilities')
      capabilities?.register({
        id: 'doc',
        description: 'already declared',
        operations: [{ name: 'read', description: 'Read a doc.', steps: [{ tool: 'doc_read' }] }],
      })
    }
  `)
  const report = await analyzePlugin(root)
  equal('an optional-chained declaration is found', report.capabilities.map((entry) => [entry.id, entry.operations]), [['doc', ['read']]])
}

/* ------------------------------------------------------------------ *
 * 4. no tools at all
 * ------------------------------------------------------------------ */

console.log('\n# 4. plugin with no tools')

{
  const root = await fixture(`export function apply(ctx) { ctx.logger.info('nothing here') }`)
  const report = await analyzePlugin(root)
  equal('no tools found', report.counts.tools, 0)
  equal('no candidates', report.candidates, [])
  const markdown = renderReport(report)
  check('the report says so instead of failing', markdown.includes('No statically visible'), markdown.slice(0, 200))
}

/* ------------------------------------------------------------------ *
 * 5. read-only guarantee
 * ------------------------------------------------------------------ */

console.log('\n# 5. the analyzer writes nothing')

{
  const root = await fixture(`
    export function apply(ctx) {
      ctx.tools.register(defineTool({ name: 'x_read', description: 'x', parameters: {}, output: OUT, async execute() { return {} } }))
      ctx.tools.register(defineTool({ name: 'x_write', description: 'x', parameters: {}, output: OUT, async execute() { return {} } }))
    }
  `)
  const before = await snapshot(root)
  const report = await analyzePlugin(root)
  renderReport(report)
  renderProposal(report.candidates[0])
  const after = await snapshot(root)
  equal('directory contents and mtimes are unchanged', after, before)
  equal('the source file is unchanged', await readFile(join(root, 'lib', 'index.js'), 'utf8'), `
    export function apply(ctx) {
      ctx.tools.register(defineTool({ name: 'x_read', description: 'x', parameters: {}, output: OUT, async execute() { return {} } }))
      ctx.tools.register(defineTool({ name: 'x_write', description: 'x', parameters: {}, output: OUT, async execute() { return {} } }))
    }
  `)
}

/* ------------------------------------------------------------------ *
 * 6. proposal shape
 * ------------------------------------------------------------------ */

console.log('\n# 6. proposal is a review artefact, not a patch')

{
  const root = await fixture(`
    export function apply(ctx) {
      ctx.tools.register(defineTool({ name: 'doc_read', description: 'x', parameters: {}, output: OUT, async execute() { return {} } }))
      ctx.tools.register(defineTool({ name: 'doc_write', description: 'x', parameters: {}, output: OUT, async execute() { return {} } }))
    }
  `)
  const report = await analyzePlugin(root)
  const proposal = renderProposal(report.candidates[0])
  check('proposal is marked as needing review', proposal.includes('PROPOSAL'), proposal.slice(0, 120))
  check('proposal keeps TODO markers instead of inventing semantics', (proposal.match(/TODO/g) ?? []).length >= 3, proposal)
  check('proposal names the facade service', proposal.includes('ctx.capabilities.register'), proposal)
  check('proposal lists the grouped tools as steps', proposal.includes("tool: 'doc_read'") && proposal.includes("tool: 'doc_write'"), proposal)
}

/* ------------------------------------------------------------------ *
 * cleanup + summary
 * ------------------------------------------------------------------ */

for (const root of roots) await rm(root, { recursive: true, force: true })

console.log(`\n${failed === 0 ? 'OK' : 'FAILED'} — ${passed} passed, ${failed} failed`)
process.exitCode = failed === 0 ? 0 : 1
