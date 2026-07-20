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
