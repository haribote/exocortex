# exocortex 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mac から HTTP 経由でローカル LLM にコードレビューと日英翻訳を依頼できる仕組みを作る。

**Architecture:** pnpm workspace のモノレポ。`packages/contract` が型と JSON Schema の唯一の正で、`apps/api`（Hono、WSL2 上の Docker で動く）と `apps/cli`（Mac 上で動く `ai-review` コマンド）が両方これに依存する。api は AI ロジックだけ、cli は git とファイルシステムだけを知る。

**Tech Stack:** Node.js 24 (LTS) / pnpm 11 / TypeScript 7.0 / Hono 4 / Zod 4 / Vitest 4 / Biome 2 / Docker Compose / Ollama

設計の背景と決定の理由は `docs/design.md` にある。着手前に読むこと。

## Global Constraints

- Node.js は 24 系（Active LTS）を使う。
- Zod は v4 系。JSON Schema の生成は `z.toJSONSchema()` を使う。`zod-to-json-schema` は導入しない（2025 年 11 月にメンテナンス終了）。
- TypeScript 7.0 にはコンパイラ API が同梱されていない。TS API に依存するビルドツール（tsup、ts-node など）を導入しない。ビルドは素の `tsc`。
- Biome の設定ファイルは `biome.json`。schema URL は `https://biomejs.dev/schemas/2.5.4/schema.json`。
- 公開オブジェクト型は `interface`、ユニオンとユーティリティ型は `type`。`any` を使わず `unknown` で受けて絞り込む。
- コードコメントは原則書かない。TODO と、コードから意図が読み取れないハックのみ例外とする。
- コミットは Conventional Commits 形式。英語、命令形、小文字始まり、末尾ピリオドなし。絵文字と AI co-author credits を含めない。
- `docker-compose.yml` の `ollama` サービスに `ports:` を書かない。Ollama を LAN に公開しない。
- context の上限は 32768 トークン。うち 4096 を出力用に予約し、入力の上限は 28672 とする。

---

## ファイル構成

```text
exocortex/
├── package.json                    # workspace root, scripts
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.base.json
├── docker-compose.yml
├── .env.example
├── packages/
│   └── contract/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # re-export
│           ├── limits.ts           # トークン上限の定数と見積もり
│           ├── review.ts           # review の型と schema
│           ├── translate.ts        # translate の型と schema
│           └── error.ts            # エラーレスポンスの型
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts            # serve() の起動のみ
│   │       ├── app.ts              # Hono アプリの組み立て
│   │       ├── auth.ts             # Bearer 認証 middleware
│   │       ├── ollama.ts           # Ollama HTTP クライアント
│   │       ├── review/
│   │       │   ├── route.ts
│   │       │   └── prompt.ts       # レビュー用プロンプトの生成
│   │       └── translate/
│   │           ├── route.ts
│   │           └── prompt.ts       # translategemma 用テンプレート
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # エントリポイント、引数解析
│           ├── git.ts              # diff と変更ファイルの取得
│           ├── collect.ts          # 文脈の収集と優先度詰め
│           ├── related.ts          # rg による import / importer / docs の逆引き
│           ├── client.ts           # ai-api への送信と 413 リトライ
│           └── format.ts           # 結果の表示
└── docs/
    ├── design.md
    ├── implementation-plan.md
    └── setup-windows.md
```

`review/` と `translate/` をディレクトリに分けたのは、ルーティングとプロンプトが一緒に変わるからである。層ではなく責務で切る。

---

## Task 1: モノレポの土台と contract パッケージ

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `biome.json`, `tsconfig.base.json`
- Create: `packages/contract/package.json`, `packages/contract/tsconfig.json`
- Create: `packages/contract/src/limits.ts`, `packages/contract/src/review.ts`, `packages/contract/src/translate.ts`, `packages/contract/src/error.ts`, `packages/contract/src/index.ts`
- Test: `packages/contract/src/review.test.ts`, `packages/contract/src/limits.test.ts`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: `ReviewRequest`, `ReviewResponse`, `ReviewComment`, `ReviewResult`, `Severity`, `ContextFile`, `LanguageCode`, `TranslateRequest`, `TranslateResponse`, `ErrorResponse`, `OversizedFile` の型。`reviewRequestSchema`, `reviewResultSchema`, `reviewResponseSchema`, `translateRequestSchema`, `translateResponseSchema`, `errorResponseSchema` の Zod schema。`reviewResultJsonSchema`（Ollama の `format` に渡す JSON Schema）。定数 `MAX_CONTEXT_TOKENS`, `RESERVED_OUTPUT_TOKENS`, `MAX_INPUT_TOKENS`, `PROMPT_OVERHEAD_TOKENS`, `CLI_CONTEXT_BUDGET_TOKENS`。関数 `estimateTokens(text: string): number`

- [ ] **Step 1: workspace の土台を作る**

`package.json`:

```json
{
  "name": "exocortex",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "pnpm -r test",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.4",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.4/schema.json",
  "files": { "includes": ["**/*.ts", "**/*.json"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 2: contract パッケージの雛形を作る**

`packages/contract/package.json`:

```json
{
  "name": "@exocortex/contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^4.4.3" }
}
```

`packages/contract/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: トークン上限のテストを書く**

`packages/contract/src/limits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CLI_CONTEXT_BUDGET_TOKENS,
  MAX_CONTEXT_TOKENS,
  MAX_INPUT_TOKENS,
  PROMPT_OVERHEAD_TOKENS,
  RESERVED_OUTPUT_TOKENS,
  estimateTokens,
} from './limits.js'

describe('limits', () => {
  it('reserves output tokens out of the context window', () => {
    expect(MAX_CONTEXT_TOKENS).toBe(32768)
    expect(RESERVED_OUTPUT_TOKENS).toBe(4096)
    expect(MAX_INPUT_TOKENS).toBe(28672)
  })

  it('leaves the cli a margin below the server budget', () => {
    expect(CLI_CONTEXT_BUDGET_TOKENS).toBe(MAX_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS)
    expect(CLI_CONTEXT_BUDGET_TOKENS).toBeLessThan(MAX_INPUT_TOKENS)
  })
})

describe('estimateTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates roughly three characters per token', () => {
    expect(estimateTokens('abcdef')).toBe(2)
  })

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abcd')).toBe(2)
  })
})
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/contract test`
Expected: FAIL（`./limits.js` を解決できない）

- [ ] **Step 5: limits.ts を実装する**

`packages/contract/src/limits.ts`:

```ts
export const MAX_CONTEXT_TOKENS = 32768
export const RESERVED_OUTPUT_TOKENS = 4096
export const MAX_INPUT_TOKENS = MAX_CONTEXT_TOKENS - RESERVED_OUTPUT_TOKENS

export const PROMPT_OVERHEAD_TOKENS = 512
export const CLI_CONTEXT_BUDGET_TOKENS = MAX_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS

const CHARS_PER_TOKEN = 3

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
```

3 文字を 1 トークンとするのは保守的な見積もりである。英語のコードは 1 トークンあたり 4 文字前後、日本語は 1 文字前後なので、混在を想定して低めに置く。超過した場合は 413 が返って削り直せるため、これ以上の精度は要らない。

`CLI_CONTEXT_BUDGET_TOKENS` を `MAX_INPUT_TOKENS` より小さくしているのは、api 側がプロンプトの定型文と rules を足したうえで上限を判定するためである。CLI が上限ぴったりまで詰めると、ほぼ毎回 413 とリトライが発生して往復が無駄になる。

- [ ] **Step 6: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/contract test`
Expected: PASS

- [ ] **Step 7: review の schema のテストを書く**

`packages/contract/src/review.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { reviewRequestSchema, reviewResultJsonSchema, reviewResultSchema } from './review.js'

describe('reviewRequestSchema', () => {
  it('accepts a minimal request and fills defaults', () => {
    const parsed = reviewRequestSchema.parse({ language: 'typescript', diff: 'diff --git a/a.ts b/a.ts' })
    expect(parsed.rules).toEqual([])
    expect(parsed.context.files).toEqual([])
  })

  it('rejects an empty diff', () => {
    expect(() => reviewRequestSchema.parse({ language: 'typescript', diff: '' })).toThrow()
  })
})

describe('reviewResultSchema', () => {
  it('rejects a severity outside the enum', () => {
    const result = { summary: 's', comments: [{ severity: 'Major', file: 'a.ts', line: 1, message: 'm' }] }
    expect(() => reviewResultSchema.parse(result)).toThrow()
  })

  it('accepts lowercase severities', () => {
    const result = { summary: 's', comments: [{ severity: 'major', file: 'a.ts', line: 1, message: 'm' }] }
    expect(reviewResultSchema.parse(result).comments[0]?.severity).toBe('major')
  })
})

