import {
  estimateTokens,
  MAX_INPUT_TOKENS,
  type PerFileResult,
  type ReviewRequest,
  reviewResultSchema,
} from '@exocortex/contract'
import {
  type OllamaChatResult,
  type OllamaClient,
  OllamaResponseError,
  OllamaStreamError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { buildChatRequest, type ChatConfig, OUT_OF_CONTEXT } from './chat.js'
import { type CollectOptions, collectCandidates } from './context.js'
import { collectDiff, collectFileDiff, type DiffOptions } from './git.js'
import {
  baseInputTokens,
  buildReviewPrompt,
  packContext,
  type ReviewPromptInput,
} from './prompt.js'
import { extractSnapshot } from './snapshot.js'
import { selectTargets } from './targets.js'
import { verifyComments } from './verify.js'

// One file has no reason to need the ceiling a whole pull request does. The
// longest review that ever finished took 298s on the largest prompt in the
// eval corpus, and a shorter deadline is what lets a file whose thinking has
// run away be abandoned while the rest of the run continues.
export const PER_FILE_REQUEST_TIMEOUT_MS = 300_000
const DEFAULT_HEARTBEAT_MS = 5000

export interface PerFileInput {
  path: string
  input: ReviewPromptInput
  inputTokens: number
  droppedContextFiles: number
}

export type PerFileTarget =
  | ({ kind: 'ok' } & PerFileInput)
  | { kind: 'too_large'; path: string }

export interface PerFilePlan {
  targets: PerFileTarget[]
  skipped: number
}

export type PerFilePlanResult =
  | ({ kind: 'ok' } & PerFilePlan)
  | { kind: 'no_changes' }

export type BuildPerFilePlan = (
  snapshot: Uint8Array,
  params: ReviewRequest,
) => Promise<PerFilePlanResult>

// The whole plan is built before any inference runs so the extracted snapshot
// can be thrown away first. Holding a temporary directory open for the ten
// minutes the inferences take would outlast the request that asked for it.
export function createBuildPerFilePlan(
  options: CollectOptions = {},
): BuildPerFilePlan {
  return async (snapshot, params) => {
    const { dir, cleanup } = await extractSnapshot(snapshot)
    try {
      const diffOptions: DiffOptions = {
        cwd: dir,
        base: params.base,
        staged: params.staged,
      }
      const { changedFiles } = collectDiff(diffOptions)
      if (changedFiles.length === 0) {
        return { kind: 'no_changes' }
      }

      const selected = selectTargets({
        root: dir,
        changedFiles,
        language: params.language,
      })

      const targets: PerFileTarget[] = []
      let skipped = selected.skipped

      for (const path of selected.targets) {
        const diff = collectFileDiff(diffOptions, path)
        if (diff.length === 0) {
          skipped += 1
          continue
        }

        const base = { language: params.language, diff, rules: params.rules }
        if (baseInputTokens(base) > MAX_INPUT_TOKENS) {
          targets.push({ kind: 'too_large', path })
          continue
        }

        const candidates = collectCandidates(dir, [path], options)
        const { files, dropped } = packContext(base, candidates)
        const input: ReviewPromptInput = { ...base, contextFiles: files }

        targets.push({
          kind: 'ok',
          path,
          input,
          inputTokens: estimateTokens(buildReviewPrompt(input)),
          droppedContextFiles: dropped,
        })
      }

      return { kind: 'ok', targets, skipped }
    } finally {
      await cleanup()
    }
  }
}

export interface PerFileRunDeps extends ChatConfig {
  ollama: Pick<OllamaClient, 'chat'>
  requestTimeoutMs?: number
  heartbeatMs?: number
}

// Matches the subset of hono's StreamingApi the runner needs, so the route can
// hand its stream straight over and a test can hand over an array.
export interface PerFileStream {
  writeln(line: string): Promise<unknown>
  readonly aborted: boolean
}

interface LineError {
  error: string
  message: string
}

function toLineError(cause: unknown): LineError {
  if (cause instanceof OllamaTimeoutError) {
    return {
      error: 'inference_timeout',
      message: 'ollama did not respond in time',
    }
  }
  if (cause instanceof OllamaUnreachableError) {
    return { error: 'ollama_unreachable', message: 'could not reach ollama' }
  }
  if (
    cause instanceof OllamaResponseError ||
    cause instanceof OllamaStreamError
  ) {
    return { error: 'ollama_error', message: cause.message }
  }
  return { error: 'ollama_error', message: 'ollama failed' }
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown }

// Ollama says nothing at all until a file's review is written, and the tunnel
// between the client and the api drops a connection that stays quiet. The
// heartbeat exists for that link, not for the model.
async function withHeartbeat<T>(
  promise: Promise<T>,
  stream: PerFileStream,
  heartbeatMs: number,
): Promise<T> {
  const settled: Promise<Settled<T>> = promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  )

  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = new Promise<'tick'>((resolve) => {
      timer = setTimeout(() => resolve('tick'), heartbeatMs)
    })

    try {
      const winner = await Promise.race([settled, tick])
      if (winner !== 'tick') {
        if (winner.ok) return winner.value
        throw winner.error
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }

    await stream.writeln('{"heartbeat":true}')
  }
}

