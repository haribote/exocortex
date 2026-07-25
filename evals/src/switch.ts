import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const CONFIGS_PATH = join(import.meta.dirname, '..', 'configs.json')

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const BARE_TOKEN = /^[A-Za-z0-9._-]+$/

export interface EvalConfig {
  id: string
  env: Record<string, string>
}

export interface RemoteTarget {
  host: string
  distro: string
  composeDir: string
  service: string
}

export const DEFAULT_TARGET: RemoteTarget = {
  host: 'exocortex',
  distro: 'exocortex',
  composeDir: '/home/haribote/exocortex',
  service: 'ai-api',
}

export function remoteTarget(
  env: Record<string, string | undefined> = process.env,
): RemoteTarget {
  return {
    host: env.EXOCORTEX_SSH_HOST ?? DEFAULT_TARGET.host,
    distro: env.EXOCORTEX_WSL_DISTRO ?? DEFAULT_TARGET.distro,
    composeDir: env.EXOCORTEX_COMPOSE_DIR ?? DEFAULT_TARGET.composeDir,
    service: env.EXOCORTEX_API_SERVICE ?? DEFAULT_TARGET.service,
  }
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function buildSwitchScript(
  config: EvalConfig,
  target: RemoteTarget,
): string {
  const assignments = Object.keys(config.env)
    .sort()
    .map((name) => {
      if (!ENV_NAME.test(name)) {
        throw new Error(
          `${config.id}: ${JSON.stringify(name)} is not a usable environment variable name`,
        )
      }
      return `${name}=${shellQuote(config.env[name] as string)}`
    })

  return [
    'set -eu',
    `cd ${shellQuote(target.composeDir)}`,
    `${assignments.join(' ')} docker compose up -d ${shellQuote(target.service)}`,
    '',
  ].join('\n')
}

export function buildOllamaPsScript(target: RemoteTarget): string {
  return [
    'set -eu',
    `cd ${shellQuote(target.composeDir)}`,
    'docker compose exec -T ollama ollama ps',
    '',
  ].join('\n')
}

export function buildOllamaListScript(target: RemoteTarget): string {
  return [
    'set -eu',
    `cd ${shellQuote(target.composeDir)}`,
    'docker compose exec -T ollama ollama list',
    '',
  ].join('\n')
}

// The progress meter is discarded because it is megabytes of carriage returns
// and the runner buffers everything it is given. Failures still arrive: pull
// writes them to stderr and exits non-zero.
export function buildOllamaPullScript(
  target: RemoteTarget,
  model: string,
): string {
  return [
    'set -eu',
    `cd ${shellQuote(target.composeDir)}`,
    `docker compose exec -T ollama ollama pull ${shellQuote(model)} >/dev/null`,
    '',
  ].join('\n')
}

// The script travels on stdin, never on a command line. ssh hands the command
// to the Windows default shell, where '<', '|' and '>' are metacharacters, and
// a config value is free to contain them. Keeping the argv to bare tokens means
// no layer between here and bash has anything to misread.
export function sshArgs(target: RemoteTarget): string[] {
  if (!BARE_TOKEN.test(target.host)) {
    throw new Error(`ssh host must be a bare token: ${target.host}`)
  }
  if (!BARE_TOKEN.test(target.distro)) {
    throw new Error(`wsl distro must be a bare token: ${target.distro}`)
  }
  return [target.host, `wsl -d ${target.distro} -- bash -s`]
}

export type RemoteRunner = (args: readonly string[], script: string) => string

export const sshRunner: RemoteRunner = (args, script) =>
  execFileSync('ssh', [...args], {
    input: script,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })

function normalizeModel(name: string): string {
  return name.includes(':') ? name : `${name}:latest`
}

export function parseOllamaList(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/)[0] as string)
    .filter((name) => name !== 'NAME')
}

