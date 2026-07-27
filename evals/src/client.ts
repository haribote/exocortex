import { readFileSync } from 'node:fs'
import {
  type PerFileDone,
  type PerFileResult,
  type ReviewResponse,
  reviewResponseSchema,
  reviewStreamLineSchema,
} from '@exocortex/contract'
import { Agent, type Dispatcher, FormData, fetch } from 'undici'

export const DEFAULT_ENDPOINT = 'http://localhost:11435'
// The server gives one /review call 900000 before it answers with
// inference_timeout. Aborting here first would replace that answer with a
// client-side error and hide the outcome the run is meant to record.
export const DEFAULT_TIMEOUT_MS = 960_000

// /review answers only once the whole review is written, so its response headers
// arrive minutes after the request goes out. undici caps that wait at 300000 by
// default and no AbortSignal raises it, which ended long runs as a transport
// failure at five minutes. The ceiling on the call belongs to the signal above,
// so both timers are off here. Node's built-in fetch rejects an Agent from this
// package, hence undici's own fetch.
export const reviewDispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
})

export interface ReviewParams {
  language: string
  base?: string
  staged?: boolean
  rules?: string[]
  mode?: 'whole' | 'per-file'
}

export interface ReviewCall {
  archive: string
  params: ReviewParams
  endpoint?: string
  timeoutMs?: number
  dispatcher?: Dispatcher
}

export interface PerFileBreakdown {
  reviewed: number
  skipped: number
  failed: number
  heartbeats: number
  completed: boolean
  // A failure that named no file, which is the run itself giving way rather
  // than any one review. It comes with completed false.
  runError?: string
  files: {
    file: string
    ok: boolean
    error?: string
    thinkingChars?: number
    promptEvalTokens?: number
    durationMs?: number
  }[]
}

export interface ReviewOutcome {
  status: number
  body: string
  wallMs: number
  response?: ReviewResponse
  // reviewResponseSchema strips meta fields it does not declare, so anything the
  // server grows before the contract catches up is only visible here.
  raw?: unknown
  parseError?: string
  // Only set for a per-file call: the per-line record scoreOutcome has no need
  // for, kept alongside the merged ReviewResponse it is folded into.
  perFile?: PerFileBreakdown
}

interface RawCall {
  status: number
  body: string
  wallMs: number
}

async function postReview(call: ReviewCall): Promise<RawCall> {
  const endpoint = call.endpoint ?? DEFAULT_ENDPOINT
  const form = new FormData()
  form.set('params', JSON.stringify(call.params))
  form.set(
    'snapshot',
    new File([readFileSync(call.archive)], 'snapshot.tgz', {
      type: 'application/gzip',
    }),
  )

  const startedAt = performance.now()
  const response = await fetch(`${endpoint}/review`, {
    method: 'POST',
    body: form,
    dispatcher: call.dispatcher ?? reviewDispatcher,
    signal: AbortSignal.timeout(call.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  const body = await response.text()
  const wallMs = Math.round(performance.now() - startedAt)

  return { status: response.status, body, wallMs }
}

function parseJsonOutcome(posted: RawCall): ReviewOutcome {
  const outcome: ReviewOutcome = posted
  let parsed: unknown
  try {
    parsed = JSON.parse(posted.body)
  } catch {
    outcome.parseError = 'response body is not json'
    return outcome
  }

  outcome.raw = parsed
  const result = reviewResponseSchema.safeParse(parsed)
  if (result.success) {
    outcome.response = result.data
  } else {
    outcome.parseError = result.error.message
  }

  return outcome
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

// Sums fields the contract marks optional (promptEvalTokens, outputTokens,
// thinkingChars): a value missing on one file's result counts as 0, but a
// field no file ever reported stays undefined rather than reading as 0.
function sumOptional(
  values: readonly (number | undefined)[],
): number | undefined {
  if (values.every((value) => value === undefined)) return undefined
  return values.reduce((total: number, value) => total + (value ?? 0), 0)
}

function parseStreamOutcome(posted: RawCall): ReviewOutcome {
  const lines = posted.body.split('\n').filter((line) => line.trim().length > 0)

  const results: PerFileResult[] = []
  const files: PerFileBreakdown['files'] = []
  let heartbeats = 0
  let done: PerFileDone | undefined
  let parseError: string | undefined
  let runError: string | undefined

  lines.forEach((line, index) => {
    let parsedLine: unknown
    try {
      parsedLine = JSON.parse(line)
    } catch {
      parseError ??= `line ${index + 1} is not valid json`
      return
    }

    const result = reviewStreamLineSchema.safeParse(parsedLine)
    if (!result.success) {
      parseError ??= `line ${index + 1}: ${result.error.message}`
      return
    }

    const value = result.data
    if ('heartbeat' in value) {
      heartbeats += 1
    } else if ('done' in value) {
      done = value
    } else if ('error' in value) {
      if ('file' in value) {
        files.push({ file: value.file, ok: false, error: value.error })
      } else {
        runError ??= value.error
      }
    } else {
      results.push(value)
      files.push({
        file: value.file,
        ok: true,
        thinkingChars: value.meta.thinkingChars,
        promptEvalTokens: value.meta.promptEvalTokens,
        durationMs: value.meta.durationMs,
      })
    }
  })

  const response: ReviewResponse = {
    summary: results.map((result) => result.summary).join('\n'),
    comments: results.flatMap((result) => result.comments),
    meta: {
      model: done?.meta.model ?? results[0]?.meta.model ?? '',
      durationMs: done?.meta.durationMs ?? posted.wallMs,
      inputTokens: sum(results.map((result) => result.meta.inputTokens)),
      droppedComments: sum(
        results.map((result) => result.meta.droppedComments),
      ),
      droppedContextFiles: sum(
        results.map((result) => result.meta.droppedContextFiles),
      ),
      promptEvalTokens: sumOptional(
        results.map((result) => result.meta.promptEvalTokens),
      ),
      outputTokens: sumOptional(
        results.map((result) => result.meta.outputTokens),
      ),
      thinkingChars: sumOptional(
        results.map((result) => result.meta.thinkingChars),
      ),
    },
  }

  const perFile: PerFileBreakdown = {
    reviewed: done?.meta.reviewed ?? results.length,
    skipped: done?.meta.skipped ?? 0,
    failed: done?.meta.failed ?? files.filter((file) => !file.ok).length,
    heartbeats,
    completed: done !== undefined,
    files,
  }
  if (runError !== undefined) perFile.runError = runError

  const outcome: ReviewOutcome = {
    ...posted,
    raw: response,
    response,
    perFile,
  }
  if (parseError !== undefined) outcome.parseError = parseError
  return outcome
}

export async function callReview(call: ReviewCall): Promise<ReviewOutcome> {
  return parseJsonOutcome(await postReview(call))
}

// Per-file mode answers with application/x-ndjson instead of one JSON body: a
// result line per reviewed file, heartbeats while ollama is still thinking,
// an error line for a file that failed on its own, and a done line with the
// run's totals (absent if ollama itself went unreachable mid-run). Folding
// that into a ReviewResponse-shaped outcome is what lets scoreOutcome stay
// untouched; the per-line detail survives separately in outcome.perFile.
export async function callReviewStream(
  call: ReviewCall,
): Promise<ReviewOutcome> {
  const posted = await postReview(call)
  // A pre-inference failure (invalid_request, no_changes, ...) answers with a
  // plain JSON error body and a non-200 status, same as whole mode.
  if (posted.status !== 200) return parseJsonOutcome(posted)
  return parseStreamOutcome(posted)
}
