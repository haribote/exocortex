import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { type EvalCase, loadCases } from './cases.ts'
import {
  callReview,
  callReviewStream,
  DEFAULT_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  type ReviewCall,
  type ReviewOutcome,
} from './client.ts'
import { createFixture, type Fixture } from './fixture.ts'
import { parseResults, RUNS_DIR, type RunRecord } from './report.ts'
import { scoreOutcome } from './score.ts'
import {
  applyConfig,
  type EvalConfig,
  ensureModelsAvailable,
  loadConfigs,
  remoteTarget,
  renderEnvironmentEntry,
  sshRunner,
  type WarmUpResult,
  waitForHealth,
} from './switch.ts'

export const DEFAULT_HEALTH_TIMEOUT_MS = 180_000
export const BASELINE_ID = 'default'
export const CURRENT_LABEL = 'current'

export type ReviewMode = 'whole' | 'per-file'
const REVIEW_MODES: readonly ReviewMode[] = ['whole', 'per-file']

// A per-file run pays for one inference per changed file instead of one for
// the whole diff, so the wall clock it needs scales with file count rather
// than staying under the single-call ceiling DEFAULT_TIMEOUT_MS was set for.
export const PER_FILE_DEFAULT_TIMEOUT_MS = 3_600_000

export interface RunOptions {
  runId: string
  configs: string[] | null
  candidates: string[] | null
  configsFile: string | null
  caseIds: string[] | null
  repeats: number
  endpoint: string
  timeoutMs: number
  mode: ReviewMode
  switchEnabled: boolean
  pull: boolean
  healthTimeoutMs: number
}

export interface ResolvedConfig {
  id: string
  env: Record<string, string> | null
}

function list(value: string | undefined): string[] | null {
  if (value === undefined) return null
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function parseOptions(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
): RunOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      run: { type: 'string', default: 'default' },
      configs: { type: 'string' },
      candidates: { type: 'string' },
      'configs-file': { type: 'string' },
      cases: { type: 'string' },
      repeats: { type: 'string', default: '1' },
      endpoint: { type: 'string', default: DEFAULT_ENDPOINT },
      timeout: { type: 'string' },
      mode: { type: 'string', default: 'whole' },
      switch: { type: 'boolean', default: false },
      pull: { type: 'boolean', default: false },
      'health-timeout': {
        type: 'string',
        default: String(DEFAULT_HEALTH_TIMEOUT_MS),
      },
    },
  })

  const repeats = Number(values.repeats)
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error(`--repeats must be a positive integer: ${values.repeats}`)
  }

  const mode = values.mode as ReviewMode
  if (!REVIEW_MODES.includes(mode)) {
    throw new Error(`--mode must be one of ${REVIEW_MODES.join(', ')}: ${mode}`)
  }

  const timeoutMs =
    values.timeout === undefined
      ? mode === 'per-file'
        ? PER_FILE_DEFAULT_TIMEOUT_MS
        : DEFAULT_TIMEOUT_MS
      : Number(values.timeout)

  const switchEnabled = values.switch === true || env.EXOCORTEX_SWITCH === '1'
  if (!switchEnabled) {
    const only = (name: string): string =>
      `--${name} needs --switch: only then does the harness set the model on the server`
    if (values.candidates !== undefined) throw new Error(only('candidates'))
    if (values['configs-file'] !== undefined)
      throw new Error(only('configs-file'))
    if (values.pull === true) throw new Error(only('pull'))
  }

  return {
    runId: values.run as string,
    configs: list(values.configs),
    candidates: list(values.candidates),
    configsFile: values['configs-file'] ?? null,
    caseIds: list(values.cases),
    repeats,
    endpoint: values.endpoint as string,
    timeoutMs,
    mode,
    switchEnabled,
    pull: values.pull === true,
    healthTimeoutMs: Number(values['health-timeout']),
  }
}

