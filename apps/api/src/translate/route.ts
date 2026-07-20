import { translateRequestSchema } from '@exocortex/contract'
import type { Hono } from 'hono'
import {
  type OllamaClient,
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { buildTranslatePrompt } from './prompt.js'

export interface TranslateDeps {
  ollama: OllamaClient
  model: string
}

export function registerTranslateRoute(app: Hono, deps: TranslateDeps): void {
  app.post('/translate', async (c) => {
    const parsed = translateRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.message },
        400,
      )
    }

    try {
      const result = await deps.ollama.chat({
        model: deps.model,
        prompt: buildTranslatePrompt(parsed.data),
      })
      return c.json({ text: result.content.trim() })
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
  })
}
