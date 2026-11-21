// 内容与天文计算自检：npm run check
import { readFileSync } from 'node:fs'
import { OUTLINE, STAGES } from '../src/data/outline'
import { LESSONS } from '../src/data/curriculum'
import { WIDGET_NAMES } from '../src/components/widgets'
import { TAGS } from '../src/data/types'
import { ascensionTime, sunLongitude, ayanamsaAt } from '../src/lib/astro'
import { element, modality, polarity, signOf } from '../src/data/zodiac'

let fail = 0
const err = (m: string) => { fail++; console.error('✗', m) }
const ok = (m: string) => console.log('✓', m)

// 1. 课表：700 天连续，阶段范围和 plan.md 一致
if (OUTLINE.length !== 700) err(`课表应为 700 天，实际 ${OUTLINE.length}`)
OUTLINE.forEach((l, i) => { if (l.day !== i + 1) err(`第 ${i + 1} 行的 day 是 ${l.day}`) })
if (STAGES.length !== 17) err(`应有 17 个阶段，实际 ${STAGES.length}`)
STAGES.forEach((s, i) => {
  if (i > 0 && s.from !== STAGES[i - 1].to + 1) err(`阶段 ${s.n} 起点 ${s.from} 与上一阶段不连续`)
  OUTLINE.filter((l) => l.stage === s.n).forEach((l) => { if (l.day < s.from || l.day > s.to) err(`第 ${l.day} 天不在阶段 ${s.n} 的范围内`) })
})
const plan = readFileSync(new URL('../docs/spec/plan.md', import.meta.url), 'utf8')
for (const s of STAGES) if (!plan.includes(`${s.from}–${s.to}`) && !plan.includes(`${s.from}-${s.to}`)) err(`plan.md 里找不到阶段 ${s.n} 的范围 ${s.from}–${s.to}`)
ok(`课表 ${OUTLINE.length} 天、${STAGES.length} 个阶段`)

// 2. 第一阶段 42 课内容
const days = LESSONS.map((l) => l.day)
for (let d = 1; d <= 42; d++) if (!days.includes(d)) err(`缺第 ${d} 天的完整内容`)
for (const l of LESSONS) {
  const where = `第 ${l.day} 天`
  const ol = OUTLINE[l.day - 1]
  if (ol.kind !== l.kind) err(`${where} 类型 ${l.kind} 与课表 ${ol.kind} 不一致`)
  if (!l.question) err(`${where} 缺"本课问题"`)
  if (!l.qa.length) err(`${where} 没有问答`)
  if (l.kind === 'new') {
    if (l.quiz.length < 3) err(`${where} 新课只有 ${l.quiz.length} 道题`)
    if (!l.screens.some((s) => s.t === 'debate' || (s.t === 'text' && (s.tag === '约定' || s.tag === '争议')))) err(`${where} 新课缺约定/争议屏`)
    if (!l.screens.some((s) => s.t === 'derive')) err(`${where} 新课缺推导屏`)
  }
  if (!l.quiz.length) err(`${where} 没有题`)
  l.screens.forEach((s, i) => {
    if (s.t === 'widget' && !WIDGET_NAMES.includes(s.w)) err(`${where} 第 ${i + 1} 屏互动 "${s.w}" 不存在`)
    if (s.t === 'text' && !TAGS.includes(s.tag)) err(`${where} 第 ${i + 1} 屏标签无效`)
    if (s.t === 'summary' && s.points.length > 3) err(`${where} 小结超过 3 条`)
  })
  l.quiz.forEach((q, i) => {
    const w = `${where} 第 ${i + 1} 题`
    if (q.t === 'choice' || q.t === 'steps') {
      const parts = q.t === 'choice' ? [q] : q.parts
      for (const p of parts) {
        if (new Set(p.opts).size !== p.opts.length) err(`${w} 选项重复`)
        if (p.a < 0 || p.a >= p.opts.length) err(`${w} 答案越界`)
        if (!p.ex) err(`${w} 缺解析`)
      }
      if (q.t === 'choice' && q.back != null && (q.back < 0 || q.back >= l.screens.length)) err(`${w} back 指向不存在的屏`)
    }
    if (q.t === 'sort') q.items.forEach(([, b]) => { if (b < 0 || b >= q.bins.length) err(`${w} 分类越界`) })
    if (q.t === 'order' && q.steps.length < 3) err(`${w} 排序步骤太少`)
  })
}
ok(`第一阶段 ${LESSONS.length} 课，${LESSONS.reduce((n, l) => n + l.quiz.length, 0)} 道题，${LESSONS.reduce((n, l) => n + l.qa.length, 0)} 条问答`)

// 3. 星座属性公式
const want = [['阳', '火', '开创'], ['阴', '土', '固定'], ['阳', '风', '变动'], ['阴', '水', '开创']]
want.forEach(([p, e, m], k) => {
  const i = k + 1
  if (polarity(i) !== p || element(i) !== e || modality(i) !== m) err(`第 ${i} 宫属性公式错误`)
})
if (signOf(359.9).sign.name !== '双鱼' || signOf(0).sign.name !== '白羊' || signOf(-1).sign.name !== '双鱼') err('signOf 边界错误')
ok('星座属性公式')

// 4. 天文回归测试
const lon2000 = await sunLongitude(new Date(Date.UTC(2000, 0, 1, 12)))
if (Math.abs(lon2000 - 280.4) > 0.3) err(`2000-01-01 太阳黄经应约 280.4°，得到 ${lon2000.toFixed(2)}`)
const eq = await sunLongitude(new Date(Date.UTC(2026, 2, 20, 14, 46)))
if (Math.min(Math.abs(eq), Math.abs(eq - 360)) > 0.1) err(`2026 春分时刻太阳黄经应约 0°，得到 ${eq.toFixed(3)}`)
const aries = ascensionTime(0, 39.9), libra = ascensionTime(6, 39.9)
if (!(aries < 2 && libra > 2)) err(`北京白羊应为短上升（<2h），天秤为长上升（>2h），得到 ${aries}, ${libra}`)
const eq0 = ascensionTime(0, 0) + ascensionTime(1, 0) + ascensionTime(2, 0)
if (Math.abs(eq0 - 6) > 0.1) err(`赤道上白羊到双子上升时间合计应约 6h，得到 ${eq0}`)
if (Math.abs(ayanamsaAt(2026) - 24.21) > 0.1) err(`2026 年岁差值应约 24.2°，得到 ${ayanamsaAt(2026)}`)
ok(`天文：2000-01-01 太阳 ${lon2000.toFixed(2)}°；白羊上升 ${aries.toFixed(2)}h、天秤 ${libra.toFixed(2)}h`)

if (fail) { console.error(`\n${fail} 项未通过`); process.exit(1) }
console.log('\n全部通过')