function reviewOf(
  target: PerFileInput,
  result: OllamaChatResult,
  model: string,
): { line: PerFileResult } | { failure: LineError } {
  if (result.doneReason === OUT_OF_CONTEXT) {
    return {
      failure: {
        error: 'context_exhausted',
        message: 'the model ran out of context before finishing the review',
      },
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(result.content)
  } catch {
    return {
      failure: {
        error: 'invalid_model_output',
        message: 'model did not return valid json',
      },
    }
  }

  const review = reviewResultSchema.safeParse(raw)
  if (!review.success) {
    return {
      failure: { error: 'invalid_model_output', message: review.error.message },
    }
  }

  const verified = verifyComments(
    review.data.comments,
    target.input.contextFiles,
  )

  return {
    line: {
      file: target.path,
      summary: review.data.summary,
      comments: verified.kept,
      meta: {
        droppedComments: verified.dropped.length,
        droppedContextFiles: target.droppedContextFiles,
        model,
        inputTokens: target.inputTokens,
        durationMs: result.totalDurationMs,
        promptEvalTokens: result.promptEvalTokens,
        outputTokens: result.outputTokens,
        thinkingChars: result.thinking?.length,
        loadDurationMs: result.loadDurationMs,
      },
    },
  }
}

export async function runPerFileReview(
  plan: PerFilePlan,
  deps: PerFileRunDeps,
  stream: PerFileStream,
): Promise<void> {
  const heartbeatMs = deps.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
  const requestTimeoutMs = deps.requestTimeoutMs ?? PER_FILE_REQUEST_TIMEOUT_MS
  const startedAt = Date.now()
  let reviewed = 0
  let failed = 0

  const writeError = async (file: string, failure: LineError) => {
    failed += 1
    await stream.writeln(JSON.stringify({ file, ...failure }))
  }

  for (const target of plan.targets) {
    if (stream.aborted) return

    if (target.kind === 'too_large') {
      await writeError(target.path, {
        error: 'context_too_large',
        message: 'the diff of this file alone exceeds the input budget',
      })
      continue
    }

    let result: OllamaChatResult
    try {
      result = await withHeartbeat(
        deps.ollama.chat(buildChatRequest(deps, target.input), {
          requestTimeoutMs,
        }),
        stream,
        heartbeatMs,
      )
    } catch (cause) {
      const failure = toLineError(cause)
      await writeError(target.path, failure)
      // Every other failure is this file's problem, but an unreachable ollama
      // is the run's. Leaving the done line out is what tells the client the
      // remaining files were never attempted.
      if (cause instanceof OllamaUnreachableError) return
      continue
    }

    const outcome = reviewOf(target, result, deps.model)
    if ('failure' in outcome) {
      await writeError(target.path, outcome.failure)
      continue
    }

    reviewed += 1
    await stream.writeln(JSON.stringify(outcome.line))
  }

  // A done line carrying no result reads as "reviewed, nothing found" to any
  // client that stops at the result lines, and that is the opposite of what a
  // run whose every file ran away means. Only a run that reviewed nothing while
  // failing at something takes this exit: a plan with no targets at all really
  // did finish with nothing to say.
  if (reviewed === 0 && failed > 0) {
    await stream.writeln(
      JSON.stringify({
        error: 'all_files_failed',
        message: 'every file in the run failed to review',
      }),
    )
    return
  }

  await stream.writeln(
    JSON.stringify({
      done: true,
      meta: {
        model: deps.model,
        reviewed,
        skipped: plan.skipped,
        failed,
        durationMs: Date.now() - startedAt,
      },
    }),
  )
}
