import * as z from 'zod'

export const contextFileSizeSchema = z.object({
  path: z.string(),
  estimatedTokens: z.number().int(),
})

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  contextFiles: z.array(contextFileSizeSchema).optional(),
})

export type ContextFileSize = z.infer<typeof contextFileSizeSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
