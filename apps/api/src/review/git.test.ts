import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collectDiff,
  collectFileDiff,
  diffArgs,
  InvalidBaseError,
} from './git.js'

let cwd: string

const isolatedEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: isolatedEnv })
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'exocortex-git-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  writeFileSync(join(cwd, 'a.ts'), 'export const a = 1\n')
  git('add', '.')
  git('commit', '-qm', 'initial')
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

describe('collectDiff', () => {
  it('returns an empty diff when nothing changed', () => {
    const result = collectDiff({ cwd })
    expect(result.diff).toBe('')
    expect(result.changedFiles).toEqual([])
  })

  it('reports uncommitted changes', () => {
    writeFileSync(join(cwd, 'a.ts'), 'export const a = 2\n')
    const result = collectDiff({ cwd })
    expect(result.diff).toContain('export const a = 2')
    expect(result.changedFiles).toEqual(['a.ts'])
  })

  it('reports only staged changes when staged is set', () => {
    writeFileSync(join(cwd, 'a.ts'), 'export const a = 2\n')
    writeFileSync(join(cwd, 'b.ts'), 'export const b = 1\n')
    git('add', 'a.ts')
    const result = collectDiff({ cwd, staged: true })
    expect(result.changedFiles).toEqual(['a.ts'])
  })

  it('diffs against a base ref when given', () => {
    git('checkout', '-qb', 'feature')
    writeFileSync(join(cwd, 'c.ts'), 'export const c = 1\n')
    git('add', '.')
    git('commit', '-qm', 'add c')
    const result = collectDiff({ cwd, base: 'main' })
    expect(result.changedFiles).toEqual(['c.ts'])
  })

  it('rejects a base that git would read as a flag, without writing any file it names', () => {
    const filesBefore = readdirSync(cwd)
    expect(() => collectDiff({ cwd, base: '--output=./pwned.txt' })).toThrow()
    expect(readdirSync(cwd)).toEqual(filesBefore)
  })

  it('rejects a base that does not resolve to a git ref, with a clear error', () => {
    expect(() => collectDiff({ cwd, base: 'does-not-exist' })).toThrow(
      /does not resolve/,
    )
  })

  it('rejects base and staged given together', () => {
    expect(() => collectDiff({ cwd, base: 'main', staged: true })).toThrow(
      /mutually exclusive/,
    )
  })
})

describe('diffArgs', () => {
  it('separates the base from options so git cannot read it as a flag', () => {
    expect(diffArgs({ cwd: '/nowhere', base: 'main' })).toEqual([
      '--end-of-options',
      'main...HEAD',
    ])
  })
})

describe('collectFileDiff', () => {
  it('returns diff for a single file when multiple files changed', () => {
    writeFileSync(join(cwd, 'a.ts'), 'export const a = 2\n')
    writeFileSync(join(cwd, 'b.ts'), 'export const b = 1\n')
    const result = collectFileDiff({ cwd }, 'a.ts')
    expect(result).toContain('export const a = 2')
    expect(result).not.toContain('export const b')
  })

  it('diffs against a base ref when given', () => {
    git('checkout', '-qb', 'feature')
    writeFileSync(join(cwd, 'c.ts'), 'export const c = 1\n')
    git('add', '.')
    git('commit', '-qm', 'add c')
    const result = collectFileDiff({ cwd, base: 'main' }, 'c.ts')
    expect(result).toContain('export const c = 1')
  })

  it('returns only staged changes when staged is set', () => {
    writeFileSync(join(cwd, 'a.ts'), 'export const a = 2\n')
    writeFileSync(join(cwd, 'b.ts'), 'export const b = 1\n')
    git('add', 'a.ts')
    const result = collectFileDiff({ cwd, staged: true }, 'a.ts')
    expect(result).toContain('export const a = 2')
    expect(result).not.toContain('export const b')
  })

  it('rejects base and staged given together', () => {
    expect(() =>
      collectFileDiff({ cwd, base: 'main', staged: true }, 'a.ts'),
    ).toThrow(InvalidBaseError)
  })

  it('rejects a base that does not resolve to a git ref', () => {
    expect(() =>
      collectFileDiff({ cwd, base: 'does-not-exist' }, 'a.ts'),
    ).toThrow(InvalidBaseError)
  })

  it('handles filenames starting with dash', () => {
    writeFileSync(join(cwd, '-weird.ts'), 'export const weird = 1\n')
    git('add', '.')
    git('commit', '-qm', 'add weird')
    writeFileSync(join(cwd, '-weird.ts'), 'export const weird = 2\n')
    const result = collectFileDiff({ cwd }, '-weird.ts')
    expect(result).toContain('export const weird = 2')
  })

  it('returns empty string when file has no changes', () => {
    const result = collectFileDiff({ cwd }, 'a.ts')
    expect(result).toBe('')
  })
})
