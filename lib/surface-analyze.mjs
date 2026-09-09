/**
 * Static analyzer for a DSH plugin's model-facing tool surface.
 *
 * It answers one question about a plugin directory:
 *
 *   > Which model-facing tools does this plugin register, which of them look
 *   > like implementation primitives, and what would a semantic operation over
 *   > them look like?
 *
 * It NEVER modifies the target and never claims a tool is useless. Grouping and
 * naming are heuristics; the semantic call ("is this really one operation?")
 * belongs to a model, and the adoption decision belongs to a human.
 *
 * Two findings from the capability-facade experiments shape this tool:
 *   - a facade only pays off when the plugin has STABLE compositions; for most
 *     plugins the honest answer is "do not build one";
 *   - a tool surface can never be narrowed at runtime (DSH resolves
 *     presentation, lookup and dispatch through one visibility resolver), so the
 *     only lever is authoring-time: do not register primitives you do not want
 *     the model to choose between.
 *
 * Deliberately zero-dependency and regex-based: the analyzer must be able to
 * read a third-party plugin before deciding whether it is safe to run anything
 * from it.
 *
 * @module surface-analyze
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/** Source file extensions worth reading. */
const SOURCE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts']
/** Directories that never carry plugin source worth analyzing. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage', 'test', 'tests'])
/** Tool names that read as implementation detail rather than a user-facing operation. */
const PRIMITIVE_HINTS = [
  'extract', 'parse', 'read', 'write', 'render', 'layout', 'ocr', 'fetch', 'list', 'get', 'set',
  'create', 'update', 'delete', 'remove', 'insert', 'append', 'merge', 'split', 'convert',
  'encode', 'decode', 'compress', 'upload', 'download', 'open', 'close', 'scan', 'probe', 'raw',
]
/** Tool names that read as a user-facing operation. */
const OPERATION_HINTS = [
  'analyze', 'analyse', 'inspect', 'review', 'summarize', 'summarise', 'search', 'find', 'locate',
  'modify', 'edit', 'apply', 'transform', 'publish', 'deploy', 'generate', 'compose', 'diagnose',
  'compare', 'diff', 'report', 'explain', 'resolve', 'repair', 'migrate',
]

/** Split a tool name into its namespace parts: `pdf.extract` / `pdf_extract` / `pdf-extract`. */
function nameParts(name) {
  return name.split(/[._-]/).filter((part) => part !== '')
}

/** The group a tool belongs to: the first name part, or '' for a bare name. */
function groupOf(name) {
  const parts = nameParts(name)
  return parts.length > 1 ? parts[0] : ''
}

/** Walk a plugin directory and return source files, skipping build output. */
async function collectSourceFiles(root) {
  const files = []
  async function walk(dir) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full)
      } else if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        files.push(full)
      }
    }
  }
  await walk(root)
  return files.sort()
}

/** Extract a balanced-brace object literal starting at `start` (the index of `{`). */
function balancedObject(text, start) {
  if (text[start] !== '{') return undefined
  let depth = 0
  let quote = null
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (quote !== null) {
      if (char === '\\') index += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return undefined
}

/** Read a simple string property (`name: 'x'` / `"name": "x"`) from an object literal. */
function stringProperty(objectText, key) {
  const pattern = new RegExp(`(?:^|[,{\\s])['"\`]?${key}['"\`]?\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`)
  const match = pattern.exec(objectText)
  return match === null ? undefined : match[2]
}

/** Read a template-literal or concatenated description and flatten it to one line. */
function descriptionOf(objectText) {
  const match = /(?:^|[,{\s])['"`]?description['"`]?\s*:\s*([\s\S]*?)(?=,\s*(?:parameters|output|execute|isConcurrencySafe|presentCall|presentResult|timeoutMs|finalizeContent)\s*:|,\s*['"`]?[A-Za-z_$][\w$]*['"`]?\s*:|})/.exec(objectText)
  if (match === undefined) return ''
  const raw = match[1]
  const literals = [...raw.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/gs)].map((entry) => entry[2])
  const text = literals.length > 0 ? literals.join(' ') : raw
  return text.replace(/\s+/g, ' ').trim().slice(0, 300)
}