describe('reviewResultJsonSchema', () => {
  it('is a JSON Schema object describing summary and comments', () => {
    expect(reviewResultJsonSchema).toMatchObject({
      type: 'object',
      properties: { summary: { type: 'string' }, comments: { type: 'array' } },
    })
  })
})
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/contract test`
Expected: FAIL（`./review.js` を解決できない）

- [ ] **Step 9: review.ts を実装する**

`packages/contract/src/review.ts`:

```ts
import * as z from 'zod'

export const severitySchema = z.enum(['critical', 'major', 'minor', 'info'])

export const contextFileSchema = z.object({
  path: z.string(),
  content: z.string(),
})

export const reviewRequestSchema = z.object({
  language: z.string(),
  diff: z.string().min(1),
  rules: z.array(z.string()).default([]),
  context: z.object({ files: z.array(contextFileSchema).default([]) }).default({ files: [] }),
})

export const reviewCommentSchema = z.object({
  severity: severitySchema,
  file: z.string(),
  line: z.number().int(),
  message: z.string(),
})

export const reviewResultSchema = z.object({
  summary: z.string(),
  comments: z.array(reviewCommentSchema),
})

export const reviewMetaSchema = z.object({
  model: z.string(),
  inputTokens: z.number().int(),
  durationMs: z.number().int(),
})

export const reviewResponseSchema = z.object({
  summary: z.string(),
  comments: z.array(reviewCommentSchema),
  meta: reviewMetaSchema,
})

export const reviewResultJsonSchema = z.toJSONSchema(reviewResultSchema)

export type Severity = z.infer<typeof severitySchema>
export type ContextFile = z.infer<typeof contextFileSchema>
export type ReviewRequest = z.infer<typeof reviewRequestSchema>
export type ReviewComment = z.infer<typeof reviewCommentSchema>
export type ReviewResult = z.infer<typeof reviewResultSchema>
export type ReviewMeta = z.infer<typeof reviewMetaSchema>
export type ReviewResponse = z.infer<typeof reviewResponseSchema>
```

`reviewResultSchema` と `reviewResponseSchema` を別に定義しているのは、Ollama に渡す JSON Schema に `meta` を含めないためである。`meta` はモデルではなく api が埋める。

- [ ] **Step 10: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/contract test`
Expected: PASS

- [ ] **Step 11: translate と error の schema を実装する**

`packages/contract/src/translate.ts`:

```ts
import * as z from 'zod'

export const languageCodeSchema = z.enum(['ja', 'en'])

export const translateRequestSchema = z.object({
  text: z.string().min(1),
  from: languageCodeSchema,
  to: languageCodeSchema,
})

export const translateResponseSchema = z.object({ text: z.string() })

export type LanguageCode = z.infer<typeof languageCodeSchema>
export type TranslateRequest = z.infer<typeof translateRequestSchema>
export type TranslateResponse = z.infer<typeof translateResponseSchema>
```

`packages/contract/src/error.ts`:

```ts
import * as z from 'zod'

export const oversizedFileSchema = z.object({
  path: z.string(),
  estimatedTokens: z.number().int(),
})

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  oversizedFiles: z.array(oversizedFileSchema).optional(),
})

export type OversizedFile = z.infer<typeof oversizedFileSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
```

`packages/contract/src/index.ts`:

```ts
export * from './limits.js'
export * from './review.js'
export * from './translate.js'
export * from './error.js'
```

- [ ] **Step 12: 全体が通ることを確認してコミットする**

Run: `pnpm install && pnpm lint && pnpm --filter @exocortex/contract test && pnpm --filter @exocortex/contract build`
Expected: すべて PASS

```bash
git add package.json pnpm-workspace.yaml biome.json tsconfig.base.json packages/
git commit -m "feat(contract): add request and response schemas"
```

---

## Task 2: ai-api の骨格と Bearer 認証

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/api/src/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Test: `apps/api/src/auth.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `createApp(deps: AppDeps): Hono` — `AppDeps` は `{ apiToken: string }`。`GET /health` は認証不要で `{ status: 'ok' }` を返す。以降のタスクは `createApp` にルートを足していく。

- [ ] **Step 1: パッケージの雛形を作る**

`apps/api/package.json`:

```json
{
  "name": "@exocortex/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@exocortex/contract": "workspace:*",
    "@hono/node-server": "^2.0.10",
    "hono": "^4.12.31",
    "zod": "^4.4.3"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 2: 認証のテストを書く**

`apps/api/src/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const app = createApp({ apiToken: 'secret' })

describe('GET /health', () => {
  it('does not require authentication', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('bearer auth', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await app.request('/review', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('rejects a request with the wrong token', async () => {
    const res = await app.request('/review', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    })
    expect(res.status).toBe(401)
  })

  it('does not return 401 when the token matches', async () => {
    const res = await app.request('/review', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).not.toBe(401)
  })
})
```

最後のテストが `not.toBe(401)` なのは、この時点で `/review` の中身がまだ無く、400 でも 404 でも構わないからである。認証層だけを検証する。

- [ ] **Step 3: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/api test`
Expected: FAIL（`./app.js` を解決できない）

- [ ] **Step 4: 認証 middleware を実装する**

`apps/api/src/auth.ts`:

```ts
import { createMiddleware } from 'hono/factory'

export function bearerAuth(expectedToken: string) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (header !== `Bearer ${expectedToken}`) {
      return c.json({ error: 'unauthorized', message: 'invalid or missing bearer token' }, 401)
    }
    await next()
  })
}
```

- [ ] **Step 5: アプリを組み立てる**

`apps/api/src/app.ts`:

```ts
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

  app.post('/review', (c) => c.json({ error: 'not_implemented', message: 'not implemented yet' }, 501))

  return app
}
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/api test`
Expected: PASS

- [ ] **Step 7: 起動エントリを実装する**

`apps/api/src/index.ts`:

```ts
import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN is required')
}

const port = Number(process.env.PORT ?? 8080)
const app = createApp({ apiToken })

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
```

`hostname` を `0.0.0.0` にするのは必須である。既定の `127.0.0.1` のままだと、コンテナ外からも LAN からも到達できない。

- [ ] **Step 8: コミットする**

Run: `pnpm lint && pnpm --filter @exocortex/api test && pnpm --filter @exocortex/api build`
Expected: すべて PASS

```bash
git add apps/api
git commit -m "feat(api): add app skeleton with bearer auth"
```

---

## Task 3: Ollama クライアント

**Files:**
- Create: `apps/api/src/ollama.ts`
- Test: `apps/api/src/ollama.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `createOllamaClient(baseUrl: string): OllamaClient`。`OllamaClient` は `chat(request: OllamaChatRequest): Promise<OllamaChatResult>` を持つ。`OllamaChatRequest` は `{ model: string; prompt: string; format?: unknown; temperature?: number }`、`OllamaChatResult` は `{ content: string; totalDurationMs: number }`。到達できない場合は `OllamaUnreachableError`、タイムアウトは `OllamaTimeoutError` を投げる。

- [ ] **Step 1: テストを書く**

`apps/api/src/ollama.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OllamaUnreachableError, createOllamaClient } from './ollama.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('createOllamaClient', () => {
  it('posts a single user message to /api/chat', async () => {
    let captured: unknown
    stubFetch(async (_url, init) => {
      captured = JSON.parse(String((init as RequestInit).body))
      return new Response(JSON.stringify({ message: { content: 'hi' }, total_duration: 2_000_000 }))
    })

    const client = createOllamaClient('http://ollama:11434')
    const result = await client.chat({ model: 'm', prompt: 'hello', temperature: 0 })

    expect(captured).toMatchObject({
      model: 'm',
      stream: false,
      messages: [{ role: 'user', content: 'hello' }],
      options: { temperature: 0 },
    })
    expect(result.content).toBe('hi')
  })

  it('passes the json schema through as format', async () => {
    let captured: { format?: unknown } = {}
    stubFetch(async (_url, init) => {
      captured = JSON.parse(String((init as RequestInit).body))
      return new Response(JSON.stringify({ message: { content: '{}' }, total_duration: 0 }))
    })

    const client = createOllamaClient('http://ollama:11434')
    await client.chat({ model: 'm', prompt: 'p', format: { type: 'object' } })

    expect(captured.format).toEqual({ type: 'object' })
  })

  it('converts total_duration from nanoseconds to milliseconds', async () => {
    stubFetch(async () => new Response(JSON.stringify({ message: { content: 'x' }, total_duration: 1_500_000_000 })))

    const client = createOllamaClient('http://ollama:11434')
    const result = await client.chat({ model: 'm', prompt: 'p' })

    expect(result.totalDurationMs).toBe(1500)
  })

  it('throws OllamaUnreachableError when fetch rejects', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })

    const client = createOllamaClient('http://ollama:11434')
    await expect(client.chat({ model: 'm', prompt: 'p' })).rejects.toBeInstanceOf(OllamaUnreachableError)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/api test ollama`
