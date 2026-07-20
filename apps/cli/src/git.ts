import { execFileSync } from 'node:child_process'

export interface DiffOptions {
  cwd: string
  base?: string
  staged?: boolean
}

export interface DiffResult {
  diff: string
  changedFiles: string[]
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

export function repoRoot(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim()
}

function assertNotFlagLike(base: string): void {
  if (base.startsWith('-')) {
    throw new Error(`base must not start with '-': ${base}`)
  }
}

function assertBaseResolves(cwd: string, base: string): void {
  try {
    git(cwd, ['rev-parse', '--verify', '--end-of-options', base])
  } catch {
    throw new Error(`base does not resolve to a git ref: ${base}`)
  }
}

export function diffArgs(options: DiffOptions): string[] {
  if (options.base) {
    return ['--end-of-options', `${options.base}...HEAD`]
  }
  if (options.staged) {
    return ['--cached']
  }
  return ['HEAD']
}

export function collectDiff(options: DiffOptions): DiffResult {
  if (options.base && options.staged) {
    throw new Error('base and staged are mutually exclusive')
  }
  if (options.base) {
    assertNotFlagLike(options.base)
    assertBaseResolves(options.cwd, options.base)
  }

  const args = diffArgs(options)
  const diff = git(options.cwd, ['diff', ...args])
  const names = git(options.cwd, ['diff', '--name-only', ...args])

  return {
    diff,
    changedFiles: names.split('\n').filter((line) => line.length > 0),
  }
}
