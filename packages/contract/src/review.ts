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
  context: z
    .object({ files: z.array(contextFileSchema).default([]) })
    .default({ files: [] }),
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