Expected: FAIL（`./ollama.js` を解決できない）

- [ ] **Step 3: 実装する**

`apps/api/src/ollama.ts`:

```ts
export class OllamaUnreachableError extends Error {}
export class OllamaTimeoutError extends Error {}

export interface OllamaChatRequest {
  model: string
  prompt: string
  format?: unknown
  temperature?: number
}

export interface OllamaChatResult {
  content: string
  totalDurationMs: number
}

export interface OllamaClient {
  chat(request: OllamaChatRequest): Promise<OllamaChatResult>
}

const REQUEST_TIMEOUT_MS = 300_000

export function createOllamaClient(baseUrl: string): OllamaClient {
  return {
    async chat(request) {
      const body: Record<string, unknown> = {
        model: request.model,
        stream: false,
        messages: [{ role: 'user', content: request.prompt }],
      }
      if (request.format !== undefined) {
        body.format = request.format
      }
      if (request.temperature !== undefined) {
        body.options = { temperature: request.temperature }
      }

      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'TimeoutError') {
          throw new OllamaTimeoutError('ollama request timed out', { cause })
        }
        throw new OllamaUnreachableError('failed to reach ollama', { cause })
      }

      if (!response.ok) {
        throw new OllamaUnreachableError(`ollama returned ${response.status}`)
      }

      const parsed = (await response.json()) as { message?: { content?: string }; total_duration?: number }
      return {
        content: parsed.message?.content ?? '',
        totalDurationMs: Math.round((parsed.total_duration ?? 0) / 1_000_000),
      }
    },
  }
}
```

Ollama が返す `total_duration` の単位はナノ秒である。ミリ秒に直してから外に出す。

タイムアウトを 300 秒と長めに取っているのは、`OLLAMA_MAX_LOADED_MODELS=1` によりモデルの切り替えでロード待ちが挟まるためである。

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/api test ollama`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add apps/api/src/ollama.ts apps/api/src/ollama.test.ts
git commit -m "feat(api): add ollama chat client"
```

---

## Task 4: レビュー用プロンプトの生成とトークン超過の検出

**Files:**
- Create: `apps/api/src/review/prompt.ts`
- Test: `apps/api/src/review/prompt.test.ts`

**Interfaces:**
- Consumes: `ReviewRequest`, `MAX_INPUT_TOKENS`, `estimateTokens`, `OversizedFile`（Task 1）
- Produces: `buildReviewPrompt(request: ReviewRequest): string`。`checkInputSize(request: ReviewRequest): SizeCheck`。`SizeCheck` は `{ ok: true; inputTokens: number } | { ok: false; inputTokens: number; oversizedFiles: OversizedFile[] }`

- [ ] **Step 1: テストを書く**

`apps/api/src/review/prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ReviewRequest } from '@exocortex/contract'
import { buildReviewPrompt, checkInputSize } from './prompt.js'

function makeRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  return {
    language: 'typescript',
    diff: 'diff --git a/a.ts b/a.ts',
    rules: [],
    context: { files: [] },
    ...overrides,
  }
}

describe('buildReviewPrompt', () => {
  it('includes the diff', () => {
    const prompt = buildReviewPrompt(makeRequest({ diff: 'MARKER_DIFF' }))
    expect(prompt).toContain('MARKER_DIFF')
  })

  it('includes the language', () => {
    expect(buildReviewPrompt(makeRequest({ language: 'rust' }))).toContain('rust')
  })

  it('includes each rule', () => {
    const prompt = buildReviewPrompt(makeRequest({ rules: ['No Side Effects'] }))
    expect(prompt).toContain('No Side Effects')
  })

  it('includes context files with their paths', () => {
    const prompt = buildReviewPrompt(
      makeRequest({ context: { files: [{ path: 'src/a.ts', content: 'MARKER_CONTENT' }] } }),
    )
    expect(prompt).toContain('src/a.ts')
    expect(prompt).toContain('MARKER_CONTENT')
  })

  it('states the required json shape to ground the model', () => {
    const prompt = buildReviewPrompt(makeRequest())
    expect(prompt).toContain('summary')
    expect(prompt).toContain('comments')
  })
})

describe('checkInputSize', () => {
  it('accepts a small request', () => {
    const check = checkInputSize(makeRequest())
    expect(check.ok).toBe(true)
  })

  it('rejects a request whose context exceeds the input budget', () => {
    const huge = 'x'.repeat(200_000)
    const check = checkInputSize(makeRequest({ context: { files: [{ path: 'big.ts', content: huge }] } }))
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.oversizedFiles[0]?.path).toBe('big.ts')
    }
  })

  it('reports files ordered by estimated size, largest first', () => {
    const check = checkInputSize(
      makeRequest({
        context: {
          files: [
            { path: 'small.ts', content: 'x'.repeat(1000) },
            { path: 'big.ts', content: 'x'.repeat(200_000) },
          ],
        },
      }),
    )
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.oversizedFiles.map((f) => f.path)).toEqual(['big.ts', 'small.ts'])
    }
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/api test prompt`
Expected: FAIL（`./prompt.js` を解決できない）

- [ ] **Step 3: 実装する**

`apps/api/src/review/prompt.ts`:

```ts
import {
  MAX_INPUT_TOKENS,
  type OversizedFile,
  type ReviewRequest,
  estimateTokens,
} from '@exocortex/contract'

export type SizeCheck =
  | { ok: true; inputTokens: number }
  | { ok: false; inputTokens: number; oversizedFiles: OversizedFile[] }

const SYSTEM_INSTRUCTION = `You are a meticulous senior code reviewer.
Review the given diff and report concrete, actionable problems.
Do not praise. Do not restate what the code does. Report only problems worth fixing.
Assign each comment a severity: "critical", "major", "minor", or "info".
Respond with JSON matching this shape:
{"summary": string, "comments": [{"severity": string, "file": string, "line": number, "message": string}]}`

export function buildReviewPrompt(request: ReviewRequest): string {
  const sections: string[] = [SYSTEM_INSTRUCTION, `Language: ${request.language}`]

  if (request.rules.length > 0) {
    sections.push(`Project rules:\n${request.rules.map((r) => `- ${r}`).join('\n')}`)
  }

  for (const file of request.context.files) {
    sections.push(`File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
  }

  sections.push(`Diff to review:\n\`\`\`diff\n${request.diff}\n\`\`\``)

  return sections.join('\n\n')
}

export function checkInputSize(request: ReviewRequest): SizeCheck {
  const inputTokens = estimateTokens(buildReviewPrompt(request))
  if (inputTokens <= MAX_INPUT_TOKENS) {
    return { ok: true, inputTokens }
  }

  const oversizedFiles: OversizedFile[] = request.context.files
    .map((file) => ({ path: file.path, estimatedTokens: estimateTokens(file.content) }))
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)

  return { ok: false, inputTokens, oversizedFiles }
}
```

JSON の形をプロンプト本文にも書いているのは、Ollama の公式ドキュメントが structured outputs の推奨として明記しているためである。`format` による強制と併用する。

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/api test prompt`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add apps/api/src/review
git commit -m "feat(api): add review prompt builder and size check"
```

---

## Task 5: POST /review

**Files:**
- Create: `apps/api/src/review/route.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/review/route.test.ts`

**Interfaces:**
- Consumes: `createOllamaClient`（Task 3）、`buildReviewPrompt`, `checkInputSize`（Task 4）、`reviewRequestSchema`, `reviewResultSchema`, `reviewResultJsonSchema`（Task 1）
- Produces: `registerReviewRoute(app: Hono, deps: ReviewDeps): void`。`ReviewDeps` は `{ ollama: OllamaClient; model: string }`。`AppDeps` に `ollama: OllamaClient` と `reviewModel: string` が加わる。

- [ ] **Step 1: テストを書く**

`apps/api/src/review/route.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { OllamaChatRequest, OllamaChatResult, OllamaClient } from '../ollama.js'
import { OllamaUnreachableError } from '../ollama.js'

function fakeOllama(result: OllamaChatResult, capture?: (r: OllamaChatRequest) => void): OllamaClient {
  return {
    async chat(request) {
      capture?.(request)
      return result
    },
  }
}

