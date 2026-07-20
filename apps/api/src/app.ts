import { Hono } from 'hono'
import { bearerAuth } from './auth.js'

export interface AppDeps {
  apiToken: string
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.use('/review', bearerAuth(deps.apiToken))
  app.use('/translate', bearerAuth(deps.apiToken))

  app.post('/review', (c) =>
    c.json({ error: 'not_implemented', message: 'not implemented yet' }, 501),
  )

  return app
}
