import { reviewRequestSchema, reviewResultSchema } from '@exocortex/contract'
import type { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  type OllamaChatResult,
  type OllamaClient,
  OllamaResponseError,
  OllamaStreamError,
  type OllamaThink,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { buildChatRequest, OUT_OF_CONTEXT } from './chat.js'
import type { ReviewSystemMode } from './config.js'
import { InvalidBaseError } from './git.js'
import { type BuildReviewInput, createBuildReviewInput } from './input.js'
import {
  type BuildPerFilePlan,
  createBuildPerFilePlan,
  runPerFileReview,
} from './per-file.js'
import { SnapshotExtractError, SnapshotTooLargeError } from './snapshot.js'
import { verifyComments } from './verify.js'

export interface ReviewDeps {
  ollama: OllamaClient
  model: string
  buildInput?: BuildReviewInput
  buildPerFilePlan?: BuildPerFilePlan
  systemMode?: ReviewSystemMode
  think?: OllamaThink
  debugRaw?: boolean
  includeDocs?: boolean
  perFileRequestTimeoutMs?: number
  perFileHeartbeatMs?: number
}

export const DEBUG_EDGE_CHARS = 1000
const ELLIPSIS = '\n...[truncated]...\n'

export interface ReviewLogEntry {
  outcome: string
  model: string
  inputTokens: number
  elapsedMs: number
  // A request that timed out or never reached ollama has no result to report,
  // and those are the outcomes worth reading afterwards, so the line has to
  // survive without one.
  result?: OllamaChatResult
}

// The api is otherwise silent, so a review that fails leaves nothing behind to
// read afterwards. One line per inference makes the token budget observable
// from the server side instead of only from the ollama runner's own log.
export function logReview(entry: ReviewLogEntry): void {
  const { outcome, model, inputTokens, elapsedMs, result } = entry
  console.log(
    JSON.stringify({
      event: 'review',
      outcome,
      model,
      inputTokens,
      elapsedMs,
      promptEvalTokens: result?.promptEvalTokens,
      outputTokens: result?.outputTokens,
      thinkingChars: result?.thinking?.length,
      doneReason: result?.doneReason,
      durationMs: result?.totalDurationMs,
    }),
  )
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

interface JsonFailure {
  status: 400 | 413
  body: { error: string; message: string }
}

// Both modes read the same archive with the same git arguments, so the ways
// that can fail before any inference starts are the same for both.
function toSnapshotFailure(cause: unknown): JsonFailure | undefined {
  if (cause instanceof SnapshotTooLargeError) {
    return {
      status: 413,
      body: { error: 'snapshot_too_large', message: cause.message },
    }
  }
  if (cause instanceof SnapshotExtractError) {
    return {
      status: 400,
      body: { error: 'invalid_snapshot', message: cause.message },
    }
  }
  if (cause instanceof InvalidBaseError) {
    return {
      status: 400,
      body: { error: 'invalid_request', message: cause.message },
    }
  }
  return undefined
}

const NO_CHANGES: JsonFailure = {
  status: 400,
  body: {
    error: 'no_changes',
    message: 'the snapshot has no changes to review',
  },
}

// Malformed model output is truncated from the middle: JSON breaks at the tail,
// so keeping only the head would hide the very defect this flag exists to show.
// Array.from splits by code point, so an emoji is never cut into lone surrogates.
export function truncateForDebug(text: string): string {
  const chars = Array.from(text)
  if (chars.length <= DEBUG_EDGE_CHARS * 2) {
    return text
  }
  const head = chars.slice(0, DEBUG_EDGE_CHARS).join('')
  const tail = chars.slice(-DEBUG_EDGE_CHARS).join('')
  return `${head}${ELLIPSIS}${tail}`
}

function rawDebug(
  deps: ReviewDeps,
  result: { content: string; thinking?: string },
): { raw: string; thinking?: string } | undefined {
  if (deps.debugRaw !== true) {
    return undefined
  }
  const debug: { raw: string; thinking?: string } = {
    raw: truncateForDebug(result.content),
  }
  if (result.thinking !== undefined) {
    debug.thinking = truncateForDebug(result.thinking)
  }
  return debug
}

export function registerReviewRoute(app: Hono, deps: ReviewDeps): void {
  const buildInput =
    deps.buildInput ?? createBuildReviewInput({ includeDocs: deps.includeDocs })
  const buildPerFilePlan =
    deps.buildPerFilePlan ??
    createBuildPerFilePlan({ includeDocs: deps.includeDocs })

  app.post('/review', async (c) => {
    const form = await c.req.parseBody().catch(() => null)
    if (!form) {
      return c.json(
        { error: 'invalid_request', message: 'expected multipart/form-data' },
        400,
      )
    }

    const rawParams =
      typeof form.params === 'string' ? parseJson(form.params) : null
    const parsed = reviewRequestSchema.safeParse(rawParams)
    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.message },
        400,
      )
    }

    const snapshot = form.snapshot
    if (!(snapshot instanceof File)) {
      return c.json(
        { error: 'invalid_request', message: 'a snapshot file is required' },
        400,
      )
    }

    const bytes = new Uint8Array(await snapshot.arrayBuffer())

    if (parsed.data.mode === 'per-file') {
      let plan: Awaited<ReturnType<BuildPerFilePlan>>
      try {
        plan = await buildPerFilePlan(bytes, parsed.data)
      } catch (cause) {
        const failure = toSnapshotFailure(cause)
        if (failure) return c.json(failure.body, failure.status)
        throw cause
      }

      if (plan.kind === 'no_changes') {
        return c.json(NO_CHANGES.body, NO_CHANGES.status)
      }

      // Status is committed the moment the first byte goes out, so everything
      // that can still fail from here on travels as a line rather than a code.
      c.header('Content-Type', 'application/x-ndjson')
      return stream(
        c,
        async (s) => {
          await runPerFileReview(
            plan,
            {
              ollama: deps.ollama,
              model: deps.model,
              systemMode: deps.systemMode,
              think: deps.think,
              requestTimeoutMs: deps.perFileRequestTimeoutMs,
              heartbeatMs: deps.perFileHeartbeatMs,
            },
            s,
          )
        },
        // runPerFileReview answers for every file it attempts, so reaching here
        // means the loop itself gave way. The line carries no path because no
        // single file owns the failure, and the missing done line still says
        // the run did not finish.
        async (cause, s) => {
          await s.writeln(
            JSON.stringify({ error: 'review_failed', message: String(cause) }),
          )
        },
      )
    }

    let built: Awaited<ReturnType<BuildReviewInput>>
    try {
      built = await buildInput(bytes, parsed.data)
    } catch (cause) {
      const failure = toSnapshotFailure(cause)
      if (failure) return c.json(failure.body, failure.status)
      throw cause
    }

    if (built.kind === 'no_changes') {
      return c.json(NO_CHANGES.body, NO_CHANGES.status)
    }
    if (built.kind === 'too_large') {
      return c.json(
        {
          error: 'context_too_large',
          message: 'the diff alone exceeds the input budget',
        },
        413,
      )
    }

    const startedAt = Date.now()
    const log = (outcome: string, result?: OllamaChatResult) =>
      logReview({
        outcome,
        model: deps.model,
        inputTokens: built.inputTokens,
        elapsedMs: Date.now() - startedAt,
        result,
      })

    let result: Awaited<ReturnType<OllamaClient['chat']>>
    try {
      result = await deps.ollama.chat(buildChatRequest(deps, built.input))
    } catch (cause) {
      if (cause instanceof OllamaTimeoutError) {
        log('inference_timeout')
        return c.json(
          {
            error: 'inference_timeout',
            message: 'ollama did not respond in time',
          },
          504,
        )
      }
      if (cause instanceof OllamaUnreachableError) {
        log('ollama_unreachable')
        return c.json(
          { error: 'ollama_unreachable', message: 'could not reach ollama' },
          503,
        )
      }
      if (
        cause instanceof OllamaResponseError ||
        cause instanceof OllamaStreamError
      ) {
        log('ollama_error')
        return c.json({ error: 'ollama_error', message: cause.message }, 502)
      }
      throw cause
    }

    if (result.doneReason === OUT_OF_CONTEXT) {
      log('context_exhausted', result)
      return c.json(
        {
          error: 'context_exhausted',
          message: 'the model ran out of context before finishing the review',
          ...rawDebug(deps, result),
        },
        502,
      )
    }

    let raw: unknown
    try {
      raw = JSON.parse(result.content)
    } catch {
      log('invalid_model_output', result)
      return c.json(
        {
          error: 'invalid_model_output',
          message: 'model did not return valid json',
          ...rawDebug(deps, result),
        },
        502,
      )
    }

    const review = reviewResultSchema.safeParse(raw)
    if (!review.success) {
      log('invalid_model_output', result)
      return c.json(
        {
          error: 'invalid_model_output',
          message: review.error.message,
          ...rawDebug(deps, result),
        },
        502,
      )
    }

    log('ok', result)

    const verified = verifyComments(
      review.data.comments,
      built.input.contextFiles,
    )

    return c.json({
      summary: review.data.summary,
      comments: verified.kept,
      meta: {
        droppedComments: verified.dropped.length,
        droppedContextFiles: built.droppedContextFiles,
        model: deps.model,
        inputTokens: built.inputTokens,
        durationMs: result.totalDurationMs,
        promptEvalTokens: result.promptEvalTokens,
        outputTokens: result.outputTokens,
        thinkingChars: result.thinking?.length,
        loadDurationMs: result.loadDurationMs,
      },
    })
  })
}