// The baseline comes first so every candidate is measured against it in the same
// order of cases, which is what makes the pair comparison in summary.md hold.
export function composeConfigs(
  fromRepo: readonly EvalConfig[],
  fromFile: readonly EvalConfig[],
  candidates: readonly string[],
): EvalConfig[] {
  const byId = new Map<string, EvalConfig>()
  const add = (config: EvalConfig): void => {
    if (!byId.has(config.id)) byId.set(config.id, config)
  }

  const baseline =
    fromFile.find((config) => config.id === BASELINE_ID) ??
    fromRepo.find((config) => config.id === BASELINE_ID)
  if (baseline !== undefined) add(baseline)

  for (const config of fromRepo) add(config)
  for (const config of fromFile) add(config)
  for (const model of candidates)
    add({ id: model, env: { REVIEW_MODEL: model } })

  return [...byId.values()]
}

export function definedConfigs(options: RunOptions): EvalConfig[] {
  if (!options.switchEnabled) return []

  if (options.configsFile !== null && !existsSync(options.configsFile)) {
    throw new Error(`no such configs file: ${options.configsFile}`)
  }

  return composeConfigs(
    loadConfigs(),
    options.configsFile === null ? [] : loadConfigs(options.configsFile),
    options.candidates ?? [],
  )
}

// Without --switch the harness never touches the server: configs stay plain
// labels and a mismatched model is only a warning, as it was before switching
// existed. Restarting a production service is opt-in.
export function resolveConfigs(
  options: RunOptions,
  defined: readonly EvalConfig[],
): ResolvedConfig[] {
  if (!options.switchEnabled) {
    return (options.configs ?? [CURRENT_LABEL]).map((id) => ({ id, env: null }))
  }

  if (options.configs === null) {
    return defined.map((config) => ({ id: config.id, env: config.env }))
  }

  return options.configs.map((id) => {
    const found = defined.find((config) => config.id === id)
    if (!found) {
      throw new Error(
        `no such config: ${id} (have ${defined.map((config) => config.id).join(', ')})`,
      )
    }
    return { id: found.id, env: found.env }
  })
}

export function requiredModels(configs: readonly ResolvedConfig[]): string[] {
  const models: string[] = []
  for (const config of configs) {
    const model = config.env?.REVIEW_MODEL
    if (model === undefined || models.includes(model)) continue
    models.push(model)
  }
  return models
}

function selectCases(options: RunOptions): EvalCase[] {
  const all = loadCases()
  if (!options.caseIds) return all

  return options.caseIds.map((id) => {
    const found = all.find((evalCase) => evalCase.spec.id === id)
    if (!found) throw new Error(`no such case: ${id}`)
    return found
  })
}

function doneKey(configId: string, caseId: string, repeat: number): string {
  return [configId, caseId, repeat].join('\t')
}

function readDone(resultsPath: string): Set<string> {
  if (!existsSync(resultsPath)) return new Set()
  const records = parseResults(readFileSync(resultsPath, 'utf8'))
  return new Set(
    records.map((record) =>
      doneKey(record.configId, record.caseId, record.repeat),
    ),
  )
}

function reviewCall(options: RunOptions, fixture: Fixture): ReviewCall {
  return {
    archive: fixture.archive,
    params: { ...fixture.params, mode: options.mode },
    endpoint: options.endpoint,
    timeoutMs: options.timeoutMs,
  }
}

function runReview(
  options: RunOptions,
  fixture: Fixture,
): Promise<ReviewOutcome> {
  const call = reviewCall(options, fixture)
  return options.mode === 'per-file' ? callReviewStream(call) : callReview(call)
}

async function measure(
  options: RunOptions,
  configId: string,
  evalCase: EvalCase,
  repeat: number,
): Promise<RunRecord> {
  const fixture = createFixture(evalCase)
  try {
    const outcome = await runReview(options, fixture)
    const score = scoreOutcome(
      { files: evalCase.treeFiles, expected: evalCase.expected },
      outcome,
    )
    const record: RunRecord = {
      runId: options.runId,
      configId,
      caseId: evalCase.spec.id,
      repeat,
      startedAt: new Date().toISOString(),
      mode: options.mode,
      model: outcome.response?.meta.model ?? null,
      summary: outcome.response?.summary ?? null,
      comments: outcome.response?.comments ?? [],
      score,
    }
    if (outcome.perFile !== undefined) record.perFile = outcome.perFile
    if (!score.schemaOk) record.body = outcome.body
    return record
  } finally {
    fixture.cleanup()
  }
}

