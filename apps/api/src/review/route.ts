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
import { buildReviewPrompt, checkInputSize } from './prompt.js'
import { verifyComments } from './verify.js'

export interface ReviewDeps {
  ollama: OllamaClient
  model: string
}

export function registerReviewRoute(app: Hono, deps: ReviewDeps): void {
  app.post('/review', async (c) => {
    const parsed = reviewRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.message },
        400,
      )
    }

    const request = parsed.data
    const size = checkInputSize(request)
    if (!size.ok) {
      return c.json(
        {
          error: 'context_too_large',
          message: `estimated ${size.inputTokens} input tokens exceeds the budget`,
          contextFiles: size.contextFiles,
        },
        413,
      )
    }

    let result: Awaited<ReturnType<OllamaClient['chat']>>
    try {
      result = await deps.ollama.chat({
        model: deps.model,
        prompt: buildReviewPrompt(request),
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

    const verified = verifyComments(review.data.comments, request.context.files)

    return c.json({
      summary: review.data.summary,
      comments: verified.kept,
      meta: {
        droppedComments: verified.dropped.length,
        model: deps.model,
        inputTokens: size.inputTokens,
        durationMs: result.totalDurationMs,
      },
    })
  })
}
