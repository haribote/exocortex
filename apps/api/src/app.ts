import { Hono } from 'hono'
import type { OllamaClient, OllamaThink } from './ollama.js'
import type { ReviewSystemMode } from './review/config.js'
import type { BuildReviewInput } from './review/input.js'
import type { BuildPerFilePlan } from './review/per-file.js'
import { registerReviewRoute } from './review/route.js'
import { registerTranslateRoute } from './translate/route.js'

export interface AppDeps {
  ollama: OllamaClient
  reviewModel: string
  translateModel: string
  buildReviewInput?: BuildReviewInput
  buildPerFilePlan?: BuildPerFilePlan
  reviewSystemMode?: ReviewSystemMode
  reviewThink?: OllamaThink
  reviewDebugRaw?: boolean
  reviewIncludeDocs?: boolean
  perFileRequestTimeoutMs?: number
  perFileHeartbeatMs?: number
  heartbeatMs?: number
  headersGraceMs?: number
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  registerReviewRoute(app, {
    ollama: deps.ollama,
    model: deps.reviewModel,
    buildInput: deps.buildReviewInput,
    buildPerFilePlan: deps.buildPerFilePlan,
    systemMode: deps.reviewSystemMode,
    think: deps.reviewThink,
    debugRaw: deps.reviewDebugRaw,
    includeDocs: deps.reviewIncludeDocs,
    perFileRequestTimeoutMs: deps.perFileRequestTimeoutMs,
    perFileHeartbeatMs: deps.perFileHeartbeatMs,
  })
  registerTranslateRoute(app, {
    ollama: deps.ollama,
    model: deps.translateModel,
    heartbeatMs: deps.heartbeatMs,
    headersGraceMs: deps.headersGraceMs,
  })

  return app
}
