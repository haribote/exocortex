import {
  reviewRequestSchema,
  reviewResultJsonSchema,
  reviewResultSchema,
} from '@exocortex/contract'
import type { Hono } from 'hono'
import {
  type OllamaClient,
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { InvalidBaseError } from './git.js'
import { type BuildReviewInput, createBuildReviewInput } from './input.js'
import { buildReviewPrompt } from './prompt.js'
import { SnapshotExtractError, SnapshotTooLargeError } from './snapshot.js'
import { verifyComments } from './verify.js'

export interface ReviewDeps {
  ollama: OllamaClient
  model: string
  buildInput?: BuildReviewInput
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
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
      result = await deps.ollama.chat({
        model: deps.model,
        prompt: buildReviewPrompt(built.input),
        format: reviewResultJsonSchema,
        temperature: 0,
      })
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
        },
        502,
      )
    }

    const review = reviewResultSchema.safeParse(raw)
    if (!review.success) {
      return c.json(
        { error: 'invalid_model_output', message: review.error.message },
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
      },
    })
  })
}