function appWith(ollama: OllamaClient) {
  return createApp({ apiToken: 'secret', ollama, reviewModel: 'qwen2.5-coder:14b' })
}

const auth = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' }

const validResult = JSON.stringify({
  summary: 'looks risky',
  comments: [{ severity: 'major', file: 'a.ts', line: 3, message: 'unchecked index access' }],
})

describe('POST /review', () => {
  it('returns the parsed review with meta', async () => {
    const app = appWith(fakeOllama({ content: validResult, totalDurationMs: 1234 }))
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'diff --git a/a.ts b/a.ts' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toBe('looks risky')
    expect(body.comments[0].severity).toBe('major')
    expect(body.meta.model).toBe('qwen2.5-coder:14b')
    expect(body.meta.durationMs).toBe(1234)
  })

  it('passes the json schema to ollama as format', async () => {
    let captured: OllamaChatRequest | undefined
    const app = appWith(fakeOllama({ content: validResult, totalDurationMs: 0 }, (r) => {
      captured = r
    }))
    await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })

    expect(captured?.format).toMatchObject({ type: 'object' })
    expect(captured?.temperature).toBe(0)
  })

  it('returns 400 for an invalid request body', async () => {
    const app = appWith(fakeOllama({ content: validResult, totalDurationMs: 0 }))
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 413 with oversized files when the context is too large', async () => {
    const app = appWith(fakeOllama({ content: validResult, totalDurationMs: 0 }))
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        language: 'typescript',
        diff: 'd',
        context: { files: [{ path: 'big.ts', content: 'x'.repeat(200_000) }] },
      }),
    })

    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toBe('context_too_large')
    expect(body.oversizedFiles[0].path).toBe('big.ts')
  })

  it('returns 503 when ollama is unreachable', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaUnreachableError('down')
      },
    })
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 502 when ollama returns output that violates the schema', async () => {
    const app = appWith(fakeOllama({ content: '{"summary": 1}', totalDurationMs: 0 }))
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })
    expect(res.status).toBe(502)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/api test route`
Expected: FAIL（`createApp` が `ollama` を受け取らない）

- [ ] **Step 3: ルートを実装する**

`apps/api/src/review/route.ts`:

```ts
import { reviewRequestSchema, reviewResultJsonSchema, reviewResultSchema } from '@exocortex/contract'
import type { Hono } from 'hono'
import { OllamaTimeoutError, OllamaUnreachableError, type OllamaClient } from '../ollama.js'
import { buildReviewPrompt, checkInputSize } from './prompt.js'

export interface ReviewDeps {
  ollama: OllamaClient
  model: string
}

export function registerReviewRoute(app: Hono, deps: ReviewDeps): void {
  app.post('/review', async (c) => {
    const parsed = reviewRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', message: parsed.error.message }, 400)
    }

    const request = parsed.data
    const size = checkInputSize(request)
    if (!size.ok) {
      return c.json(
        {
          error: 'context_too_large',
          message: `estimated ${size.inputTokens} input tokens exceeds the budget`,
          oversizedFiles: size.oversizedFiles,
        },
        413,
      )
    }

    let result: Awaited<ReturnType<OllamaClient['chat']>>
    try {
      result = await deps.ollama.chat({
        model: deps.model,
        prompt: buildReviewPrompt(request),
        format: reviewResultJsonSchema,
        temperature: 0,
      })
    } catch (cause) {
      if (cause instanceof OllamaTimeoutError) {
        return c.json({ error: 'inference_timeout', message: 'ollama did not respond in time' }, 504)
      }
      if (cause instanceof OllamaUnreachableError) {
        return c.json({ error: 'ollama_unreachable', message: 'could not reach ollama' }, 503)
      }
      throw cause
    }

    const review = reviewResultSchema.safeParse(JSON.parse(result.content))
    if (!review.success) {
      return c.json({ error: 'invalid_model_output', message: review.error.message }, 502)
    }

    return c.json({
      summary: review.data.summary,
      comments: review.data.comments,
      meta: { model: deps.model, inputTokens: size.inputTokens, durationMs: result.totalDurationMs },
    })
  })
}
```

`JSON.parse` は `format` による強制があるので通常は成功するが、失敗した場合は例外が Hono の既定ハンドラに落ちて 500 になる。502 で返したい場合は次のステップで扱う。

- [ ] **Step 4: JSON.parse の失敗も 502 にする**

`apps/api/src/review/route.ts` の該当部分を差し替える。

```ts
    let raw: unknown
    try {
      raw = JSON.parse(result.content)
    } catch {
      return c.json({ error: 'invalid_model_output', message: 'model did not return valid json' }, 502)
    }

    const review = reviewResultSchema.safeParse(raw)
```

- [ ] **Step 5: app.ts にルートを繋ぐ**

`apps/api/src/app.ts`:

```ts
import { Hono } from 'hono'
import { bearerAuth } from './auth.js'
import type { OllamaClient } from './ollama.js'
import { registerReviewRoute } from './review/route.js'

export interface AppDeps {
  apiToken: string
  ollama: OllamaClient
  reviewModel: string
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.use('/review', bearerAuth(deps.apiToken))
  app.use('/translate', bearerAuth(deps.apiToken))

  registerReviewRoute(app, { ollama: deps.ollama, model: deps.reviewModel })

  return app
}
```

`apps/api/src/auth.test.ts` の `createApp({ apiToken: 'secret' })` が型エラーになる。次のように直す。

```ts
import { createApp } from './app.js'
import type { OllamaClient } from './ollama.js'

const noopOllama: OllamaClient = {
  async chat() {
    return { content: '{"summary":"","comments":[]}', totalDurationMs: 0 }
  },
}

const app = createApp({ apiToken: 'secret', ollama: noopOllama, reviewModel: 'test-model' })
```

- [ ] **Step 6: index.ts を更新する**

`apps/api/src/index.ts`:

```ts
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createOllamaClient } from './ollama.js'

const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN is required')
}

const ollamaUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434'
const reviewModel = process.env.REVIEW_MODEL ?? 'qwen2.5-coder:14b'
const port = Number(process.env.PORT ?? 8080)

const app = createApp({ apiToken, ollama: createOllamaClient(ollamaUrl), reviewModel })

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
```

- [ ] **Step 7: テストが通ることを確認してコミットする**

Run: `pnpm lint && pnpm --filter @exocortex/api test && pnpm --filter @exocortex/api build`
Expected: すべて PASS

```bash
git add apps/api
git commit -m "feat(api): add review endpoint"
```

---

## Task 6: POST /translate

**Files:**
- Create: `apps/api/src/translate/prompt.ts`, `apps/api/src/translate/route.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Test: `apps/api/src/translate/prompt.test.ts`, `apps/api/src/translate/route.test.ts`

**Interfaces:**
- Consumes: `translateRequestSchema`, `LanguageCode`（Task 1）、`OllamaClient`（Task 3）
- Produces: `buildTranslatePrompt(request: TranslateRequest): string`、`registerTranslateRoute(app: Hono, deps: TranslateDeps): void`。`TranslateDeps` は `{ ollama: OllamaClient; model: string }`。`AppDeps` に `translateModel: string` が加わる。

- [ ] **Step 1: プロンプトのテストを書く**

translategemma は公式指定の書式から外れると品質が落ちる。書式そのものをテストで固定する。

`apps/api/src/translate/prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildTranslatePrompt } from './prompt.js'

describe('buildTranslatePrompt', () => {
  it('names both the language and its code for source and target', () => {
    const prompt = buildTranslatePrompt({ text: 'こんにちは', from: 'ja', to: 'en' })
    expect(prompt).toContain('Japanese (ja)')
    expect(prompt).toContain('English (en)')
  })

  it('puts exactly two blank lines before the text', () => {
    const prompt = buildTranslatePrompt({ text: 'MARKER', from: 'ja', to: 'en' })
    expect(prompt.endsWith('into English:\n\n\nMARKER')).toBe(true)
  })

  it('preserves newlines inside the text', () => {
    const prompt = buildTranslatePrompt({ text: 'a\nb', from: 'ja', to: 'en' })
    expect(prompt.endsWith('a\nb')).toBe(true)
  })
})
```

`\n\n\n` が空行 2 つにあたる。1 つ目の `\n` が見出し行の終端、残る 2 つが空行になる。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/api test translate`
Expected: FAIL（`./prompt.js` を解決できない）

- [ ] **Step 3: プロンプトを実装する**

`apps/api/src/translate/prompt.ts`:

```ts
import type { LanguageCode, TranslateRequest } from '@exocortex/contract'

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  ja: 'Japanese',
  en: 'English',
}

