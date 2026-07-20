import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

const IMPORT_PATTERN = /(?:from|require\()\s*['"]([^'"]+)['"]/g
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const SOURCE_GLOBS = ['-g', '*.ts', '-g', '*.tsx', '-g', '*.js', '-g', '*.jsx']

const RG_MISSING_MESSAGE =
  'ripgrep (rg) is required for context collection but was not found on PATH. Install it: https://github.com/BurntSushi/ripgrep#installation'

function isRgMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}

function rg(root: string, args: string[]): string[] {
  let out: string
  try {
    out = execFileSync('rg', ['--no-config', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (isRgMissing(error)) {
      throw new Error(RG_MISSING_MESSAGE)
    }
    return []
  }
  return out.split('\n').filter((line) => line.length > 0)
}

function resolveSpecifier(
  root: string,
  fromFile: string,
  specifier: string,
): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined
  }

  const base = resolve(root, dirname(fromFile), specifier)
  const withoutExt = base.replace(/\.(js|jsx|ts|tsx)$/, '')

  for (const ext of SOURCE_EXTENSIONS) {
    for (const candidate of [
      `${withoutExt}${ext}`,
      join(withoutExt, `index${ext}`),
    ]) {
      if (existsSync(candidate)) {
        return relative(root, candidate)
      }
    }
  }
  return undefined
}

export function findImports(root: string, file: string): string[] {
  const full = join(root, file)
  if (!existsSync(full)) {
    return []
  }

  const source = readFileSync(full, 'utf8')
  const found = new Set<string>()

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1]
    if (!specifier) continue
    const resolved = resolveSpecifier(root, file, specifier)
    if (resolved) {
      found.add(resolved)
    }
  }

  return [...found].sort()
}

export function findImporters(root: string, file: string): string[] {
  const stem = basename(file).replace(/\.(ts|tsx|js|jsx)$/, '')
  const pattern = `(from|require\\()\\s*['"][^'"]*${stem}(\\.js|\\.ts)?['"]`
  const lines = rg(root, ['-l', '-e', pattern, ...SOURCE_GLOBS])

  return lines.filter((candidate) => candidate !== file).sort()
}

export function findRelatedDocs(root: string, files: string[]): string[] {
  const stems = files.map((file) => basename(file))
  if (stems.length === 0) {
    return []
  }

  const args = ['-l', '-g', '*.md']
  for (const stem of stems) {
    args.push('-e', stem)
  }

  return rg(root, args).sort()
}
