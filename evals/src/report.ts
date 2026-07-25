import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import type { ReviewComment } from '@exocortex/contract'
import type { Score } from './score.ts'

export const RUNS_DIR = join(import.meta.dirname, '..', 'runs')

export interface RunRecord {
  runId: string
  configId: string
  caseId: string
  repeat: number
  startedAt: string
  model: string | null
  summary: string | null
  comments: ReviewComment[]
  score: Score
  body?: string
}

export interface AdjudicationEntry {
  commentId: string
  configId: string
  caseId: string
  repeat: number
  commentIndex: number
  model: string | null
}

export interface Adjudication {
  markdown: string
  key: AdjudicationEntry[]
}

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  return (
    typeof raw.configId === 'string' &&
    typeof raw.caseId === 'string' &&
    typeof raw.repeat === 'number' &&
    typeof raw.score === 'object' &&
    raw.score !== null &&
    Array.isArray(raw.comments)
  )
}

export function parseResults(ndjson: string): RunRecord[] {
  return ndjson
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const value: unknown = JSON.parse(line)
      if (!isRunRecord(value)) {
        throw new Error(`results.ndjson line ${index + 1} is not a run record`)
      }
      return value
    })
}

export function commentId(record: RunRecord, index: number): string {
  const seed = [
    record.runId,
    record.configId,
    record.caseId,
    record.repeat,
    index,
  ].join(' ')
  return createHash('sha256').update(seed).digest('hex').slice(0, 10)
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return '-'
  return `${((numerator / denominator) * 100).toFixed(0)}%`
}

function per(numerator: number, denominator: number): string {
  if (denominator === 0) return '-'
  return (numerator / denominator).toFixed(2)
}

function seconds(values: readonly number[]): string {
  if (values.length === 0) return '-'
  return (sum(values) / values.length / 1000).toFixed(1)
}

function table(header: readonly string[], rows: readonly string[][]): string {
  const divider = header.map(() => '---')
  return [header, divider, ...rows]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n')
}

function groupBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}

function sortedKeys<T>(groups: ReadonlyMap<string, T>): string[] {
  return [...groups.keys()].sort()
}

function totals(records: readonly RunRecord[]) {
  const scores = records.map((record) => record.score)
  return {
    runs: records.length,
    schemaOk: scores.filter((score) => score.schemaOk).length,
    comments: sum(scores.map((score) => score.comments)),
    quoteMatches: sum(scores.map((score) => score.quoteMatches)),
    hallucinatedPaths: sum(scores.map((score) => score.hallucinatedPaths)),
    expectedTotal: sum(scores.map((score) => score.expectedTotal)),
    hitLine: sum(scores.map((score) => score.hitLine)),
    hitNear2: sum(scores.map((score) => score.hitNear2)),
    hitFile: sum(scores.map((score) => score.hitFile)),
    unmatched: sum(scores.map((score) => score.unmatchedComments)),
    droppedComments: sum(scores.map((score) => score.droppedComments ?? 0)),
    droppedContextFiles: sum(
      scores.map((score) => score.droppedContextFiles ?? 0),
    ),
    wallMs: scores.map((score) => score.wallMs),
  }
}

function overviewTable(byConfig: ReadonlyMap<string, RunRecord[]>): string {
  const rows = sortedKeys(byConfig).map((configId) => {
    const records = byConfig.get(configId) ?? []
    const t = totals(records)
    return [
      configId,
      unique(records.map((record) => record.model ?? '-')).join(', '),
      String(t.runs),
      rate(t.schemaOk, t.runs),
      rate(t.quoteMatches, t.comments),
      rate(t.hitLine, t.expectedTotal),
      rate(t.hitNear2, t.expectedTotal),
      rate(t.hitFile, t.expectedTotal),
      per(t.unmatched, t.runs),
      String(t.hallucinatedPaths),
      String(t.droppedComments),
      String(t.droppedContextFiles),
      seconds(t.wallMs),
    ]
  })

  return table(
    [
      'config',
      'model',
      'runs',
      'schemaOk',
      'quote 一致',
      'hit@line',
      'hit@±2',
      'hit@file',
      '未対応/run',
      '不在パス',
      'dropped comments',
      'dropped context',
      '平均 wall (s)',
    ],
    rows,
  )
}

