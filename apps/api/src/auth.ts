import { createMiddleware } from 'hono/factory'

export function bearerAuth(expectedToken: string) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (header !== `Bearer ${expectedToken}`) {
      return c.json(
        { error: 'unauthorized', message: 'invalid or missing bearer token' },
        401,
      )
    }
    await next()
  })
}
