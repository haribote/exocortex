import { describe, expect, it } from 'vitest'
import type { ReviewOutcome } from './client.ts'
import { type RunRecord, renderAdjudication, renderSummary } from './report.ts'
import { scoreOutcome } from './score.ts'

const files = new Map([['src/a.ts', 'const a = 1\nconst b = 2\n']])

function outcome(meta: Record<string, unknown> = {}): ReviewOutcome {
  const raw = {
    summary: 's',
    comments: [
      {
        severity: 'major',
        file: 'src/a.ts',
        line: 1,
        quote: 'const a = 1',
        message: 'm',
      },
    ],
    meta: {
      model: 'qwen3:14b',
      inputTokens: 1000,
      durationMs: 9000,
      droppedComments: 0,
      droppedContextFiles: 0,
      ...meta,
    },
  }
  return {
    status: 200,
    body: JSON.stringify(raw),
    wallMs: 9500,
    raw,
    response: raw as never,
  }
}

function record(
  configId: string,
  caseId: string,
  meta: Record<string, unknown> = {},
): RunRecord {
  const call = outcome(meta)
  return {
    runId: 'r1',
    configId,
    caseId,
    repeat: 1,
    startedAt: '2026-07-25T02:00:00.000Z',
    model: 'qwen3:14b',
    summary: 's',
    comments: call.response?.comments ?? [],
    score: scoreOutcome({ files, expected: [] }, call),
  }
}

function tableWidths(markdown: string): number[][] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => [line.split('|').length])
}

describe('renderSummary', () => {
  const records = [
    record('C0', 'logic-inversion-01', { promptEvalTokens: 15_400 }),
    record('C1', 'logic-inversion-01', { promptEvalTokens: 30_000 }),
    record('C1', 'size-01', { promptEvalTokens: 33_000, thinkingTokens: 1242 }),
  ]
  const markdown = renderSummary(records)

  it('keeps every row of a table the same width as its header', () => {
    for (const table of markdown.split('\n\n')) {
      if (!table.includes('|')) continue
      const widths = tableWidths(table).map(([width]) => width)
      expect(new Set(widths).size, table).toBe(1)
    }
  })

  it('reports the largest prompt and the smallest remaining context', () => {
    expect(markdown).toContain('prompt tokens (最大)')
    expect(markdown).toContain('33000 / -232')
  })

  it('shows a config that never reported tokens as unknown, not as zero', () => {
    const quiet = renderSummary([record('C9', 'logic-inversion-01')])

    expect(quiet).not.toContain('32768 / ')
    expect(quiet).toContain('| - | - | - |')
  })

  it('averages thinking tokens only over the runs that reported them', () => {
    expect(markdown).toContain('thinking tokens (平均)')
  })
})

describe('renderAdjudication', () => {
  it('keeps the config out of the worksheet but in the key', () => {
    const result = renderAdjudication([record('C0', 'logic-inversion-01')])

    expect(result.markdown).not.toContain('C0')
    expect(result.key[0]?.configId).toBe('C0')
  })
})
