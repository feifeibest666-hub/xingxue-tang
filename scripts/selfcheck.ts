// 内容与天文计算自检：npm run check
import { readFileSync } from 'node:fs'
import { OUTLINE, STAGES } from '../src/data/outline'
import { LESSONS } from '../src/data/curriculum'
import { WIDGET_NAMES } from '../src/components/widgets'
import { TAGS } from '../src/data/types'
import { ascensionTime, sunLongitude, ayanamsaAt } from '../src/lib/astro'
import { element, modality, polarity, signOf } from '../src/data/zodiac'
import { boundAt, faceAt, dignityOf, detrimentOf, fallOf } from '../src/data/classical'

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
  const bare = (t: string) => t.replace(/（[^）]*）$/, '')
  if (bare(ol.title) !== bare(l.title)) err(`${where} 标题与课表不一致：${l.title} ≠ ${ol.title}`)
  if (ol.stage !== l.stage) err(`${where} 阶段 ${l.stage} 与课表 ${ol.stage} 不一致`)
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
if (new Set(days).size !== days.length) err('有重复的课')
for (const st of STAGES) {
  const built = days.filter((d) => d >= st.from && d <= st.to).length
  if (built && built !== st.to - st.from + 1) err(`阶段 ${st.n} 只写了 ${built}/${st.to - st.from + 1} 课`)
  if (built && !LESSONS.find((l) => l.day === st.to)?.cert) err(`阶段 ${st.n} 最后一课缺 cert`)
}
ok(`已写好 ${LESSONS.length} 课，${LESSONS.reduce((n, l) => n + l.quiz.length, 0)} 道题，${LESSONS.reduce((n, l) => n + l.qa.length, 0)} 条问答`)

// 3. 星座属性公式
const want = [['阳', '火', '开创'], ['阴', '土', '固定'], ['阳', '风', '变动'], ['阴', '水', '开创']]
want.forEach(([p, e, m], k) => {
  const i = k + 1
  if (polarity(i) !== p || element(i) !== e || modality(i) !== m) err(`第 ${i} 宫属性公式错误`)
})
if (signOf(359.9).sign.name !== '双鱼' || signOf(0).sign.name !== '白羊' || signOf(-1).sign.name !== '双鱼') err('signOf 边界错误')
if (boundAt(0) !== 'jupiter' || boundAt(359.5) !== 'saturn' || faceAt(0) !== 'mars' || faceAt(355) !== 'mars' || faceAt(10) !== 'sun') err('界/外观表错误')
if (detrimentOf('mars').join() !== '7,2' || fallOf('sun') !== 7 || dignityOf('sun', 139, true)[0]?.name !== '入庙') err('尊贵表错误')
ok('星座属性公式、古典尊贵表')

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

// 5. 星盘与时间技术（src/lib/natal.ts、timing.ts）：爱因斯坦 1879-03-14 11:30 LMT 乌尔姆，对照常用软件的结果
{
  const { computeChart, cusps } = await import('../src/lib/natal')
  const T = await import('../src/lib/timing')
  const c = await computeChart({ date: '1879-03-14', time: '11:30', tz: 10 / 15, lat: 48.4, lon: 10.0 })
  const near = (a: number, b: number, tol: number, what: string) => { const d = Math.abs(((a - b + 540) % 360) - 180); if (d > tol) err(`${what} 应约 ${b}，得到 ${a.toFixed(2)}`) }
  near(c.asc, 101.63, 0.1, '爱因斯坦上升'); near(c.mc, 342.83, 0.1, '爱因斯坦天顶')
  near(c.pos.sun.lon, 353.5, 0.05, '爱因斯坦太阳'); near(c.pos.moon.lon, 254.52, 0.1, '爱因斯坦月亮')
  if (!c.isDay) err('爱因斯坦应为日生盘')
  if (cusps({ ...c, lat: 70 }, 'placidus') !== null) err('普拉西度在北纬 70° 应无解')
  const f = T.firdaria(true)
  if (f.reduce((n, p) => n + (p.to - p.from), 0) !== 75 || f[2].lord !== 'mercury') err('法达总数应为 75 年，日盘第 3 段为水星')
  if (T.ZR_SIGN_YEARS.reduce((a, b) => a + b, 0) !== 211 || T.ZR_SIGN_YEARS[9] !== 27) err('黄道释放星座年数合计应为 211、摩羯 27')
  const zr = T.zodiacalReleasing(10, 360 * 27, 2).filter((p) => p.level === 2)
  if (zr[12]?.sign !== 4 || !zr[12]?.lb) err('摩羯 L1 内第 13 个 L2 应松绑跳到巨蟹')
  if (T.profection(4, 26).sign !== 6) err('巨蟹上升 26 岁小限应到处女')
  const sat = await T.returnsOf(c, 'saturn', 32)
  if (!sat.length || Math.abs(T.ageAt(c.ut, sat[0]) - 29.1) > 0.5) err('爱因斯坦第一次土星回归应约 29 岁')
  ok(`星盘：爱因斯坦上升 ${c.asc.toFixed(2)}°、天顶 ${c.mc.toFixed(2)}°；法达、释放、小限、土星回归`)
}

if (fail) { console.error(`\n${fail} 项未通过`); process.exit(1) }
console.log('\n全部通过')
