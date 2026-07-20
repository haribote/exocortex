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