export function missingModels(
  wanted: readonly string[],
  installed: readonly string[],
): string[] {
  const have = new Set(installed.map(normalizeModel))
  const missing: string[] = []
  for (const model of wanted) {
    if (have.has(normalizeModel(model))) continue
    if (!missing.includes(model)) missing.push(model)
  }
  return missing
}

export interface ModelAvailabilityDeps {
  runner: RemoteRunner
  pull: boolean
  log?: (message: string) => void
}

// Ollama pulls on demand for `ollama run`, but not for the `/api/chat` calls the
// api makes. A model the server does not have would only surface as a failed
// warm-up, one config at a time, hours into an unattended run.
export function ensureModelsAvailable(
  wanted: readonly string[],
  target: RemoteTarget,
  deps: ModelAvailabilityDeps,
): void {
  if (wanted.length === 0) return

  const args = sshArgs(target)
  const log = deps.log ?? (() => {})

  const list = (): string[] => {
    try {
      return parseOllamaList(deps.runner(args, buildOllamaListScript(target)))
    } catch (cause) {
      throw new Error(`could not list the models on the server: ${cause}`)
    }
  }

  const missing = missingModels(wanted, list())
  if (missing.length === 0) return

  if (!deps.pull) {
    throw new Error(
      `the server does not have ${missing.join(', ')}. fix the names, or re-run with --pull to fetch them.`,
    )
  }

  for (const model of missing) {
    log(`pulling ${model}`)
    deps.runner(args, buildOllamaPullScript(target, model))
  }

  const stillMissing = missingModels(wanted, list())
  if (stillMissing.length > 0) {
    throw new Error(
      `the server still does not have ${stillMissing.join(', ')} after pulling.`,
    )
  }
}