export function buildTranslatePrompt(request: TranslateRequest): string {
  const source = LANGUAGE_NAMES[request.from]
  const target = LANGUAGE_NAMES[request.to]

  return (
    `You are a professional ${source} (${request.from}) to ${target} (${request.to}) translator. ` +
    `Your goal is to accurately convey the meaning and nuances of the original ${source} text ` +
    `while adhering to ${target} grammar, vocabulary, and cultural sensitivities.\n` +
    `Produce only the ${target} translation, without any additional explanations or commentary. ` +
    `Please translate the following ${source} text into ${target}:\n\n\n${request.text}`
  )
}
```

この書式は translategemma の公式モデルページが指定するものである。system prompt は使えない。Ollama の TEMPLATE が system role を user role と同じブロックに畳むためで、指示は user メッセージ 1 通に収める必要がある。

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/api test translate`
Expected: PASS

- [ ] **Step 5: ルートのテストを書く**

`apps/api/src/translate/route.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { OllamaChatRequest, OllamaClient } from '../ollama.js'

function appWith(ollama: OllamaClient) {
  return createApp({
    apiToken: 'secret',
    ollama,
    reviewModel: 'review-model',
    translateModel: 'translategemma:12b',
  })
}

const auth = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' }

describe('POST /translate', () => {
  it('returns the translated text', async () => {
    const app = appWith({
      async chat() {
        return { content: 'Hello', totalDurationMs: 10 }
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Hello' })
  })

  it('uses the translate model and no structured output', async () => {
    let captured: OllamaChatRequest | undefined
    const app = appWith({
      async chat(request) {
        captured = request
        return { content: 'Hello', totalDurationMs: 0 }
      },
    })
    await app.request('/translate', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })

    expect(captured?.model).toBe('translategemma:12b')
    expect(captured?.format).toBeUndefined()
  })

  it('trims surrounding whitespace from the model output', async () => {
    const app = appWith({
      async chat() {
        return { content: '  Hello\n', totalDurationMs: 0 }
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })
    expect(await res.json()).toEqual({ text: 'Hello' })
  })

  it('returns 400 for an unsupported language code', async () => {
    const app = appWith({
      async chat() {
        return { content: '', totalDurationMs: 0 }
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ text: 'x', from: 'fr', to: 'en' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 6: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/api test translate`
Expected: FAIL（`/translate` が 404 を返す）

- [ ] **Step 7: ルートを実装して app.ts に繋ぐ**

`apps/api/src/translate/route.ts`:

```ts
import { translateRequestSchema } from '@exocortex/contract'
import type { Hono } from 'hono'
import { OllamaTimeoutError, OllamaUnreachableError, type OllamaClient } from '../ollama.js'
import { buildTranslatePrompt } from './prompt.js'

export interface TranslateDeps {
  ollama: OllamaClient
  model: string
}

export function registerTranslateRoute(app: Hono, deps: TranslateDeps): void {
  app.post('/translate', async (c) => {
    const parsed = translateRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', message: parsed.error.message }, 400)
    }

    try {
      const result = await deps.ollama.chat({
        model: deps.model,
        prompt: buildTranslatePrompt(parsed.data),
      })
      return c.json({ text: result.content.trim() })
    } catch (cause) {
      if (cause instanceof OllamaTimeoutError) {
        return c.json({ error: 'inference_timeout', message: 'ollama did not respond in time' }, 504)
      }
      if (cause instanceof OllamaUnreachableError) {
        return c.json({ error: 'ollama_unreachable', message: 'could not reach ollama' }, 503)
      }
      throw cause
    }
  })
}
```

`apps/api/src/app.ts` の全体を次の内容にする。

```ts
import { Hono } from 'hono'
import { bearerAuth } from './auth.js'
import type { OllamaClient } from './ollama.js'
import { registerReviewRoute } from './review/route.js'
import { registerTranslateRoute } from './translate/route.js'

export interface AppDeps {
  apiToken: string
  ollama: OllamaClient
  reviewModel: string
  translateModel: string
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.use('/review', bearerAuth(deps.apiToken))
  app.use('/translate', bearerAuth(deps.apiToken))

  registerReviewRoute(app, { ollama: deps.ollama, model: deps.reviewModel })
  registerTranslateRoute(app, { ollama: deps.ollama, model: deps.translateModel })

  return app
}
```

`apps/api/src/index.ts` の全体を次の内容にする。

```ts
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createOllamaClient } from './ollama.js'

const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN is required')
}

const ollamaUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434'
const reviewModel = process.env.REVIEW_MODEL ?? 'qwen2.5-coder:14b'
const translateModel = process.env.TRANSLATE_MODEL ?? 'translategemma:12b'
const port = Number(process.env.PORT ?? 8080)

const app = createApp({
  apiToken,
  ollama: createOllamaClient(ollamaUrl),
  reviewModel,
  translateModel,
})

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
```

既存のテスト（`auth.test.ts`、`review/route.test.ts`）で `createApp` を呼んでいる箇所に `translateModel: 'test-translate-model'` を足す。

- [ ] **Step 8: テストが通ることを確認してコミットする**

Run: `pnpm lint && pnpm --filter @exocortex/api test && pnpm --filter @exocortex/api build`
Expected: すべて PASS

```bash
git add apps/api
git commit -m "feat(api): add translate endpoint"
```

---

## Task 7: Docker 構成

**Files:**
- Create: `apps/api/Dockerfile`, `apps/api/.dockerignore`
- Create: `docker-compose.yml`, `.env.example`

**Interfaces:**
- Consumes: `apps/api` のビルド成果物
- Produces: `docker compose up -d` で `ai-api` が 8080 で応答する構成

- [ ] **Step 1: Dockerfile を書く**

`apps/api/Dockerfile`:

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/contract ./packages/contract
COPY apps/api ./apps/api
RUN pnpm --filter @exocortex/contract build && pnpm --filter @exocortex/api build
RUN pnpm deploy --filter @exocortex/api --prod /deploy

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /deploy .
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

ビルドコンテキストはリポジトリルートになる。`docker-compose.yml` の `context` でそう指定する。

`apps/api/.dockerignore`:

```text
node_modules
dist
```

- [ ] **Step 2: docker-compose.yml を書く**

```yaml
services:
  ollama:
    image: ollama/ollama
    restart: unless-stopped
    volumes:
      - ollama:/root/.ollama
    environment:
      OLLAMA_CONTEXT_LENGTH: 32768
      OLLAMA_MAX_LOADED_MODELS: 1
      OLLAMA_FLASH_ATTENTION: 1
      OLLAMA_KV_CACHE_TYPE: q8_0
      OLLAMA_KEEP_ALIVE: 30m
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  ai-api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      OLLAMA_URL: http://ollama:11434
      API_TOKEN: ${API_TOKEN}
      REVIEW_MODEL: ${REVIEW_MODEL:-qwen2.5-coder:14b}
      TRANSLATE_MODEL: ${TRANSLATE_MODEL:-translategemma:12b}
    depends_on:
      - ollama

volumes:
  ollama:
```

`ollama` に `ports:` が無いことを確認する。あると Ollama の API が LAN に露出する。

- [ ] **Step 3: .env.example を書く**

```text
# openssl rand -hex 32 で生成する
API_TOKEN=

REVIEW_MODEL=qwen2.5-coder:14b
TRANSLATE_MODEL=translategemma:12b
```

- [ ] **Step 4: 構成を検証する**

Run: `docker compose config`
Expected: エラーなく展開される。`ollama` に `ports` が現れないことを目視で確認する。

この時点では Windows 側の環境が整っていないため、実際の起動は Task 10 の後に行う。

- [ ] **Step 5: コミットする**

```bash
git add apps/api/Dockerfile apps/api/.dockerignore docker-compose.yml .env.example
git commit -m "chore: add docker compose setup"
```

---

## Task 8: CLI の骨格と git diff の取得

**Files:**
- Create: `apps/cli/package.json`, `apps/cli/tsconfig.json`
- Create: `apps/cli/src/git.ts`
- Test: `apps/cli/src/git.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `collectDiff(options: DiffOptions): DiffResult`。`DiffOptions` は `{ cwd: string; base?: string; staged?: boolean }`、`DiffResult` は `{ diff: string; changedFiles: string[] }`。`repoRoot(cwd: string): string`

- [ ] **Step 1: パッケージの雛形を作る**

`apps/cli/package.json`:

```json
{
  "name": "@exocortex/cli",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "ai-review": "./dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@exocortex/contract": "workspace:*"
  }
}
```

`apps/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 2: テストを書く**

一時 git リポジトリを作って検証する。開発者の作業ツリーに依存させない。

