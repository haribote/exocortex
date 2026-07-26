import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MAX_CONTEXT_TOKENS } from '@exocortex/contract'
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
      'ollama must not declare "ports": doing so exposes the unauthenticated Ollama inference API directly to the LAN, defeating the structural guarantee that only ai-api is reachable from outside the compose network',
    ).toBeUndefined()
  })

  it('does not put the ollama service on the host network', () => {
    expect(
      ollama.network_mode,
      'ollama must not use "network_mode: host": it publishes every container port to the host without declaring "ports", defeating the same guarantee',
    ).toBeUndefined()
  })

  it('publishes ai-api on loopback only, with matching host and container ports', () => {
    const ports = aiApi.ports
    if (!Array.isArray(ports)) {
      throw new Error('ai-api.ports is not an array')
    }
    expect(ports).toHaveLength(1)
    const [mapping] = ports
    if (typeof mapping !== 'string') {
      throw new Error('ai-api.ports[0] is not a string')
    }
    const [bindAddress, hostPort, containerPort] = mapping.split(':')
    expect(
      bindAddress,
      'ai-api must bind to 127.0.0.1: publishing on every interface exposes the now unauthenticated API to the LAN, and clients are expected to reach it through an SSH tunnel instead',
    ).toBe('127.0.0.1')
    expect(hostPort).toBe('11435')
    expect(containerPort).toBe('11435')
  })

  it('passes no API_TOKEN to ai-api', () => {
    const environment = getEnvironment(aiApi)
    expect(
      environment.API_TOKEN,
      'ai-api no longer authenticates requests: access is restricted by the loopback bind plus an SSH tunnel, so a leftover API_TOKEN would only be a stale secret to manage',
    ).toBeUndefined()
  })

  it('passes the review model knobs to ai-api', () => {
    const environment = getEnvironment(aiApi)
    for (const name of [
      'REVIEW_SYSTEM_MODE',
      'REVIEW_THINK',
      'REVIEW_DEBUG_RAW',
    ]) {
      expect(
        environment[name],
        `ai-api must receive ${name}: the eval harness sets it on the host, and compose only forwards variables the service declares`,
      ).toBe(`\${${name}:-}`)
    }
  })

  it('passes no REVIEW_THINK_PREFIX to ai-api', () => {
    const environment = getEnvironment(aiApi)
    expect(
      environment.REVIEW_THINK_PREFIX,
      'gemma4:12b measured identical with and without the prefix, so the api no longer reads it: forwarding it would advertise a knob that does nothing',
    ).toBeUndefined()
  })

  it('sets OLLAMA_CONTEXT_LENGTH and OLLAMA_KV_CACHE_TYPE for the 64K + q8_0 VRAM budget', () => {
    const environment = getEnvironment(ollama)
    expect(environment.OLLAMA_CONTEXT_LENGTH).toBe(65536)
    expect(environment.OLLAMA_KV_CACHE_TYPE).toBe('q8_0')
  })

  it('gives ollama the window the review budget is sized against', () => {
    const environment = getEnvironment(ollama)
    expect(
      environment.OLLAMA_CONTEXT_LENGTH,
      'the api packs context against MAX_CONTEXT_TOKENS: a smaller window here truncates the review mid-json, and a larger one leaves the reserve it computed unused',
    ).toBe(MAX_CONTEXT_TOKENS)
  })
})
