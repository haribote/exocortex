import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { selectTargets } from './targets.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'exocortex-select-targets-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('selectTargets', () => {
  it('includes typescript extensions for typescript language', () => {
    write('src/a.ts', 'const a = 1\n')
    write('src/b.tsx', 'const b = 1\n')
    write('src/c.js', 'const c = 1\n')
    write('src/d.jsx', 'const d = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts', 'src/b.tsx', 'src/c.js', 'src/d.jsx'],
      language: 'typescript',
    })
    expect(result.targets).toEqual([
      'src/a.ts',
      'src/b.tsx',
      'src/c.js',
      'src/d.jsx',
    ])
  })

  it('excludes non-matching extensions for typescript language', () => {
    write('src/a.ts', 'const a = 1\n')
    write('src/b.md', '# doc\n')
    write('src/c.json', '{}\n')
    write('src/d.yaml', 'key: value\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts', 'src/b.md', 'src/c.json', 'src/d.yaml'],
      language: 'typescript',
    })
    expect(result.targets).toEqual(['src/a.ts'])
    expect(result.skipped).toBe(3)
  })

  it('counts excluded files in skipped', () => {
    write('src/a.ts', 'const a = 1\n')
    write('src/b.json', '{}\n')
    write('src/c.md', '# doc\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts', 'src/b.json', 'src/c.md'],
      language: 'typescript',
    })
    expect(result.skipped).toBe(2)
  })

  it('excludes files that do not exist on disk', () => {
    write('src/a.ts', 'const a = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts', 'src/deleted.ts'],
      language: 'typescript',
    })
    expect(result.targets).toEqual(['src/a.ts'])
    expect(result.skipped).toBe(1)
  })

  it('counts non-existent files with non-matching extensions in skipped', () => {
    write('src/a.ts', 'const a = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts', 'src/deleted.json'],
      language: 'typescript',
    })
    expect(result.skipped).toBe(1)
  })

  it('includes all existing files for unknown language', () => {
    write('src/a.rs', 'fn main() {}\n')
    write('src/b.toml', '[package]\n')
    write('src/c.md', '# doc\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.rs', 'src/b.toml', 'src/c.md'],
      language: 'rust',
    })
    expect(result.targets).toEqual(['src/a.rs', 'src/b.toml', 'src/c.md'])
    expect(result.skipped).toBe(0)
  })

  it('excludes non-existent files even for unknown language', () => {
    write('src/a.rs', 'fn main() {}\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.rs', 'src/deleted.rs'],
      language: 'rust',
    })
    expect(result.targets).toEqual(['src/a.rs'])
    expect(result.skipped).toBe(1)
  })

  it('preserves order of changedFiles', () => {
    write('src/c.ts', 'const c = 1\n')
    write('src/a.ts', 'const a = 1\n')
    write('src/b.ts', 'const b = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/c.ts', 'src/a.ts', 'src/b.ts'],
      language: 'typescript',
    })
    expect(result.targets).toEqual(['src/c.ts', 'src/a.ts', 'src/b.ts'])
  })

  it('accepts uppercase extensions', () => {
    write('src/a.TS', 'const a = 1\n')
    write('src/b.TSX', 'const b = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.TS', 'src/b.TSX'],
      language: 'typescript',
    })
    expect(result.targets).toEqual(['src/a.TS', 'src/b.TSX'])
    expect(result.skipped).toBe(0)
  })

  // Reading the extension by hand off the last dot answers "e" for Makefile and
  // ".bar/baz" for src/foo.bar/baz, so paths shaped like these are the ones
  // that tell extname apart from a lastIndexOf slice.
  it('skips a file that has no extension at all', () => {
    write('Makefile', 'all:\n')
    write('src/a.ts', 'const a = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['Makefile', 'src/a.ts'],
      language: 'typescript',
    })
    expect(result.targets).toEqual(['src/a.ts'])
    expect(result.skipped).toBe(1)
  })

  it('skips an extensionless file inside a directory whose name has a dot', () => {
    write('src/foo.bar/baz', 'x\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/foo.bar/baz'],
      language: 'typescript',
    })
    expect(result.targets).toEqual([])
    expect(result.skipped).toBe(1)
  })

  it('keeps a script file inside a directory whose name has a dot', () => {
    write('src/foo.bar/baz.ts', 'const a = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/foo.bar/baz.ts'],
      language: 'typescript',
    })
    expect(result.targets).toEqual(['src/foo.bar/baz.ts'])
    expect(result.skipped).toBe(0)
  })

  it('returns empty targets and zero skipped for empty changedFiles', () => {
    const result = selectTargets({
      root,
      changedFiles: [],
      language: 'typescript',
    })
    expect(result.targets).toEqual([])
    expect(result.skipped).toBe(0)
  })

  it('normalizes language by trimming and lowercasing', () => {
    write('src/a.ts', 'const a = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts'],
      language: '  TypeScript  ',
    })
    expect(result.targets).toEqual(['src/a.ts'])
  })

  it('handles javascript language same as typescript', () => {
    write('src/a.ts', 'const a = 1\n')
    write('src/b.js', 'const b = 1\n')
    const result = selectTargets({
      root,
      changedFiles: ['src/a.ts', 'src/b.js'],
      language: 'javascript',
    })
    expect(result.targets).toEqual(['src/a.ts', 'src/b.js'])
  })
})