export interface HealthOptions {
  endpoint: string
  timeoutMs: number
  intervalMs?: number
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export async function waitForHealth(options: HealthOptions): Promise<void> {
  const call = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const intervalMs = options.intervalMs ?? 2000
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const deadline = now() + options.timeoutMs

  while (true) {
    try {
      const response = await call(`${options.endpoint}/health`)
      const body: unknown = await response.json()
      if (
        typeof body === 'object' &&
        body !== null &&
        (body as { status?: unknown }).status === 'ok'
      ) {
        return
      }
    } catch {
      // The api is still coming up. Keep polling until the deadline.
    }

    if (now() >= deadline) {
      throw new Error(
        `${options.endpoint}/health did not report ok within ${options.timeoutMs}ms`,
      )
    }
    await sleep(intervalMs)
  }
}

export interface WarmUpResult {
  model: string | null
  wallMs: number
  status: number
}

export interface SwitchDeps {
  runner: RemoteRunner
  waitForHealth: () => Promise<void>
  warmUp: () => Promise<WarmUpResult>
  now: () => Date
}

export type SwitchStatus =
  | 'ok'
  | 'switch-failed'
  | 'unhealthy'
  | 'model-mismatch'

export interface EnvironmentEntry {
  configId: string
  switchedAt: string
  env: Record<string, string>
  expectedModel: string | null
  reportedModel: string | null
  warmUpMs: number | null
  ollamaPs: string | null
  status: SwitchStatus
  note: string | null
}

export async function applyConfig(
  config: EvalConfig,
  target: RemoteTarget,
  deps: SwitchDeps,
): Promise<EnvironmentEntry> {
  const base = {
    configId: config.id,
    switchedAt: deps.now().toISOString(),
    env: config.env,
    expectedModel: config.env.REVIEW_MODEL ?? null,
    reportedModel: null,
    warmUpMs: null,
    ollamaPs: null,
    note: null,
  } satisfies Omit<EnvironmentEntry, 'status'>

  try {
    deps.runner(sshArgs(target), buildSwitchScript(config, target))
  } catch (cause) {
    return { ...base, status: 'switch-failed', note: String(cause) }
  }

  try {
    await deps.waitForHealth()
  } catch (cause) {
    return { ...base, status: 'unhealthy', note: String(cause) }
  }

  let warm: WarmUpResult
  try {
    warm = await deps.warmUp()
  } catch (cause) {
    return { ...base, status: 'unhealthy', note: `warm-up failed: ${cause}` }
  }

  let ollamaPs: string | null = null
  try {
    ollamaPs = deps.runner(sshArgs(target), buildOllamaPsScript(target))
  } catch {
    ollamaPs = null
  }

  const measured = {
    ...base,
    reportedModel: warm.model,
    warmUpMs: warm.wallMs,
    ollamaPs,
  }

  if (base.expectedModel !== null && warm.model !== base.expectedModel) {
    return {
      ...measured,
      status: 'model-mismatch',
      note: `expected ${base.expectedModel} but the server reported ${warm.model ?? 'nothing'}`,
    }
  }

  return { ...measured, status: 'ok' }
}

export function fullyOnGpu(ollamaPs: string | null): boolean | null {
  if (ollamaPs === null) return null
  const lines = ollamaPs
    .split('\n')
    .filter((line) => /\d+%\s*(?:\/\d+%\s*)?[A-Z/]*GPU/.test(line))
  if (lines.length === 0) return null
  return lines.every((line) => line.includes('100% GPU'))
}

export function renderEnvironmentEntry(entry: EnvironmentEntry): string {
  const gpu = fullyOnGpu(entry.ollamaPs)
  const lines = [
    `## ${entry.configId}`,
    '',
    `- 切り替え: ${entry.switchedAt}`,
    `- status: ${entry.status}`,
    `- env: ${Object.keys(entry.env)
      .sort()
      .map((name) => `${name}=${entry.env[name]}`)
      .join(' ')}`,
    `- meta.model: ${entry.reportedModel ?? '-'}`,
    `- warm-up: ${entry.warmUpMs === null ? '-' : `${(entry.warmUpMs / 1000).toFixed(1)}s`}`,
  ]

  if (entry.note !== null) lines.push(`- note: ${entry.note}`)

  lines.push(
    '',
    '```',
    (entry.ollamaPs ?? '(ollama ps を取得できませんでした)').trimEnd(),
    '```',
    '',
  )

  if (gpu === false) {
    lines.push(
      'GPU に載りきっていないため、この config はレイテンシ比較から除外してください。',
      '',
    )
  }

  return lines.join('\n')
}

function fail(where: string, message: string): never {
  throw new Error(`${where}: ${message}`)
}

export function parseConfigs(value: unknown, where: string): EvalConfig[] {
  if (!Array.isArray(value)) fail(where, 'expected an array of configs')

  const configs = value.map((entry, index) => {
    const at = `${where}[${index}]`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      fail(at, 'expected an object')
    }
    const raw = entry as Record<string, unknown>
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
      fail(at, 'id must be a non-empty string')
    }
    if (
      typeof raw.env !== 'object' ||
      raw.env === null ||
      Array.isArray(raw.env)
    ) {
      fail(`${at}.env`, 'expected an object')
    }

    const env: Record<string, string> = {}
    for (const [name, entryValue] of Object.entries(
      raw.env as Record<string, unknown>,
    )) {
      if (!ENV_NAME.test(name)) {
        fail(`${at}.env`, `${JSON.stringify(name)} is not a usable name`)
      }
      if (typeof entryValue !== 'string') {
        fail(`${at}.env.${name}`, 'expected a string')
      }
      env[name] = entryValue
    }

    return { id: raw.id, env }
  })

  const ids = new Set(configs.map((config) => config.id))
  if (ids.size !== configs.length) fail(where, 'config ids must be unique')

  return configs
}

export function loadConfigs(path: string = CONFIGS_PATH): EvalConfig[] {
  return parseConfigs(JSON.parse(readFileSync(path, 'utf8')) as unknown, path)
}
