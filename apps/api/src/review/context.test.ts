import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectContext } from './context.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

function paths(options: Parameters<typeof collectContext>[0]): string[] {
  return collectContext(options).files.map((f) => f.path)
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
    expect(
      paths({
        root,
        changedFiles: ['src/a.ts'],
        diff: 'd',
        budgetTokens: 10_000,
      })[0],
    ).toBe('src/a.ts')
  })

  it('includes project rules after changed files', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'always use const\n')
    expect(
      paths({
        root,
        changedFiles: ['src/a.ts'],
        diff: 'd',
        budgetTokens: 10_000,
      }),
    ).toEqual(['src/a.ts', 'CLAUDE.md'])
  })

  it('places related docs before importers', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('src/caller.ts', "import { pay } from './payment.js'\n")
    write('docs/design.md', 'payment.ts handles settlement\n')
    const result = paths({
      root,
      changedFiles: ['src/payment.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    })
    expect(result.indexOf('docs/design.md')).toBeLessThan(
      result.indexOf('src/caller.ts'),
    )
  })

  it('places importers before imports', () => {
    write('src/payment.ts', "import { util } from './util.js'\n")
    write('src/util.ts', 'export const util = 1\n')
    write('src/caller.ts', "import { payment } from './payment.js'\n")
    const result = paths({
      root,
      changedFiles: ['src/payment.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    })
    expect(result.indexOf('src/caller.ts')).toBeLessThan(
      result.indexOf('src/util.ts'),
    )
  })

  it('stops adding files once the budget is exhausted and counts the drop', () => {
    write('src/a.ts', 'x'.repeat(30_000))
    write('CLAUDE.md', 'y'.repeat(30_000))
    const result = collectContext({
      root,
      changedFiles: ['src/a.ts'],
      diff: 'd',
      budgetTokens: 11_000,
    })
    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts'])
    expect(result.dropped).toBe(1)
  })

  it('skips an oversized file and still packs smaller ones after it', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'x'.repeat(30_000))
    write('AGENTS.md', 'small rules\n')
    expect(
      paths({
        root,
        changedFiles: ['src/a.ts'],
        diff: 'd',
        budgetTokens: 300,
      }),
    ).toEqual(['src/a.ts', 'AGENTS.md'])
  })

  it('never includes the same file twice', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', "import { a } from './a.js'\n")
    const result = paths({
      root,
      changedFiles: ['src/a.ts', 'src/b.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    })
    expect(new Set(result).size).toBe(result.length)
  })

  it('returns no context files when the diff alone already exceeds the budget', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'small rules\n')
    expect(
      collectContext({
        root,
        changedFiles: ['src/a.ts'],
        diff: 'z'.repeat(30_000),
        budgetTokens: 5_000,
      }).files,
    ).toEqual([])
  })

  it('skips a changed file that no longer exists on disk', () => {
    expect(
      collectContext({
        root,
        changedFiles: ['src/deleted.ts'],
        diff: 'd',
        budgetTokens: 10_000,
      }).files,
    ).toEqual([])
  })
})