`apps/cli/src/git.test.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { collectDiff, repoRoot } from './git.js'

let cwd: string

function git(...args: string[]): void {
  execFileSync('git', args, { cwd })
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'exocortex-git-'))
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  writeFileSync(join(cwd, 'a.ts'), 'export const a = 1\n')
  git('add', '.')
  git('commit', '-qm', 'initial')
})

describe('repoRoot', () => {
  it('returns the repository root', () => {
    expect(repoRoot(cwd)).toBe(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim())
  })
})

describe('collectDiff', () => {
  it('returns an empty diff when nothing changed', () => {
    const result = collectDiff({ cwd })
    expect(result.diff).toBe('')
    expect(result.changedFiles).toEqual([])
  })

  it('reports uncommitted changes', () => {
    writeFileSync(join(cwd, 'a.ts'), 'export const a = 2\n')
    const result = collectDiff({ cwd })
    expect(result.diff).toContain('export const a = 2')
    expect(result.changedFiles).toEqual(['a.ts'])
  })

  it('reports only staged changes when staged is set', () => {
    writeFileSync(join(cwd, 'a.ts'), 'export const a = 2\n')
    writeFileSync(join(cwd, 'b.ts'), 'export const b = 1\n')
    git('add', 'a.ts')
    const result = collectDiff({ cwd, staged: true })
    expect(result.changedFiles).toEqual(['a.ts'])
  })

  it('diffs against a base ref when given', () => {
    git('checkout', '-qb', 'feature')
    writeFileSync(join(cwd, 'c.ts'), 'export const c = 1\n')
    git('add', '.')
    git('commit', '-qm', 'add c')
    const result = collectDiff({ cwd, base: 'main' })
    expect(result.changedFiles).toEqual(['c.ts'])
  })
})
```

`git init` の既定ブランチ名が環境により `main` か `master` かで変わる。テストが落ちる場合は `git('init', '-q', '-b', 'main')` に変える。

- [ ] **Step 3: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/cli test`
Expected: FAIL（`./git.js` を解決できない）

- [ ] **Step 4: 実装する**

`apps/cli/src/git.ts`:

```ts
import { execFileSync } from 'node:child_process'

export interface DiffOptions {
  cwd: string
  base?: string
  staged?: boolean
}

export interface DiffResult {
  diff: string
  changedFiles: string[]
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

export function repoRoot(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim()
}

function diffArgs(options: DiffOptions): string[] {
  if (options.base) {
    return [`${options.base}...HEAD`]
  }
  if (options.staged) {
    return ['--cached']
  }
  return ['HEAD']
}

export function collectDiff(options: DiffOptions): DiffResult {
  const args = diffArgs(options)
  const diff = git(options.cwd, ['diff', ...args])
  const names = git(options.cwd, ['diff', '--name-only', ...args])

  return {
    diff,
    changedFiles: names.split('\n').filter((line) => line.length > 0),
  }
}
```

`base` を指定した場合に `...` を使うのは、分岐点からの差分を見るためである。`..` にすると base 側の進行分まで差分に含まれ、自分が書いていない変更をレビューさせることになる。

- [ ] **Step 5: テストが通ることを確認してコミットする**

Run: `pnpm --filter @exocortex/cli test`
Expected: PASS

```bash
git add apps/cli
git commit -m "feat(cli): add git diff collection"
```

---

## Task 9: 文脈の収集と優先度詰め

**Files:**
- Create: `apps/cli/src/related.ts`, `apps/cli/src/collect.ts`
- Test: `apps/cli/src/related.test.ts`, `apps/cli/src/collect.test.ts`

**Interfaces:**
- Consumes: `DiffResult`（Task 8）、`ContextFile`, `MAX_INPUT_TOKENS`, `estimateTokens`（Task 1）
- Produces: `findImports(root: string, file: string): string[]`、`findImporters(root: string, file: string): string[]`、`findRelatedDocs(root: string, files: string[]): string[]`、`collectContext(options: CollectOptions): ContextFile[]`。`CollectOptions` は `{ root: string; changedFiles: string[]; diff: string; budgetTokens: number }`

- [ ] **Step 1: 逆引きのテストを書く**

`apps/cli/src/related.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { findImporters, findImports, findRelatedDocs } from './related.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'exocortex-rel-'))
})

describe('findImports', () => {
  it('finds relative imports', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', 'export const b = 1\n')
    expect(findImports(root, 'src/a.ts')).toEqual(['src/b.ts'])
  })

  it('ignores package imports', () => {
    write('src/a.ts', "import { z } from 'zod'\n")
    expect(findImports(root, 'src/a.ts')).toEqual([])
  })
})

describe('findImporters', () => {
  it('finds files that import the given file', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', 'export const b = 1\n')
    expect(findImporters(root, 'src/b.ts')).toEqual(['src/a.ts'])
  })

  it('does not report the file itself', () => {
    write('src/b.ts', "// mentions b.js in a comment\n")
    expect(findImporters(root, 'src/b.ts')).toEqual([])
  })
})

describe('findRelatedDocs', () => {
  it('finds markdown mentioning the changed file basename', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('docs/design.md', 'payment.ts handles settlement\n')
    expect(findRelatedDocs(root, ['src/payment.ts'])).toEqual(['docs/design.md'])
  })

  it('returns an empty list when nothing mentions the file', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('docs/design.md', 'unrelated content\n')
    expect(findRelatedDocs(root, ['src/payment.ts'])).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/cli test related`
Expected: FAIL（`./related.js` を解決できない）

- [ ] **Step 3: 逆引きを実装する**

`apps/cli/src/related.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

const IMPORT_PATTERN = /(?:from|require\()\s*['"]([^'"]+)['"]/g
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

function rg(root: string, args: string[]): string[] {
  try {
    const out = execFileSync('rg', args, { cwd: root, encoding: 'utf8' })
    return out.split('\n').filter((line) => line.length > 0)
  } catch {
    return []
  }
}

function resolveSpecifier(root: string, fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined
  }

  const base = resolve(root, dirname(fromFile), specifier)
  const withoutExt = base.replace(/\.(js|jsx|ts|tsx)$/, '')

  for (const ext of SOURCE_EXTENSIONS) {
    for (const candidate of [`${withoutExt}${ext}`, join(withoutExt, `index${ext}`)]) {
      if (existsSync(candidate)) {
        return relative(root, candidate)
      }
    }
  }
  return undefined
}

export function findImports(root: string, file: string): string[] {
  const source = readFileSync(join(root, file), 'utf8')
  const found = new Set<string>()

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1]
    if (!specifier) continue
    const resolved = resolveSpecifier(root, file, specifier)
    if (resolved) {
      found.add(resolved)
    }
  }

  return [...found].sort()
}

export function findImporters(root: string, file: string): string[] {
  const stem = basename(file).replace(/\.(ts|tsx|js|jsx)$/, '')
  const lines = rg(root, ['-l', `(from|require\\()\\s*['"][^'"]*${stem}(\\.js|\\.ts)?['"]`, '-g', '*.ts', '-g', '*.tsx', '-g', '*.js', '-g', '*.jsx'])

  return lines.filter((candidate) => candidate !== file).sort()
}

export function findRelatedDocs(root: string, files: string[]): string[] {
  const stems = files.map((file) => basename(file))
  if (stems.length === 0) {
    return []
  }

  const args = ['-l', '-g', '*.md']
  for (const stem of stems) {
    args.push('-e', stem)
  }

  return rg(root, args).sort()
}
```

`rg` が見つからない場合や一致が無い場合、`rg` は非ゼロで終了する。例外を握りつぶして空配列を返す。関連ファイルが取れないことはレビューの失敗ではなく、質の低下にとどまるためである。

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/cli test related`
Expected: PASS

- [ ] **Step 5: 優先度詰めのテストを書く**

