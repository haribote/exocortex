import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createOllamaClient } from './ollama.js'
import { loadReviewConfig } from './review/config.js'

const ollamaUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434'
const reviewModel = process.env.REVIEW_MODEL ?? 'gemma4:12b'
const translateModel = process.env.TRANSLATE_MODEL ?? 'translategemma:12b'
const port = Number(process.env.PORT ?? 11435)
const review = loadReviewConfig(process.env)

const app = createApp({
  ollama: createOllamaClient(ollamaUrl),
  reviewModel,
  translateModel,
  reviewSystemMode: review.systemMode,
  reviewThink: review.think,
  reviewDebugRaw: review.debugRaw,
})

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