async function warmUp(
  options: RunOptions,
  evalCase: EvalCase,
): Promise<WarmUpResult> {
  const fixture = createFixture(evalCase)
  try {
    const outcome = await runReview(options, fixture)
    return {
      model: outcome.response?.meta.model ?? null,
      wallMs: outcome.wallMs,
      status: outcome.status,
    }
  } finally {
    fixture.cleanup()
  }
}

// The first request after a switch pays for loading the model into VRAM, so its
// result is thrown away rather than recorded alongside the measured ones.
async function prepare(
  options: RunOptions,
  config: ResolvedConfig,
  warmUpCase: EvalCase,
  environmentPath: string,
): Promise<boolean> {
  if (config.env === null) return true

  const entry = await applyConfig(
    { id: config.id, env: config.env },
    remoteTarget(),
    {
      runner: sshRunner,
      waitForHealth: () =>
        waitForHealth({
          endpoint: options.endpoint,
          timeoutMs: options.healthTimeoutMs,
        }),
      warmUp: () => warmUp(options, warmUpCase),
      now: () => new Date(),
    },
  )

  appendFileSync(environmentPath, renderEnvironmentEntry(entry))
  console.log(`${config.id}: switch ${entry.status}`)

  if (entry.status !== 'ok') {
    console.error(`${config.id}: skipped, ${entry.note ?? entry.status}`)
    process.exitCode = 1
    return false
  }
  return true
}

function describe(record: RunRecord): string {
  const score = record.score
  return [
    `${record.configId} ${record.caseId} #${record.repeat}`,
    `status=${score.status}`,
    `comments=${score.comments}`,
    `quote=${score.quoteMatches}/${score.comments}`,
    `hit@±2=${score.hitNear2}/${score.expectedTotal}`,
    `unmatched=${score.unmatchedComments}`,
    `wall=${(score.wallMs / 1000).toFixed(1)}s`,
  ].join(' ')
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const cases = selectCases(options)
  const warmUpCase = cases[0]
  if (warmUpCase === undefined) throw new Error('no cases selected')

  const configs = resolveConfigs(options, definedConfigs(options))

  if (options.switchEnabled) {
    try {
      ensureModelsAvailable(requiredModels(configs), remoteTarget(), {
        runner: sshRunner,
        pull: options.pull,
        log: (message) => console.log(message),
      })
    } catch (cause) {
      console.error(cause instanceof Error ? cause.message : String(cause))
      process.exitCode = 1
      return
    }
  }

  const dir = join(RUNS_DIR, options.runId)
  mkdirSync(dir, { recursive: true })

  const resultsPath = join(dir, 'results.ndjson')
  const environmentPath = join(dir, 'environment.md')
  const done = readDone(resultsPath)

  for (const config of configs) {
    const configId = config.id
    const expectedModel = config.env?.REVIEW_MODEL ?? configId

    if (!(await prepare(options, config, warmUpCase, environmentPath))) {
      continue
    }

    for (const evalCase of cases) {
      for (let repeat = 1; repeat <= options.repeats; repeat++) {
        const key = doneKey(configId, evalCase.spec.id, repeat)
        if (done.has(key)) {
          console.log(`skip ${key.replaceAll('\t', ' ')} (already recorded)`)
          continue
        }

        let record: RunRecord
        try {
          record = await measure(options, configId, evalCase, repeat)
        } catch (cause) {
          console.error(
            `transport failure on ${key.replaceAll('\t', ' ')}: ${String(cause)}`,
          )
          console.error(
            `nothing was recorded for it. fix the tunnel and re-run with --run ${options.runId} to resume.`,
          )
          process.exitCode = 1
          return
        }

        if (record.model !== null && record.model !== expectedModel) {
          console.warn(
            `warning: config ${configId} but the server reported model ${record.model}`,
          )
        }

        appendFileSync(resultsPath, `${JSON.stringify(record)}\n`)
        done.add(key)
        console.log(describe(record))
      }
    }
  }

  console.log(`results are in ${resultsPath}`)
}

if (process.argv[1] === import.meta.filename) {
  await main()
}