`apps/cli/src/collect.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { collectContext } from './collect.js'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'exocortex-collect-'))
})

describe('collectContext', () => {
  it('includes changed files first', () => {
    write('src/a.ts', 'export const a = 1\n')
    const files = collectContext({ root, changedFiles: ['src/a.ts'], diff: 'd', budgetTokens: 10_000 })
    expect(files[0]?.path).toBe('src/a.ts')
  })

  it('includes project rules after changed files', () => {
    write('src/a.ts', 'export const a = 1\n')
    write('CLAUDE.md', 'always use const\n')
    const paths = collectContext({ root, changedFiles: ['src/a.ts'], diff: 'd', budgetTokens: 10_000 }).map((f) => f.path)
    expect(paths).toEqual(['src/a.ts', 'CLAUDE.md'])
  })

  it('places related docs before importers', () => {
    write('src/payment.ts', 'export const pay = 1\n')
    write('src/caller.ts', "import { pay } from './payment.js'\n")
    write('docs/design.md', 'payment.ts handles settlement\n')
    const paths = collectContext({ root, changedFiles: ['src/payment.ts'], diff: 'd', budgetTokens: 10_000 }).map((f) => f.path)
    expect(paths.indexOf('docs/design.md')).toBeLessThan(paths.indexOf('src/caller.ts'))
  })

  it('stops adding files once the budget is exhausted', () => {
    write('src/a.ts', 'x'.repeat(30_000))
    write('CLAUDE.md', 'y'.repeat(30_000))
    const files = collectContext({ root, changedFiles: ['src/a.ts'], diff: 'd', budgetTokens: 11_000 })
    expect(files.map((f) => f.path)).toEqual(['src/a.ts'])
  })

  it('never includes the same file twice', () => {
    write('src/a.ts', "import { b } from './b.js'\n")
    write('src/b.ts', "import { a } from './a.js'\n")
    const paths = collectContext({
      root,
      changedFiles: ['src/a.ts', 'src/b.ts'],
      diff: 'd',
      budgetTokens: 10_000,
    }).map((f) => f.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
```

- [ ] **Step 6: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/cli test collect`
Expected: FAIL（`./collect.js` を解決できない）

- [ ] **Step 7: 優先度詰めを実装する**

`apps/cli/src/collect.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ContextFile, estimateTokens } from '@exocortex/contract'
import { findImporters, findImports, findRelatedDocs } from './related.js'

export interface CollectOptions {
  root: string
  changedFiles: string[]
  diff: string
  budgetTokens: number
}

const RULE_FILES = ['CLAUDE.md', 'AGENTS.md', 'biome.json', '.eslintrc.json']

export function collectContext(options: CollectOptions): ContextFile[] {
  const { root, changedFiles } = options

  const rules = RULE_FILES.filter((name) => existsSync(join(root, name)))
  const docs = findRelatedDocs(root, changedFiles)
  const importers = changedFiles.flatMap((file) => findImporters(root, file))
  const imports = changedFiles.flatMap((file) => findImports(root, file))

  const ordered = [...changedFiles, ...rules, ...docs, ...importers, ...imports]

  const seen = new Set<string>()
  const collected: ContextFile[] = []
  let used = estimateTokens(options.diff)

  for (const path of ordered) {
    if (seen.has(path)) continue
    seen.add(path)

    const full = join(root, path)
    if (!existsSync(full)) continue

    const content = readFileSync(full, 'utf8')
    const cost = estimateTokens(content)
    if (used + cost > options.budgetTokens) continue

    collected.push({ path, content })
    used += cost
  }

  return collected
}
```

予算を超えたファイルは `continue` で飛ばし、`break` しない。大きいファイル 1 つで打ち切られるより、後続の小さいファイルが入るほうが文脈として有用なためである。

- [ ] **Step 8: テストが通ることを確認してコミットする**

Run: `pnpm lint && pnpm --filter @exocortex/cli test`
Expected: すべて PASS

```bash
git add apps/cli/src/related.ts apps/cli/src/related.test.ts apps/cli/src/collect.ts apps/cli/src/collect.test.ts
git commit -m "feat(cli): add context collection with priority packing"
```

---

## Task 10: API クライアント、413 リトライ、出力整形、エントリポイント

**Files:**
- Create: `apps/cli/src/client.ts`, `apps/cli/src/format.ts`, `apps/cli/src/index.ts`
- Test: `apps/cli/src/client.test.ts`, `apps/cli/src/format.test.ts`

**Interfaces:**
- Consumes: `collectDiff`, `repoRoot`（Task 8）、`collectContext`（Task 9）、`ReviewRequest`, `ReviewResponse`, `ErrorResponse`, `CLI_CONTEXT_BUDGET_TOKENS`（Task 1）
- Produces: `requestReview(options: ClientOptions): Promise<ReviewResponse>`。`ClientOptions` は `{ endpoint: string; token: string; request: ReviewRequest }`。`formatReview(response: ReviewResponse): string`

- [ ] **Step 1: クライアントのテストを書く**

`apps/cli/src/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewRequest } from '@exocortex/contract'
import { requestReview } from './client.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const baseRequest: ReviewRequest = {
  language: 'typescript',
  diff: 'd',
  rules: [],
  context: { files: [{ path: 'big.ts', content: 'x' }, { path: 'small.ts', content: 'y' }] },
}

const okBody = { summary: 's', comments: [], meta: { model: 'm', inputTokens: 1, durationMs: 1 } }

describe('requestReview', () => {
  it('sends the bearer token', async () => {
    let headers: Headers | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => {
      headers = new Headers(init.headers)
      return new Response(JSON.stringify(okBody))
    }))

    await requestReview({ endpoint: 'http://host:8080', token: 'secret', request: baseRequest })
    expect(headers?.get('Authorization')).toBe('Bearer secret')
  })

  it('drops the largest oversized file and retries on 413', async () => {
    const sentFiles: string[][] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as ReviewRequest
      sentFiles.push(body.context.files.map((f) => f.path))

      if (sentFiles.length === 1) {
        return new Response(
          JSON.stringify({
            error: 'context_too_large',
            message: 'too big',
            oversizedFiles: [{ path: 'big.ts', estimatedTokens: 99 }],
          }),
          { status: 413 },
        )
      }
      return new Response(JSON.stringify(okBody))
    }))

    const result = await requestReview({ endpoint: 'http://host:8080', token: 't', request: baseRequest })

    expect(sentFiles[0]).toEqual(['big.ts', 'small.ts'])
    expect(sentFiles[1]).toEqual(['small.ts'])
    expect(result.summary).toBe('s')
  })

  it('gives up after repeated 413 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(
        JSON.stringify({ error: 'context_too_large', message: 'too big', oversizedFiles: [] }),
        { status: 413 },
      ),
    ))

    await expect(
      requestReview({ endpoint: 'http://host:8080', token: 't', request: baseRequest }),
    ).rejects.toThrow(/context/)
  })

  it('throws a helpful error on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'unauthorized', message: 'bad token' }), { status: 401 }),
    ))

    await expect(
      requestReview({ endpoint: 'http://host:8080', token: 'wrong', request: baseRequest }),
    ).rejects.toThrow(/token/i)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/cli test client`
Expected: FAIL（`./client.js` を解決できない）

- [ ] **Step 3: クライアントを実装する**

`apps/cli/src/client.ts`:

```ts
import type { ErrorResponse, ReviewRequest, ReviewResponse } from '@exocortex/contract'

export interface ClientOptions {
  endpoint: string
  token: string
  request: ReviewRequest
}

const MAX_RETRIES = 5

export async function requestReview(options: ClientOptions): Promise<ReviewResponse> {
  let request = options.request

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${options.endpoint}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (response.ok) {
      return (await response.json()) as ReviewResponse
    }

    const error = (await response.json().catch(() => null)) as ErrorResponse | null

    if (response.status === 401) {
      throw new Error('authentication failed: check the API token')
    }
    if (response.status === 503) {
      throw new Error('could not reach ollama: is the Windows machine running?')
    }
    if (response.status === 504) {
      throw new Error('inference timed out: retry, or reduce the amount of context')
    }
    if (response.status !== 413) {
      throw new Error(`review failed (${response.status}): ${error?.message ?? 'unknown error'}`)
    }

    const largest = error?.oversizedFiles?.[0]?.path
    const remaining = largest
      ? request.context.files.filter((file) => file.path !== largest)
      : request.context.files.slice(0, -1)

    if (remaining.length === request.context.files.length) {
      throw new Error('context is too large even after dropping every optional file')
    }

    request = { ...request, context: { files: remaining } }
  }

  throw new Error('context is too large: gave up after repeated retries')
}
```

413 のたびに最大のファイルを 1 つ落として再送する。落とすものが無くなったら諦める。

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @exocortex/cli test client`
Expected: PASS

- [ ] **Step 5: 出力整形のテストを書く**

