import { bearerAuth as honoBearerAuth } from 'hono/bearer-auth'

export function bearerAuth(expectedToken: string) {
  const message = {
    error: 'unauthorized',
    message: 'invalid or missing bearer token',
  }
  return honoBearerAuth({
    token: expectedToken,
    noAuthenticationHeader: { message },
    invalidAuthenticationHeader: { message },
    invalidToken: { message },
  })
}
