// 从 docs/spec/stages/*.md 的课表生成 src/data/outline.ts（全部 700 天的标题、类型、推导目标）。
// 用法：npm run outline
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'docs/spec/stages'
const KIND = { 新: 'new', 练: 'practice', 案: 'case', 复: 'review' }
const stages = []
const lessons = []

for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
  const md = readFileSync(join(dir, f), 'utf8')
  const head = md.match(/^# 阶段 (\d+) · (.+)$/m)
  const n = Number(head[1])
  const [name, sub = ''] = head[2].split('：')
  const goal = (md.match(/## 阶段目标\s+([\s\S]*?)\n\n/) || [])[1]?.trim() ?? ''
  const canExplain = [...(md.match(/## 学完能讲清\s+([\s\S]*?)\n\n/)?.[1] ?? '').matchAll(/- \[ \] (.+)/g)].map((m) => m[1].trim())
  const rows = [...md.matchAll(/^\| *(\d+) *\| *([^|]+?) *\| *([^|]+?) *\|(?: *([^|]*?) *\|)?\s*$/gm)]
  for (const r of rows) {
    const kindCh = r[2].trim()[0]
    lessons.push({ day: Number(r[1]), stage: n, kind: KIND[kindCh] ?? 'new', title: r[3].trim(), goal: (r[4] ?? '').trim() })
  }
  const days = rows.map((r) => Number(r[1]))
  stages.push({ n, name: name.trim(), sub: sub.trim(), from: Math.min(...days), to: Math.max(...days), goal, canExplain, file: f })
}

const out = `// 由 scripts/gen-outline.mjs 从 docs/spec/stages/*.md 自动生成，请勿手改。
import type { LessonKind } from './types'

export interface StageMeta { n: number; name: string; sub: string; from: number; to: number; goal: string; canExplain: string[]; file: string }
export interface OutlineLesson { day: number; stage: number; kind: LessonKind; title: string; goal: string }

export const STAGES: StageMeta[] = ${JSON.stringify(stages, null, 1)}

export const OUTLINE: OutlineLesson[] = ${JSON.stringify(lessons)}
`
writeFileSync('src/data/outline.ts', out)
console.log(`stages ${stages.length}, lessons ${lessons.length}`)
