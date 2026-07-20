import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectContext } from './collect.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'exocortex-collect-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('collectContext', () => {
  it('includes changed files first', () => {
    write('src/a.ts', 'export const a = 1\n')
    const files = collectContext({
      root,
      changedFiles: ['src/a.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    })
    expect(files[0]?.path).toBe('src/a.ts')
  })

  it('includes project rules after changed files', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'always use const\n')
    const paths = collectContext({
      root,
      changedFiles: ['src/a.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    }).map((f) => f.path)
    expect(paths).toEqual(['src/a.ts', 'CLAUDE.md'])
  })

  it('places related docs before importers', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('src/caller.ts', "import { pay } from './payment.js'\n")
    write('docs/design.md', 'payment.ts handles settlement\n')
    const paths = collectContext({
      root,
      changedFiles: ['src/payment.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    }).map((f) => f.path)
    expect(paths.indexOf('docs/design.md')).toBeLessThan(
      paths.indexOf('src/caller.ts'),
    )
  })

  it('places importers before imports', () => {
    write('src/payment.ts', "import { util } from './util.js'\n")
    write('src/util.ts', 'export const util = 1\n')
    write('src/caller.ts', "import { payment } from './payment.js'\n")
    const paths = collectContext({
      root,
      changedFiles: ['src/payment.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    }).map((f) => f.path)
    expect(paths.indexOf('src/caller.ts')).toBeLessThan(
      paths.indexOf('src/util.ts'),
    )
  })

  it('stops adding files once the budget is exhausted', () => {
    write('src/a.ts', 'x'.repeat(30_000))
    write('CLAUDE.md', 'y'.repeat(30_000))
    const files = collectContext({
      root,
      changedFiles: ['src/a.ts'],
      diff: 'd',
      budgetTokens: 11_000,
    })
    expect(files.map((f) => f.path)).toEqual(['src/a.ts'])
  })

  it('skips an oversized file and still packs smaller ones after it', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'x'.repeat(30_000))
    write('AGENTS.md', 'small rules\n')
    const paths = collectContext({
      root,
      changedFiles: ['src/a.ts'],
      diff: 'd',
      budgetTokens: 300,
    }).map((f) => f.path)
    expect(paths).toEqual(['src/a.ts', 'AGENTS.md'])
  })

  it('never includes the same file twice', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', "import { a } from './a.js'\n")
    const paths = collectContext({
      root,
      changedFiles: ['src/a.ts', 'src/b.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    }).map((f) => f.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('returns no context files when the diff alone already exceeds the budget', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'small rules\n')
    const files = collectContext({
      root,
      changedFiles: ['src/a.ts'],
      diff: 'z'.repeat(30_000),
      budgetTokens: 5_000,
    })
    expect(files).toEqual([])
  })

  it('skips a changed file that no longer exists on disk', () => {
    const files = collectContext({
      root,
      changedFiles: ['src/deleted.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    })
    expect(files).toEqual([])
  })
})