`apps/cli/src/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ReviewResponse } from '@exocortex/contract'
import { formatReview } from './format.js'

const response: ReviewResponse = {
  summary: 'two issues found',
  comments: [
    { severity: 'minor', file: 'b.ts', line: 8, message: 'prefer const' },
    { severity: 'critical', file: 'a.ts', line: 3, message: 'null deref' },
  ],
  meta: { model: 'qwen2.5-coder:14b', inputTokens: 100, durationMs: 2000 },
}

describe('formatReview', () => {
  it('includes the summary', () => {
    expect(formatReview(response)).toContain('two issues found')
  })

  it('orders comments by severity, most severe first', () => {
    const output = formatReview(response)
    expect(output.indexOf('null deref')).toBeLessThan(output.indexOf('prefer const'))
  })

  it('renders each comment as file:line', () => {
    expect(formatReview(response)).toContain('a.ts:3')
  })

  it('reports the model and duration', () => {
    const output = formatReview(response)
    expect(output).toContain('qwen2.5-coder:14b')
    expect(output).toContain('2000')
  })

  it('states when there are no comments', () => {
    const empty: ReviewResponse = { ...response, comments: [] }
    expect(formatReview(empty)).toContain('No issues')
  })
})
```

- [ ] **Step 6: テストが失敗することを確認する**

Run: `pnpm --filter @exocortex/cli test format`
Expected: FAIL（`./format.js` を解決できない）

- [ ] **Step 7: 出力整形を実装する**

`apps/cli/src/format.ts`:

```ts
import type { ReviewResponse, Severity } from '@exocortex/contract'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3,
}

export function formatReview(response: ReviewResponse): string {
  const lines: string[] = [response.summary, '']

  if (response.comments.length === 0) {
    lines.push('No issues found.')
  } else {
    const sorted = [...response.comments].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    )
    for (const comment of sorted) {
      lines.push(`[${comment.severity}] ${comment.file}:${comment.line}`)
      lines.push(`  ${comment.message}`)
      lines.push('')
    }
  }

  lines.push(`-- ${response.meta.model}, ${response.meta.inputTokens} input tokens, ${response.meta.durationMs}ms`)

  return lines.join('\n')
}
```

- [ ] **Step 8: エントリポイントを実装する**

`apps/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { CLI_CONTEXT_BUDGET_TOKENS } from '@exocortex/contract'
import { requestReview } from './client.js'
import { collectContext } from './collect.js'
import { formatReview } from './format.js'
import { collectDiff, repoRoot } from './git.js'

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    staged: { type: 'boolean' },
    json: { type: 'boolean' },
    language: { type: 'string', default: 'typescript' },
  },
})

const endpoint = process.env.EXOCORTEX_ENDPOINT
const token = process.env.EXOCORTEX_TOKEN

if (!endpoint || !token) {
  console.error('EXOCORTEX_ENDPOINT and EXOCORTEX_TOKEN must be set')
  process.exit(1)
}

const root = repoRoot(process.cwd())
const { diff, changedFiles } = collectDiff({ cwd: root, base: values.base, staged: values.staged })

if (diff.length === 0) {
  console.error('no changes to review')
  process.exit(1)
}

const files = collectContext({ root, changedFiles, diff, budgetTokens: CLI_CONTEXT_BUDGET_TOKENS })

try {
  const response = await requestReview({
    endpoint,
    token,
    request: {
      language: values.language,
      diff,
      rules: [],
      context: { files },
    },
  })

  console.log(values.json ? JSON.stringify(response, null, 2) : formatReview(response))
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
}
```

- [ ] **Step 9: テストが通ることを確認してコミットする**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: すべて PASS

```bash
git add apps/cli
git commit -m "feat(cli): add api client, output formatting and entrypoint"
```

---

## Task 11: Windows セットアップの runbook と実機での確認

**Files:**
- Create: `docs/setup-windows.md`

**Interfaces:**
- Consumes: `docker-compose.yml`（Task 7）
- Produces: 実機で `curl` が通る状態

- [ ] **Step 1: runbook を書く**

`docs/setup-windows.md` に次を順に記す。各手順に確認コマンドを添える。

1. **WSL2 の networking を mirrored にする。** `C:\Users\<user>\.wslconfig` に `[wsl2]` セクションを作り `networkingMode=mirrored` を書く。`wsl --shutdown` で反映する。Windows 11 22H2 以降が必要。
2. **Hyper-V ファイアウォールで受信を許可する。** 管理者権限の PowerShell で実行する。

```powershell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```

3. **WSL2 の Ubuntu に Docker Engine を入れる。** Docker Desktop は使わない。公式の apt リポジトリから `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-compose-plugin` を入れる。確認: `docker run --rm hello-world`
4. **nvidia-container-toolkit を入れる。** 確認: `docker run --rm --gpus all ubuntu nvidia-smi` で RTX 5080 が見えること。ドライバは 550 以降が必要。
5. **リポジトリを clone し `.env` を作る。** `API_TOKEN` は `openssl rand -hex 32` で生成する。
6. **起動してモデルを取得する。**

```bash
docker compose up -d
docker compose exec ollama ollama pull qwen2.5-coder:14b
docker compose exec ollama ollama pull translategemma:12b
```

7. **VRAM の実測を行う。** ここが設計上の懸念点である。

```bash
docker compose exec ollama ollama ps
```

`SIZE` 列がロード済みの総メモリ量、`CONTEXT` 列が実際に割り当てられた context 長を示す。`CONTEXT` が 32768 になっていること、`PROCESSOR` が `100% GPU` であることを確認する。`100% CPU` や部分ロードになっている場合は VRAM に収まっていない。その場合の対処は `docs/design.md` の「context 長と KV cache」に記した順序で試す。

8. **Mac から疎通を確認する。**

```bash
curl http://<windows-ip>:8080/health
```

- [ ] **Step 2: 実機で手順どおりに構築する**

runbook を上から実行する。詰まった箇所は runbook 側を直す。手順書は実際に通ることを確認して初めて完成とする。

- [ ] **Step 3: Mac から一度レビューを走らせる**

```bash
export EXOCORTEX_ENDPOINT=http://<windows-ip>:8080
export EXOCORTEX_TOKEN=<token>
cd ~/Sites/github.com/haribote/exocortex
pnpm --filter @exocortex/cli build
node apps/cli/dist/index.js --base main
```

Expected: レビュー結果が表示される。`meta` の `durationMs` と `inputTokens` が妥当な値であること。

- [ ] **Step 4: コミットする**

```bash
git add docs/setup-windows.md
git commit -m "docs: add windows setup runbook"
```

---

## Task 12: Claude Code skill（dotfiles 側）

このタスクだけ exocortex リポジトリの外で作業する。skill は全リポジトリ横断で使う個人設定であり、特定プロダクトの持ち物ではないためである。

**Files:**
- Create: `~/Sites/github.com/haribote/dotfiles/.claude/skills/ai-review/SKILL.md`

**Interfaces:**
- Consumes: `ai-review` コマンド（Task 10）
- Produces: Claude Code から `/ai-review` で呼べる skill

- [ ] **Step 1: CLI を PATH に通す**

```bash
cd ~/Sites/github.com/haribote/exocortex
pnpm build
ln -s "$PWD/apps/cli/dist/index.js" ~/.local/bin/ai-review
chmod +x apps/cli/dist/index.js
```

確認: `ai-review --help` が動くこと。

- [ ] **Step 2: skill を書く**

`SKILL.md` の frontmatter と本文を書く。中身は薄くする。CLI のオプションを列挙すると、CLI 側の変更で skill が腐るためである。

```markdown
---
name: ai-review
description: ローカル LLM サーバー (exocortex) にコードレビューを依頼するときに使う。git diff と関連ファイルを集めて Windows の GPU マシンに送り、指摘を受け取る。「ローカルでレビューして」「exocortex でレビュー」などの依頼で発動する。
---

# ai-review

`ai-review` コマンドを実行してレビュー結果を受け取る。

オプションは `ai-review --help` で確認する。指定がなければ未コミットの変更をレビューする。

`EXOCORTEX_ENDPOINT` と `EXOCORTEX_TOKEN` が未設定の場合はその旨を伝えて終了する。勝手に値を推測しない。

結果はそのまま提示する。指摘の取捨選択はユーザーが行う。ローカル LLM の指摘は誤りを含みうるので、明らかに誤っているものがあれば根拠を添えて指摘する。
```

- [ ] **Step 3: 動作を確認してコミットする**

Claude Code を再起動し、`/ai-review` が候補に出ることを確認する。

```bash
cd ~/Sites/github.com/haribote/dotfiles
git add .claude/skills/ai-review
git commit -m "feat: add ai-review skill"
```

---

## 完了の基準

- `pnpm lint && pnpm test && pnpm build` がすべて通る。
- Windows 側で `docker compose up -d` が成功し、`ollama ps` の `PROCESSOR` が `100% GPU`、`CONTEXT` が 32768 である。
- Mac から `ai-review --base main` を実行してレビュー結果が返る。
- Mac から `/translate` に日本語を投げて英訳が返る。
- `docs/setup-windows.md` の手順が、実機で上から順に通ることを確認済みである。
