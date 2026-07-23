import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findImporters, findImports, findRelatedDocs } from './related.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'exocortex-rel-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('findImports', () => {
  it('finds relative imports', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', 'export const b = 1\n')
    expect(findImports(root, 'src/a.ts')).toEqual(['src/b.ts'])
  })

  it('ignores package imports', () => {
    write('src/a.ts', "import { z } from 'zod'\n")
    expect(findImports(root, 'src/a.ts')).toEqual([])
  })

  it('returns an empty list for a file that no longer exists', () => {
    expect(findImports(root, 'src/deleted.ts')).toEqual([])
  })
})

describe('findImporters', () => {
  it('finds files that import the given file', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', 'export const b = 1\n')
    expect(findImporters(root, 'src/b.ts')).toEqual(['src/a.ts'])
  })

  it('does not report the file itself', () => {
    write('src/b.ts', '// mentions b.js in a comment\n')
    expect(findImporters(root, 'src/b.ts')).toEqual([])
  })

  it('handles a target file whose basename starts with a hyphen', () => {
    write('src/-weird.ts', 'export const weird = 1\n')
    write('src/caller.ts', "import { weird } from './-weird.js'\n")
    expect(findImporters(root, 'src/-weird.ts')).toEqual(['src/caller.ts'])
  })
})

describe('findRelatedDocs', () => {
  it('finds markdown mentioning the changed file basename', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('docs/design.md', 'payment.ts handles settlement\n')
    expect(findRelatedDocs(root, ['src/payment.ts'])).toEqual([
      'docs/design.md',
    ])
  })

  it('returns an empty list when nothing mentions the file', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('docs/design.md', 'unrelated content\n')
    expect(findRelatedDocs(root, ['src/payment.ts'])).toEqual([])
  })

  it('handles a changed file whose basename starts with a hyphen', () => {
    write('src/-weird.ts', 'export const weird = 1\n')
    write('docs/design.md', '-weird.ts holds the weird cases\n')
    expect(findRelatedDocs(root, ['src/-weird.ts'])).toEqual(['docs/design.md'])
  })
})

describe('when rg is not on PATH', () => {
  it('throws an actionable error instead of a raw ENOENT', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', 'export const b = 1\n')

    const originalPath = process.env.PATH
    process.env.PATH = ''
    try {
      expect(() => findImporters(root, 'src/b.ts')).toThrow(/ripgrep/i)
      expect(() => findRelatedDocs(root, ['src/b.ts'])).toThrow(/ripgrep/i)
    } finally {
      process.env.PATH = originalPath
    }
  })
})
