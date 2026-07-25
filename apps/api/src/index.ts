import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createOllamaClient } from './ollama.js'
import { parseReviewSystemMode, parseReviewThink } from './review/route.js'

const ollamaUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434'
const reviewModel = process.env.REVIEW_MODEL ?? 'qwen3:14b'
const translateModel = process.env.TRANSLATE_MODEL ?? 'translategemma:12b'
const port = Number(process.env.PORT ?? 11435)

const app = createApp({
  ollama: createOllamaClient(ollamaUrl),
  reviewModel,
  translateModel,
  reviewSystemMode: parseReviewSystemMode(process.env.REVIEW_SYSTEM_MODE),
  reviewThinkPrefix: process.env.REVIEW_THINK_PREFIX || undefined,
  reviewThink: parseReviewThink(process.env.REVIEW_THINK),
})

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
