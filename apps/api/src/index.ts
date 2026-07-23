import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createOllamaClient } from './ollama.js'

const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN is required')
}

const ollamaUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434'
const reviewModel = process.env.REVIEW_MODEL ?? 'qwen3:14b'
const translateModel = process.env.TRANSLATE_MODEL ?? 'translategemma:12b'
const port = Number(process.env.PORT ?? 11435)

const app = createApp({
  apiToken,
  ollama: createOllamaClient(ollamaUrl),
  reviewModel,
  translateModel,
})

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