/** Top-level parameter names from a `parameters: { … }` spec, when statically readable. */
function parameterNames(objectText) {
  const match = /(?:^|[,{\s])['"`]?parameters['"`]?\s*:\s*/.exec(objectText)
  if (match === null) return undefined
  const body = balancedObject(objectText, match.index + match[0].length)
  if (body === undefined) return undefined
  const names = new Set()
  let depth = 0
  let quote = null
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (quote !== null) {
      if (char === '\\') index += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{' || char === '[' || char === '(') depth += 1
    else if (char === '}' || char === ']' || char === ')') depth -= 1
    else if (depth === 1) {
      const rest = body.slice(index)
      const key = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(rest)
      if (key !== null) {
        names.add(key[1])
        index += key[0].length - 1
      }
    }
  }
  return [...names]
}

/**
 * Find every statically visible tool definition in one source file.
 *
 * Two shapes are recognized, because real plugins use both:
 *   1. `defineTool({ name, … })` — the direct call.
 *   2. a spec object handed to a local wrapper (`register({ name, description,
 *      parameters, output, execute })`), which is how a plugin that wants
 *      conflict handling usually registers tools. Requiring `parameters` as
 *      well as `name` keeps this pass from matching unrelated config objects.
 *
 * A name containing `${…}` is reported as dynamic, never guessed — the analyzer
 * does not invent identifiers.
 * @returns {Array<object>} tool records.
 */
function findToolDefinitions(text, file) {
  const found = []
  const seen = new Set()
  const push = (objectText, index, rawName) => {
    if (rawName === undefined) return
    const key = `${rawName}@${index}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({
      name: rawName,
      dynamic: /\$\{/.test(rawName),
      description: descriptionOf(objectText),
      parameters: parameterNames(objectText),
      file,
      line: text.slice(0, index).split('\n').length,
    })
  }

  // Shape 1: defineTool({ … }) / harness.defineTool({ … })
  const direct = /(?:harness\s*\.\s*)?defineTool\s*\(\s*\{/g
  let match
  while ((match = direct.exec(text)) !== null) {
    const start = text.indexOf('{', match.index)
    const objectText = balancedObject(text, start)
    if (objectText === undefined) continue
    push(objectText, match.index, stringProperty(objectText, 'name'))
  }

  // Shape 2: a tool-shaped object literal passed to some wrapper call.
  const candidate = /([A-Za-z_$][\w$]*)\s*\(\s*\{/g
  while ((match = candidate.exec(text)) !== null) {
    if (match[1] === 'defineTool') continue
    const start = text.indexOf('{', match.index)
    const objectText = balancedObject(text, start)
    if (objectText === undefined) continue
    const name = stringProperty(objectText, 'name')
    if (name === undefined) continue
    if (parameterNames(objectText) === undefined) continue
    push(objectText, match.index, name)
  }

  return found
}

/** Find capability declarations — `ctx.capabilities.register({…})` and optional-chained forms. */
function findCapabilityDeclarations(text, file) {
  const found = []
  const pattern = /capabilities\s*\??\.\s*register\s*\(\s*\{/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const start = text.indexOf('{', match.index)
    const objectText = balancedObject(text, start)
    if (objectText === undefined) continue
    const id = stringProperty(objectText, 'id')
    if (id === undefined) continue
    const operationNames = [...objectText.matchAll(/(?:^|[,{\s])['"`]?name['"`]?\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)]
      .map((entry) => entry[2])
      .filter((name) => !/\$\{/.test(name))
    found.push({ id, operations: operationNames, file, line: text.slice(0, match.index).split('\n').length })
  }
  return found
}

/** `pdf_extract` → looks like a primitive? `pdf` → which group? */
function classify(tool) {
  const last = nameParts(tool.name).at(-1)?.toLowerCase() ?? ''
  if (OPERATION_HINTS.includes(last)) return 'operation-like'
  if (PRIMITIVE_HINTS.includes(last)) return 'primitive-like'
  return 'unclassified'
}

/**
 * Analyze one plugin directory.
 *
 * @param {string} root - plugin directory (the package root, not `lib/`).
 * @returns {Promise<object>} a read-only report; nothing is written.
 */
export async function analyzePlugin(root) {
  const info = await stat(root).catch(() => undefined)
  if (info === undefined || !info.isDirectory()) throw new Error(`analyze: not a directory: ${root}`)

  const files = await collectSourceFiles(root)
  const tools = []
  const capabilities = []
  const scanned = []
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    scanned.push(relative(root, file).split(sep).join('/'))
    tools.push(...findToolDefinitions(text, relative(root, file).split(sep).join('/')))
    capabilities.push(...findCapabilityDeclarations(text, relative(root, file).split(sep).join('/')))
  }

  const groups = new Map()
  for (const tool of tools) {
    const group = groupOf(tool.name)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push({ ...tool, kind: tool.dynamic ? 'dynamic' : classify(tool) })
  }

  const candidates = []
  for (const [group, members] of groups) {
    if (group === '' || members.length < 2) continue
    if (members.some((member) => member.dynamic)) continue
    const primitives = members.filter((member) => member.kind !== 'operation-like')
    const operations = members.filter((member) => member.kind === 'operation-like')
    candidates.push({
      group,
      tools: members.map((member) => ({ name: member.name, kind: member.kind, parameters: member.parameters ?? [] })),
      primitiveLike: primitives.map((member) => member.name),
      operationLike: operations.map((member) => member.name),
      // The analyzer never decides the semantics; it only says what to ask.
      question: `Are ${primitives.map((member) => `"${member.name}"`).join(', ') || '(none)'} steps of one ${group} operation, or independent capabilities?`,
    })
  }

  return {
    root,
    scannedFiles: scanned,
    tools,
    capabilities,
    groups: [...groups.entries()].map(([group, members]) => ({ group, tools: members.map((member) => member.name) })),
    candidates,
    counts: {
      files: scanned.length,
      tools: tools.length,
      capabilities: capabilities.length,
      candidates: candidates.length,
    },
  }
}

/** Render a report as Markdown: readable by a human, parseable by a model. */
export function renderReport(report) {
  const lines = []
  lines.push(`# Tool-surface analysis: ${report.root}`)
  lines.push('')
  lines.push(`Scanned ${report.counts.files} source file(s); found ${report.counts.tools} model-facing tool registration(s) and ${report.counts.capabilities} capability declaration(s).`)
  lines.push('')
  lines.push('## Registered tools')
  lines.push('')
  if (report.tools.length === 0) {
    lines.push('_No statically visible `defineTool({ name: … })` call. The plugin may build tools dynamically; inspect it by hand._')
  } else {
    lines.push('| Tool | Shape | Parameters | Source |')
    lines.push('| --- | --- | --- | --- |')
    for (const tool of report.tools) {
      const shape = tool.dynamic ? 'dynamic name' : classify(tool)
      lines.push(`| \`${tool.name}\` | ${shape} | ${tool.parameters === undefined ? '_(dynamic)_' : tool.parameters.join(', ') || '—'} | \`${tool.file}:${tool.line}\` |`)
    }
  }
  lines.push('')
  lines.push('## Candidate groupings (for review, not adoption)')
  lines.push('')
  if (report.candidates.length === 0) {
    lines.push('_No prefix group holds two or more tools._')
  } else {
    for (const candidate of report.candidates) {
      lines.push(`### \`${candidate.group}\``)
      lines.push('')
      lines.push(`- tools: ${candidate.tools.map((tool) => `\`${tool.name}\` (${tool.kind})`).join(', ')}`)
      lines.push(`- primitive-like: ${candidate.primitiveLike.length > 0 ? candidate.primitiveLike.map((name) => `\`${name}\``).join(', ') : '_none_'}`)
      lines.push(`- operation-like: ${candidate.operationLike.length > 0 ? candidate.operationLike.map((name) => `\`${name}\``).join(', ') : '_none_'}`)
      lines.push(`- question for the model/human: ${candidate.question}`)
      lines.push('')
    }
  }
  if (report.capabilities.length > 0) {
    lines.push('## Existing capability declarations')
    lines.push('')
    for (const capability of report.capabilities) {
      lines.push(`- \`${capability.id}\` → ${capability.operations.map((name) => `\`${name}\``).join(', ') || '_(no static operation names)_'} (\`${capability.file}:${capability.line}\`)`)
    }
    lines.push('')
  }
  lines.push('## Boundary')
  lines.push('')
  lines.push('This report is read-only. It groups by name prefix and classifies by verb — both are heuristics.')
  lines.push('A grouping is a *question*, not a recommendation: whether two tools form one semantic operation is a judgment call.')
  lines.push('The analyzer never hides, moves, or rewrites a tool, and never claims one is unnecessary.')
  return lines.join('\n')
}

/** A starter capability declaration for one candidate group — a proposal, not a patch. */
export function renderProposal(candidate) {
  const lines = []
  lines.push(`// PROPOSAL — review before adopting. Generated from tool names only; no semantics were inferred.`)
  lines.push(`ctx.capabilities.register({`)
  lines.push(`  id: '${candidate.group}',`)
  lines.push(`  description: 'TODO: one sentence describing what the model can do with this capability.',`)
  lines.push(`  operations: [`)
  lines.push(`    {`)
  lines.push(`      name: 'analyze', // TODO: name the semantic operation, not the steps`)
  lines.push(`      description: 'TODO: what this operation produces, in the model's terms.',`)
  lines.push(`      parameters: { /* TODO */ },`)
  lines.push(`      steps: [`)
  for (const name of candidate.primitiveLike.length > 0 ? candidate.primitiveLike : candidate.tools.map((tool) => tool.name)) {
    lines.push(`        { tool: '${name}' }, // TODO: confirm order and argument mapping`)
  }
  lines.push(`      ],`)
  lines.push(`    },`)
  lines.push(`  ],`)
  lines.push(`})`)
  return lines.join('\n')
}
