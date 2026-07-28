import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectCandidates } from './context.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

function paths(changedFiles: string[]): string[] {
  return collectCandidates(root, changedFiles).map((f) => f.path)
}

function writeDocsFixture(): void {
  write('src/payment.ts', "import { util } from './util.js'\n")
  write('src/util.ts', 'export const util = 1\n')
  write('src/caller.ts', "import { payment } from './payment.js'\n")
  write('CLAUDE.md', 'always use const\n')
  write('docs/design.md', 'payment.ts handles settlement\n')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'exocortex-collect-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('collectCandidates', () => {
  it('includes changed files first', () => {
    write('src/a.ts', 'export const a = 1\n')
    expect(paths(['src/a.ts'])[0]).toBe('src/a.ts')
  })

  it('reads the current content of each candidate', () => {
    write('src/a.ts', 'export const a = 1\n')
    const files = collectCandidates(root, ['src/a.ts'])
    expect(files[0]?.content).toBe('export const a = 1\n')
  })

  it('includes project rules after changed files', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'always use const\n')
    expect(paths(['src/a.ts'])).toEqual(['src/a.ts', 'CLAUDE.md'])
  })

  it('places related docs before importers', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('src/caller.ts', "import { pay } from './payment.js'\n")
    write('docs/design.md', 'payment.ts handles settlement\n')
    const result = paths(['src/payment.ts'])
    expect(result.indexOf('docs/design.md')).toBeLessThan(
      result.indexOf('src/caller.ts'),
    )
  })

  it('places importers before imports', () => {
    write('src/payment.ts', "import { util } from './util.js'\n")
    write('src/util.ts', 'export const util = 1\n')
    write('src/caller.ts', "import { payment } from './payment.js'\n")
    const result = paths(['src/payment.ts'])
    expect(result.indexOf('src/caller.ts')).toBeLessThan(
      result.indexOf('src/util.ts'),
    )
  })

  it('never includes the same file twice', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', "import { a } from './a.js'\n")
    const result = paths(['src/a.ts', 'src/b.ts'])
    expect(new Set(result).size).toBe(result.length)
  })

  it('skips a changed file that no longer exists on disk', () => {
    expect(collectCandidates(root, ['src/deleted.ts'])).toEqual([])
  })

  it('collects related docs when includeDocs is left unset', () => {
    writeDocsFixture()
    expect(paths(['src/payment.ts'])).toContain('docs/design.md')
  })

  it('drops related docs when includeDocs is false', () => {
    writeDocsFixture()
    const result = collectCandidates(root, ['src/payment.ts'], {
      includeDocs: false,
    }).map((f) => f.path)
    expect(result).not.toContain('docs/design.md')
  })

  // Turning the docs off must leave the a/b comparison with only one variable,
  // so every other channel has to survive untouched.
  it('keeps rules, importers and imports when docs are off', () => {
    writeDocsFixture()
    const result = collectCandidates(root, ['src/payment.ts'], {
      includeDocs: false,
    }).map((f) => f.path)
    expect(result).toEqual([
      'src/payment.ts',
      'CLAUDE.md',
      'src/caller.ts',
      'src/util.ts',
    ])
  })
})
