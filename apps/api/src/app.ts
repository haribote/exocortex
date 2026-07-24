import { Hono } from 'hono'
import type { OllamaClient } from './ollama.js'
import type { BuildReviewInput } from './review/input.js'
import { registerReviewRoute } from './review/route.js'
import { registerTranslateRoute } from './translate/route.js'

export interface AppDeps {
  ollama: OllamaClient
  reviewModel: string
  translateModel: string
  buildReviewInput?: BuildReviewInput
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  registerReviewRoute(app, {
    ollama: deps.ollama,
    model: deps.reviewModel,
    buildInput: deps.buildReviewInput,
  })
  registerTranslateRoute(app, {
    ollama: deps.ollama,
    model: deps.translateModel,
  })

  return app
}
