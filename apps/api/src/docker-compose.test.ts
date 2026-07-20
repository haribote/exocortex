import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const composePath = fileURLToPath(
  new URL('../../../docker-compose.yml', import.meta.url),
)
const composeContent = readFileSync(composePath, 'utf-8')
const compose: unknown = parse(composeContent)

if (!isRecord(compose)) {
  throw new Error(`${composePath} did not parse to an object`)
}

const services = compose.services
if (!isRecord(services)) {
  throw new Error(`${composePath} has no "services" object`)
}

function getService(name: string): Record<string, unknown> {
  const service = services[name]
  if (!isRecord(service)) {
    throw new Error(`${composePath} has no "${name}" service`)
  }
  return service
}

function getEnvironment(
  service: Record<string, unknown>,
): Record<string, unknown> {
  const environment = service.environment
  if (!isRecord(environment)) {
    throw new Error('service has no "environment" object')
  }
  return environment
}

const ollama = getService('ollama')
const aiApi = getService('ai-api')

describe('docker-compose.yml', () => {
  it('does not publish any ports for the ollama service', () => {
    expect(
      ollama.ports,
      'ollama must not declare "ports": doing so exposes the unauthenticated Ollama inference API directly to the LAN, defeating the structural guarantee described in docs/design.md',
    ).toBeUndefined()
  })

  it('does not put the ollama service on the host network', () => {
    expect(
      ollama.network_mode,
      'ollama must not use "network_mode: host": it publishes every container port to the host without declaring "ports", defeating the same guarantee',
    ).toBeUndefined()
  })

  it('publishes ai-api on 11435 with matching host and container ports', () => {
    const ports = aiApi.ports
    if (!Array.isArray(ports)) {
      throw new Error('ai-api.ports is not an array')
    }
    expect(ports).toHaveLength(1)
    const [mapping] = ports
    if (typeof mapping !== 'string') {
      throw new Error('ai-api.ports[0] is not a string')
    }
    const [hostPort, containerPort] = mapping.split(':')
    expect(hostPort).toBe('11435')
    expect(containerPort).toBe('11435')
  })

  it('reads API_TOKEN for ai-api from the environment instead of hardcoding it', () => {
    const environment = getEnvironment(aiApi)
    expect(environment.API_TOKEN).toBe(`\${API_TOKEN}`)
  })

  it('sets OLLAMA_CONTEXT_LENGTH and OLLAMA_KV_CACHE_TYPE for the 32K + q8_0 VRAM budget', () => {
    const environment = getEnvironment(ollama)
    expect(environment.OLLAMA_CONTEXT_LENGTH).toBe(32768)
    expect(environment.OLLAMA_KV_CACHE_TYPE).toBe('q8_0')
  })
})
