import * as z from 'zod'

export const severitySchema = z.enum(['critical', 'major', 'minor', 'info'])

export const contextFileSchema = z.object({
  path: z.string(),
  content: z.string(),
})

export const reviewRequestSchema = z
  .object({
    language: z.string(),
    base: z.string().optional(),
    staged: z.boolean().optional(),
    rules: z.array(z.string()).default([]),
    mode: z.enum(['whole', 'per-file']).default('whole'),
  })
  .refine((request) => !(request.base !== undefined && request.staged), {
    message: 'base and staged are mutually exclusive',
  })

export const reviewCommentSchema = z.object({
  severity: severitySchema,
  file: z.string(),
  line: z.number().int(),
  quote: z.string(),
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
  droppedComments: z.number().int(),
  droppedContextFiles: z.number().int(),
  promptEvalTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  thinkingChars: z.number().int().optional(),
  loadDurationMs: z.number().int().optional(),
})

export function normalizeQuote(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export const reviewResponseSchema = z.object({
  summary: z.string(),
  comments: z.array(reviewCommentSchema),
  meta: reviewMetaSchema,
})

export const reviewResultJsonSchema = z.toJSONSchema(reviewResultSchema)

export const perFileResultSchema = z.object({
  file: z.string(),
  summary: z.string(),
  comments: z.array(reviewCommentSchema),
  meta: reviewMetaSchema,
})

export const perFileErrorSchema = z.object({
  file: z.string(),
  error: z.string(),
  message: z.string(),
})

export const reviewHeartbeatSchema = z.object({
  heartbeat: z.literal(true),
})

export const perFileDoneMetaSchema = z.object({
  model: z.string(),
  reviewed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
})

export const perFileDoneSchema = z.object({
  done: z.literal(true),
  meta: perFileDoneMetaSchema,
})

// A failure that belongs to the run rather than to any one file, which is why
// it carries no path. The per-file reviewer handles its own errors, so this
// only appears when something outside the loop gives way.
export const reviewRunErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Order matters: zod takes the first member that fits and drops keys the member
// does not declare, so a line naming a file would also satisfy the run-level
// error if that one came first.
export const reviewStreamLineSchema = z.union([
  perFileResultSchema,
  perFileErrorSchema,
  reviewHeartbeatSchema,
  perFileDoneSchema,
  reviewRunErrorSchema,
])

export type Severity = z.infer<typeof severitySchema>
export type ContextFile = z.infer<typeof contextFileSchema>
export type ReviewRequest = z.infer<typeof reviewRequestSchema>
export type ReviewComment = z.infer<typeof reviewCommentSchema>
export type ReviewResult = z.infer<typeof reviewResultSchema>
export type ReviewMeta = z.infer<typeof reviewMetaSchema>
export type ReviewResponse = z.infer<typeof reviewResponseSchema>
export type PerFileResult = z.infer<typeof perFileResultSchema>
export type PerFileError = z.infer<typeof perFileErrorSchema>
export type ReviewRunError = z.infer<typeof reviewRunErrorSchema>
export type ReviewHeartbeat = z.infer<typeof reviewHeartbeatSchema>
export type PerFileDoneMeta = z.infer<typeof perFileDoneMetaSchema>
export type PerFileDone = z.infer<typeof perFileDoneSchema>
export type ReviewStreamLine = z.infer<typeof reviewStreamLineSchema>
