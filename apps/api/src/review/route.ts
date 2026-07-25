import {
  reviewRequestSchema,
  reviewResultJsonSchema,
  reviewResultSchema,
} from '@exocortex/contract'
import type { Hono } from 'hono'
import {
  type OllamaChatRequest,
  type OllamaClient,
  OllamaResponseError,
  type OllamaThink,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import type { ReviewSystemMode } from './config.js'
import { InvalidBaseError } from './git.js'
import { type BuildReviewInput, createBuildReviewInput } from './input.js'
import {
  buildReviewBody,
  buildReviewPrompt,
  type ReviewPromptInput,
  SYSTEM_INSTRUCTION,
} from './prompt.js'
import { SnapshotExtractError, SnapshotTooLargeError } from './snapshot.js'
import { verifyComments } from './verify.js'

export interface ReviewDeps {
  ollama: OllamaClient
  model: string
  buildInput?: BuildReviewInput
  systemMode?: ReviewSystemMode
  think?: OllamaThink
  debugRaw?: boolean
}

export const DEBUG_EDGE_CHARS = 1000
const ELLIPSIS = '\n...[truncated]...\n'

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function buildChatRequest(
  deps: ReviewDeps,
  input: ReviewPromptInput,
): OllamaChatRequest {
  const request: OllamaChatRequest = {
    model: deps.model,
    prompt:
      deps.systemMode === 'prefix'
        ? buildReviewBody(input)
        : buildReviewPrompt(input),
    format: reviewResultJsonSchema,
    temperature: 0,
  }
  if (deps.systemMode === 'prefix') {
    request.system = SYSTEM_INSTRUCTION
  }
  if (deps.think !== undefined) {
    request.think = deps.think
  }
  return request
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
  const buildInput = deps.buildInput ?? createBuildReviewInput()

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

    let built: Awaited<ReturnType<BuildReviewInput>>
    try {
      built = await buildInput(
        new Uint8Array(await snapshot.arrayBuffer()),
        parsed.data,
      )
    } catch (cause) {
      if (cause instanceof SnapshotTooLargeError) {
        return c.json(
          { error: 'snapshot_too_large', message: cause.message },
          413,
        )
      }
      if (cause instanceof SnapshotExtractError) {
        return c.json(
          { error: 'invalid_snapshot', message: cause.message },
          400,
        )
      }
      if (cause instanceof InvalidBaseError) {
        return c.json({ error: 'invalid_request', message: cause.message }, 400)
      }
      throw cause
    }

    if (built.kind === 'no_changes') {
      return c.json(
        {
          error: 'no_changes',
          message: 'the snapshot has no changes to review',
        },
        400,
      )
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

    let result: Awaited<ReturnType<OllamaClient['chat']>>
    try {
      result = await deps.ollama.chat(buildChatRequest(deps, built.input))
    } catch (cause) {
      if (cause instanceof OllamaTimeoutError) {
        return c.json(
          {
            error: 'inference_timeout',
            message: 'ollama did not respond in time',
          },
          504,
        )
      }
      if (cause instanceof OllamaUnreachableError) {
        return c.json(
          { error: 'ollama_unreachable', message: 'could not reach ollama' },
          503,
        )
      }
      if (cause instanceof OllamaResponseError) {
        return c.json({ error: 'ollama_error', message: cause.message }, 502)
      }
      throw cause
    }

    let raw: unknown
    try {
      raw = JSON.parse(result.content)
    } catch {
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
      return c.json(
        {
          error: 'invalid_model_output',
          message: review.error.message,
          ...rawDebug(deps, result),
        },
        502,
      )
    }

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