function caseTable(
  records: readonly RunRecord[],
  configs: readonly string[],
  cell: (records: readonly RunRecord[]) => string,
): string {
  const byCase = groupBy(records, (record) => record.caseId)
  const rows = sortedKeys(byCase).map((caseId) => {
    const forCase = byCase.get(caseId) ?? []
    return [
      caseId,
      ...configs.map((configId) =>
        cell(forCase.filter((record) => record.configId === configId)),
      ),
    ]
  })

  return table(['case', ...configs], rows)
}

export function renderSummary(records: readonly RunRecord[]): string {
  const byConfig = groupBy(records, (record) => record.configId)
  const configs = sortedKeys(byConfig)
  const runIds = unique(records.map((record) => record.runId))

  return [
    `# eval summary`,
    '',
    `- run: ${runIds.join(', ') || '-'}`,
    `- 記録数: ${records.length}`,
    `- config: ${configs.join(', ') || '-'}`,
    '',
    '## config ごとの集計',
    '',
    overviewTable(byConfig),
    '',
    '## case 別 hit@±2 (命中した expected / expected 総数)',
    '',
    caseTable(records, configs, (forCase) => {
      const t = totals(forCase)
      return t.runs === 0 ? '-' : `${t.hitNear2}/${t.expectedTotal}`
    }),
    '',
    '## case 別 未対応コメント数 (clean case では false positive 候補)',
    '',
    caseTable(records, configs, (forCase) => {
      const t = totals(forCase)
      return t.runs === 0 ? '-' : per(t.unmatched, t.runs)
    }),
    '',
    '## case 別 quote 一致率',
    '',
    caseTable(records, configs, (forCase) => {
      const t = totals(forCase)
      return t.runs === 0 ? '-' : rate(t.quoteMatches, t.comments)
    }),
    '',
    '## case 別 平均 wall (s)',
    '',
    caseTable(records, configs, (forCase) => seconds(totals(forCase).wallMs)),
    '',
    '判定は自動指標だけでは決まりません。',
    'true positive と false positive の別は `adjudication.md` を盲検で採点してから判断してください。',
    '',
  ].join('\n')
}

export function renderAdjudication(
  records: readonly RunRecord[],
): Adjudication {
  const key: AdjudicationEntry[] = []
  const byCase = groupBy(records, (record) => record.caseId)
  const sections: string[] = [
    '# adjudication worksheet',
    '',
    'コメントの出所は伏せてあります。',
    '対応表は `adjudication-key.json` にあります。採点を終えるまで開かないでください。',
    '',
    '各コメントについて、`判定` の該当する語だけを残してください。',
    '',
  ]

  for (const caseId of sortedKeys(byCase)) {
    const entries = (byCase.get(caseId) ?? [])
      .flatMap((record) =>
        record.comments.map((comment, index) => ({
          id: commentId(record, index),
          record,
          index,
          comment,
        })),
      )
      .sort((a, b) => a.id.localeCompare(b.id))

    sections.push(`## ${caseId}`, '')
    if (entries.length === 0) {
      sections.push('コメントはありません。', '')
      continue
    }

    for (const entry of entries) {
      key.push({
        commentId: entry.id,
        configId: entry.record.configId,
        caseId,
        repeat: entry.record.repeat,
        commentIndex: entry.index,
        model: entry.record.model,
      })

      sections.push(
        `### ${entry.id}`,
        '',
        `- 位置: \`${entry.comment.file}:${entry.comment.line}\``,
        `- severity: ${entry.comment.severity}`,
        '',
        '```',
        entry.comment.quote,
        '```',
        '',
        entry.comment.message,
        '',
        '判定: true positive / false positive / 判断不能',
        'メモ:',
        '',
      )
    }
  }

  return { markdown: sections.join('\n'), key }
}

function main(): void {
  const { values } = parseArgs({
    options: { run: { type: 'string', default: 'default' } },
  })
  const dir = join(RUNS_DIR, values.run as string)
  const records = parseResults(
    readFileSync(join(dir, 'results.ndjson'), 'utf8'),
  )
  const adjudication = renderAdjudication(records)

  writeFileSync(join(dir, 'summary.md'), renderSummary(records))
  writeFileSync(join(dir, 'adjudication.md'), adjudication.markdown)
  writeFileSync(
    join(dir, 'adjudication-key.json'),
    `${JSON.stringify(adjudication.key, null, 2)}\n`,
  )

  console.log(
    `wrote summary.md, adjudication.md, adjudication-key.json to ${dir}`,
  )
}

if (process.argv[1] === import.meta.filename) {
  main()
}
