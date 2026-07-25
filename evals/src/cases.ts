import { type Dirent, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Severity } from '@exocortex/contract'

export const CASES_DIR = join(import.meta.dirname, '..', 'cases')

export const CATEGORIES = [
  'logic',
  'dataflow',
  'convention',
  'error-handling',
  'concurrency',
  'resource',
  'clean',
  'size',
] as const

export const MODES = ['base', 'worktree', 'staged'] as const

export const SEVERITIES = ['critical', 'major', 'minor', 'info'] as const

export type CaseCategory = (typeof CATEGORIES)[number]
export type CaseMode = (typeof MODES)[number]

export interface ExpectedFinding {
  id: string
  file: string
  anchor: string
  span: number
  summary: string
  severityFloor: Severity
}

export interface CaseSpec {
  id: string
  category: CaseCategory
  mode: CaseMode
  expected: ExpectedFinding[]
  origin: string
  clean: boolean
  deletions?: string[]
  language?: string
}

export interface ResolvedFinding extends ExpectedFinding {
  line: number
}

export interface EvalCase {
  spec: CaseSpec
  dir: string
  baseFiles: ReadonlyMap<string, string>
  headFiles: ReadonlyMap<string, string>
  treeFiles: ReadonlyMap<string, string>
  expected: ResolvedFinding[]
}

function fail(where: string, message: string): never {
  throw new Error(`${where}: ${message}`)
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(where, 'expected an object')
  }
  return value as Record<string, unknown>
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string') fail(where, 'expected a string')
  return value
}

function asBoolean(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') fail(where, 'expected a boolean')
  return value
}

function asPositiveInt(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(where, 'expected a positive integer')
  }
  return value
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) fail(where, 'expected an array')
  return value
}

function asMember<T extends string>(
  value: unknown,
  allowed: readonly T[],
  where: string,
): T {
  const text = asString(value, where)
  const found = allowed.find((candidate) => candidate === text)
  if (found === undefined) fail(where, `expected one of ${allowed.join(', ')}`)
  return found
}

function asOptionalStrings(
  value: unknown,
  where: string,
): string[] | undefined {
  if (value === undefined) return undefined
  return asArray(value, where).map((entry, index) =>
    asString(entry, `${where}[${index}]`),
  )
}

function parseExpected(value: unknown, where: string): ExpectedFinding {
  const raw = asRecord(value, where)
  return {
    id: asString(raw.id, `${where}.id`),
    file: asString(raw.file, `${where}.file`),
    anchor: asString(raw.anchor, `${where}.anchor`),
    span: asPositiveInt(raw.span, `${where}.span`),
    summary: asString(raw.summary, `${where}.summary`),
    severityFloor: asMember(
      raw.severityFloor,
      SEVERITIES,
      `${where}.severityFloor`,
    ),
  }
}

export function parseCaseSpec(value: unknown, where: string): CaseSpec {
  const raw = asRecord(value, where)
  const spec: CaseSpec = {
    id: asString(raw.id, `${where}.id`),
    category: asMember(raw.category, CATEGORIES, `${where}.category`),
    mode: asMember(raw.mode, MODES, `${where}.mode`),
    expected: asArray(raw.expected, `${where}.expected`).map((entry, index) =>
      parseExpected(entry, `${where}.expected[${index}]`),
    ),
    origin: asString(raw.origin, `${where}.origin`),
    clean: asBoolean(raw.clean, `${where}.clean`),
  }

  const deletions = asOptionalStrings(raw.deletions, `${where}.deletions`)
  if (deletions) spec.deletions = deletions
  if (raw.language !== undefined) {
    spec.language = asString(raw.language, `${where}.language`)
  }

  return spec
}

function readTree(dir: string): Map<string, string> {
  const files = new Map<string, string>()
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true })
  } catch {
    return files
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const full = join(entry.parentPath, entry.name)
    if (!entry.name.endsWith('.txt')) {
      fail(full, 'fixture sources must carry a .txt extension')
    }
    const path = relative(dir, full)
      .split(sep)
      .join('/')
      .slice(0, -'.txt'.length)
    files.set(path, readFileSync(full, 'utf8'))
  }

  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)))
}

export function countAnchors(content: string, anchor: string): number {
  const needle = anchor.trim()
  return content.split('\n').filter((line) => line.trim() === needle).length
}

export function findAnchorLine(content: string, anchor: string): number {
  const needle = anchor.trim()
  const lines = content.split('\n')
  const hits = lines.flatMap((line, index) =>
    line.trim() === needle ? [index + 1] : [],
  )

  if (hits.length !== 1) {
    throw new Error(
      `anchor ${JSON.stringify(anchor)} appears ${hits.length} times, expected exactly 1`,
    )
  }
  return hits[0] as number
}

export function loadCase(dir: string): EvalCase {
  const specPath = join(dir, 'case.json')
  const spec = parseCaseSpec(
    JSON.parse(readFileSync(specPath, 'utf8')) as unknown,
    specPath,
  )

  const baseFiles = readTree(join(dir, 'base'))
  const headFiles = readTree(join(dir, 'head'))

  const treeFiles = new Map([...baseFiles, ...headFiles])
  for (const path of spec.deletions ?? []) {
    if (!treeFiles.delete(path)) {
      fail(specPath, `deletions names ${path}, which the tree does not have`)
    }
  }

  const expected = spec.expected.map((finding) => {
    const content = treeFiles.get(finding.file)
    if (content === undefined) {
      fail(
        specPath,
        `${finding.id} names ${finding.file}, which is not in the tree`,
      )
    }
    return { ...finding, line: findAnchorLine(content, finding.anchor) }
  })

  return { spec, dir, baseFiles, headFiles, treeFiles, expected }
}

export function loadCases(root: string = CASES_DIR): EvalCase[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => loadCase(join(root, name)))
}
