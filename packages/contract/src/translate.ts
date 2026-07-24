import * as z from 'zod'
import { errorResponseSchema } from './error.js'

export const languageCodeSchema = z.enum(['ja', 'en'])

export const translateRequestSchema = z.object({
  text: z.string().min(1),
  from: languageCodeSchema,
  to: languageCodeSchema,
})

export const translateMetaSchema = z.object({
  model: z.string(),
  durationMs: z.number().int(),
})

export const translateDeltaChunkSchema = z.object({ delta: z.string() })

export const translateHeartbeatChunkSchema = z.object({
  heartbeat: z.literal(true),
})

export const translateDoneChunkSchema = z.object({
  done: z.literal(true),
  meta: translateMetaSchema,
})

export const translateErrorChunkSchema = errorResponseSchema

export const translateStreamChunkSchema = z.union([
  translateDeltaChunkSchema,
  translateHeartbeatChunkSchema,
  translateDoneChunkSchema,
  translateErrorChunkSchema,
])

export type LanguageCode = z.infer<typeof languageCodeSchema>
export type TranslateRequest = z.infer<typeof translateRequestSchema>
export type TranslateMeta = z.infer<typeof translateMetaSchema>
export type TranslateDeltaChunk = z.infer<typeof translateDeltaChunkSchema>
export type TranslateHeartbeatChunk = z.infer<
  typeof translateHeartbeatChunkSchema
>
export type TranslateDoneChunk = z.infer<typeof translateDoneChunkSchema>
export type TranslateErrorChunk = z.infer<typeof translateErrorChunkSchema>
export type TranslateStreamChunk = z.infer<typeof translateStreamChunkSchema>
