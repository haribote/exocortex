import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN is required')
}

const port = Number(process.env.PORT ?? 11435)
const app = createApp({ apiToken })

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
