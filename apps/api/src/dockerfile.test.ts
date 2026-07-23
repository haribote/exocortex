import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const dockerfilePath = fileURLToPath(new URL('../Dockerfile', import.meta.url))
const dockerfile = readFileSync(dockerfilePath, 'utf-8')

const lockfilePath = fileURLToPath(
  new URL('../../../pnpm-lock.yaml', import.meta.url),
)
const lockfile: unknown = parse(readFileSync(lockfilePath, 'utf-8'))

if (!isRecord(lockfile)) {
  throw new Error(`${lockfilePath} did not parse to an object`)
}

const importers = lockfile.importers
if (!isRecord(importers)) {
  throw new Error(`${lockfilePath} has no "importers" object`)
}

const workspacePaths = Object.keys(importers).filter((path) => path !== '.')

const lines = dockerfile.split('\n')
const installIndex = lines.findIndex((line) =>
  line.includes('pnpm install --frozen-lockfile'),
)

if (installIndex === -1) {
  throw new Error(
    `${dockerfilePath} does not run "pnpm install --frozen-lockfile"`,
  )
}

const copiedBeforeInstall = lines
  .slice(0, installIndex)
  .filter((line) => line.trimStart().startsWith('COPY'))
  .join('\n')

describe('apps/api/Dockerfile', () => {
  it('copies pnpm-lock.yaml before running a frozen install', () => {
    expect(
      copiedBeforeInstall,
      '"pnpm install --frozen-lockfile" reads pnpm-lock.yaml, so the lockfile must be in the image before that step runs',
    ).toContain('pnpm-lock.yaml')
  })

  it.each(workspacePaths)(
    'copies %s/package.json before running a frozen install',
    (workspacePath) => {
      expect(
        copiedBeforeInstall,
        `a frozen install validates every importer recorded in pnpm-lock.yaml, so ${workspacePath}/package.json must be in the image before that step runs`,
      ).toContain(`${workspacePath}/package.json`)
    },
  )

  it('installs git and ripgrep for server-side context collection', () => {
    expect(
      dockerfile,
      'the api runs git to compute the diff and rg to find related files',
    ).toMatch(/apt-get install[^\n]*\bgit\b/)
    expect(dockerfile).toMatch(/apt-get install[^\n]*\bripgrep\b/)
  })
})
