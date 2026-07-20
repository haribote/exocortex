import { Hono } from 'hono'
import { bearerAuth } from './auth.js'
import type { OllamaClient } from './ollama.js'
import { registerReviewRoute } from './review/route.js'
import { registerTranslateRoute } from './translate/route.js'

export interface AppDeps {
  apiToken: string
  ollama: OllamaClient
  reviewModel: string
  translateModel: string
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.use('/review', bearerAuth(deps.apiToken))
  app.use('/translate', bearerAuth(deps.apiToken))

  registerReviewRoute(app, { ollama: deps.ollama, model: deps.reviewModel })
  registerTranslateRoute(app, {
    ollama: deps.ollama,
    model: deps.translateModel,
  })

  return app
}
