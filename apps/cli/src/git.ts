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

function diffArgs(options: DiffOptions): string[] {
  if (options.base) {
    return [`${options.base}...HEAD`]
  }
  if (options.staged) {
    return ['--cached']
  }
  return ['HEAD']
}

export function collectDiff(options: DiffOptions): DiffResult {
  const args = diffArgs(options)
  const diff = git(options.cwd, ['diff', ...args])
  const names = git(options.cwd, ['diff', '--name-only', ...args])

  return {
    diff,
    changedFiles: names.split('\n').filter((line) => line.length > 0),
  }
}
