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

export type ReviewSystemMode = 'none' | 'prefix'

export interface ReviewDeps {
  ollama: OllamaClient
  model: string
  buildInput?: BuildReviewInput
  systemMode?: ReviewSystemMode
  thinkPrefix?: string
  think?: OllamaThink
}

const RAW_DEBUG_LIMIT = 2000

export function parseReviewSystemMode(
  value: string | undefined,
): ReviewSystemMode {
  return value === 'prefix' ? 'prefix' : 'none'
}

export function parseReviewThink(
  value: string | undefined,
): OllamaThink | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  if (value === 'true' || value === 'false') {
    return value === 'true'
  }
  return value
}

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
    request.system = `${deps.thinkPrefix ?? ''}${SYSTEM_INSTRUCTION}`
  }
  if (deps.think !== undefined) {
    request.think = deps.think
  }
  return request
}

function rawDebug(content: string): { raw: string } | undefined {
  if (process.env.REVIEW_DEBUG_RAW !== '1') {
    return undefined
  }
  return { raw: content.slice(0, RAW_DEBUG_LIMIT) }
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
          ...rawDebug(result.content),
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
          ...rawDebug(result.content),
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
        loadDurationMs: result.loadDurationMs,
      },
    })
  })
}
