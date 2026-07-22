export interface Env {
  endpoint: string
  token: string
}

export function readEnv(): Env {
  const endpoint = process.env.EXOCORTEX_ENDPOINT
  const token = process.env.EXOCORTEX_TOKEN

  if (!endpoint || !token) {
    throw new Error('EXOCORTEX_ENDPOINT and EXOCORTEX_TOKEN must be set')
  }

  return { endpoint, token }
}
