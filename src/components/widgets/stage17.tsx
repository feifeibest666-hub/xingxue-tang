import { useMemo, useState } from 'react'
import { Note, reduceMotion, type WidgetMap } from './common'
import { CasePicker, MyBirthForm, useChartOf } from './natal'
import { setNote, useStore } from '../../lib/store'
import { LESSONS, QA_ALL, STAGES } from '../../data/curriculum'
import { HOUSE_TOPICS, PLANET } from '../../data/classical'
import { SIGNS } from '../../data/zodiac'
import { BODY_NAME, signIdx, type Body, type Chart } from '../../lib/natal'
import { FLORD_NAME, ageAt, firdaria, fmtDate, profection, solarReturn, transitList, zodiacalReleasing, type FLord } from '../../lib/timing'

const GOLD = '#c2a05a'
const DIM = 'rgba(246,241,228,0.55)'

const RUBRIC: [string, string][] = [
  ['依据', '每个结论都说出来源'],
  ['分层', '标出事实、推导、传统、约定、争议'],
  ['不跳步', '推导链完整'],
  ['类比', '至少一个恰当类比，并说出它在哪里不成立'],
  ['诚实', '不夸大预测力，提及证据状态'],
  ['清楚', '外行也能听懂主线'],
]
const SLOTS = ['钩子', '观察', '推导', '约定', '类比', '检验'] as const

function readJson<T>(raw: string | undefined, fallback: T): T {
  try {
    const v = JSON.parse(raw ?? '')
    return v && typeof v === 'object' ? v as T : fallback
  } catch { return fallback }
}
const lordName = (id: string) => FLORD_NAME[id as FLord] ?? PLANET[id as keyof typeof PLANET]?.name ?? id
const signName = (i: number) => SIGNS[((i - 1) % 12 + 12) % 12]?.name ?? '—'
const utcNoon = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
}

/* ── 毕业评分表：六项各 1–3 星，按讲解 id 存在本机 ── */
function Rubric({ id }: { id: string }) {
  const notes = useStore().notes
  const score = readJson<Record<string, number>>(notes[id], {})
  const set = (k: string, n: number) => setNote(id, JSON.stringify({ ...score, [k]: n }))
  const total = RUBRIC.reduce((s, [k]) => s + (score[k] || 0), 0)
  const scored = RUBRIC.filter(([k]) => (score[k] || 0) >= 1)
  const min = scored.reduce((m, [k]) => Math.min(m, score[k]), 3)
  const weak = scored.filter(([k]) => score[k] === min).map(([k]) => k)
  return (
    <div className="wg">
      <Note>毕业评分表 · 存在本机（{id}）</Note>
      {RUBRIC.map(([k, tip]) => (
        <div key={k} className="wg-row" style={{ alignItems: 'center' }}>
          <label title={tip}>{k}</label>
          <span className="wg-btns" style={{ margin: 0 }}>
            {[1, 2, 3].map((n) => (
              <button key={n} className={`wg-btn ${score[k] === n ? 'on' : ''}`} onClick={() => set(k, n)}>{'★'.repeat(n)}</button>
            ))}
          </span>
        </div>
      ))}
      <div className="wg-cap">合计 <b style={{ color: GOLD }}>{total}</b> / 18。{scored.length < 6 ? '还有项目没打星。' : <>最弱：<b>{weak.join('、')}</b>（{min} 星）。改这一项，再录一遍。</>}</div>
      <div className="wg-read"><span>1 星 = 没做到，2 星 = 做到一半，3 星 = 外行能跟着走完。这是自评，不是证书分数。</span></div>
    </div>
  )
}

/* ── 15 分钟提纲：六个格子 ── */
function LecturePlan({ id }: { id: string }) {
  const notes = useStore().notes
  const data = readJson<Record<string, string>>(notes[id], {})
  const set = (k: string, v: string) => setNote(id, JSON.stringify({ ...data, [k]: v }))
  const filled = SLOTS.filter((k) => (data[k] ?? '').trim()).length
  return (
    <div className="wg">
      <Note>15 分钟提纲 · {filled}/6 格 · {id}</Note>
      {SLOTS.map((k) => (
        <label key={k} style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          <span style={{ color: GOLD }}>{k}</span>
          <textarea value={data[k] ?? ''} rows={2} onChange={(e) => set(k, e.target.value)} style={{ width: '100%', marginTop: 4 }} />
        </label>
      ))}
      <div className="wg-cap">每格一两句就够。类比那一格要写上「它在哪里不成立」。</div>
    </div>
  )
}

/* ── 继续研究清单（疑问本 + 自己加的） ── */
function Research({ id }: { id: string }) {
  const s = useStore()
  const mine = readJson<string[]>(s.notes[id], [])
  const list = Array.isArray(mine) ? mine : []
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (!t) return
    setNote(id, JSON.stringify([t, ...list].slice(0, 30)))
    setText('')
  }
  const qs = s.myQs ?? []
  return (
    <div className="wg">
      <Note>继续研究 · 存在本机</Note>
      {qs.length > 0 && <div className="wg-read"><span>疑问本里还有 {qs.filter((q) => !q.solved).length} 条未勾掉。能用天文或算术解决的，先算；算不了的再留在这里。</span></div>}
      <div className="wg-row">
        <input value={text} placeholder="一个还没解决的问题" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <button className="wg-btn on" onClick={add}>记下</button>
      </div>
      {list.length === 0 && <div className="wg-cap">清单还是空的。写下真正卡住你的那一句。</div>}
      {list.map((t, i) => (
        <div key={i} className="wg-row">
          <span className="wg-v" style={{ flex: 1, textAlign: 'left' }}>{t}</span>
          <button className="wg-btn" onClick={() => setNote(id, JSON.stringify(list.filter((_, k) => k !== i)))}>去掉</button>
        </div>
      ))}
    </div>
  )
}

type Oral = { q: string; a: string; ex: string; from: string; stage: number }

function readBank(): Oral[] {
  const lessons = Array.isArray(LESSONS) ? LESSONS : []
  const qas = Array.isArray(QA_ALL) ? QA_ALL : []
  const out: Oral[] = []
  for (const l of lessons) {
    for (const q of l.quiz ?? []) {
      if (q.t !== 'choice') continue
      out.push({ q: q.q, a: q.opts[q.a] ?? '', ex: q.ex, from: `第 ${l.day} 天 · ${l.title}`, stage: l.stage })
    }
  }
  for (const qa of qas) out.push({ q: qa.q, a: qa.a, ex: qa.tag ? `标签：${qa.tag}` : '', from: `问答 · 第 ${qa.day} 天`, stage: qa.day ? (STAGES.find((s) => qa.day >= s.from && qa.day <= s.to)?.n ?? 0) : 0 })
  return out
}
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice()
  let s = seed % 2147483646 || 1
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function drawOral(n: number, seed: number): Oral[] {
  const bank = readBank()
  if (!bank.length || n < 1) return []
  const by = new Map<number, Oral[]>()
  for (const it of bank) {
    if (!it.stage) continue
    const g = by.get(it.stage) ?? []
    g.push(it)
    by.set(it.stage, g)
  }
  const picked: Oral[] = []
  const used = new Set<Oral>()
  if (n >= by.size) {
    for (const g of by.values()) {
      const one = shuffle(g, seed + picked.length + 1)[0]
      picked.push(one)
      used.add(one)
    }
  }
  for (const it of shuffle(bank, seed + 9)) {
    if (picked.length >= n) break
    if (used.has(it)) continue
    picked.push(it)
  }
  return shuffle(picked, seed + 17).slice(0, Math.min(n, picked.length))
}

/* ── 口试：从已写好的课里抽题，说完再揭晓 ── */
function Defense({ n }: { n: number }) {
  const [seed] = useState(() => (Date.now() % 2147483646) + 1)
  const items = useMemo(() => drawOral(Math.max(1, Math.round(n) || 10), seed), [n, seed])
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(false)
  const [marks, setMarks] = useState<boolean[]>([])
  if (!items.length) return <div className="wg"><div className="wg-cap">题库还是空的。等课程装载完，再打开这一屏。</div></div>
  const cur = items[Math.min(i, items.length - 1)]
  const done = marks.length >= items.length
  const hit = marks.filter(Boolean).length
  const mark = (ok: boolean) => {
    setMarks((m) => [...m, ok])
    setOpen(false)
    setI((x) => x + 1)
  }
  return (
    <div className="wg">
      <Note>口试 {Math.min(marks.length + (done ? 0 : 1), items.length)} / {items.length} · 说对 {hit}</Note>
      {done ? (
        <div className="wg-cap">这轮 {hit} / {items.length}。错的那些，记下是哪一天的课，回头只补那一课。</div>
      ) : (
        <>
          <div className="wg-cap" style={{ textAlign: 'left', fontSize: 15 }}>{cur.q}</div>
          <div className="wg-read"><span>{cur.from}。先大声说答案，再揭晓。</span></div>
          {!open && <button className="wg-btn on" onClick={() => setOpen(true)}>我说完了，看答案</button>}
          {open && (
            <>
              <div className="wg-read"><span>答案：{cur.a}{cur.ex ? `。${cur.ex}` : ''}</span></div>
              <div className="wg-btns">
                <button className="wg-btn" onClick={() => mark(true)}>✓ 说对了</button>
                <button className="wg-btn" onClick={() => mark(false)}>✗ 没说对</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ── 700 颗星：一天一颗，完成的才亮 ── */
function StarField({ cert }: { cert?: boolean }) {
  const completed = useStore().completed
  const notes = useStore().notes
  const calm = reduceMotion()
  const lit = (d: number) => Boolean(completed[d])
  const cols = 25
  let y = 4
  const labels: { n: number; name: string; y: number; days: number; on: number }[] = []
  const nodes: { d: number; x: number; y: number; on: boolean }[] = []
  for (const s of STAGES) {
    const days = s.to - s.from + 1
    let on = 0
    for (let i = 0; i < days; i++) if (lit(s.from + i)) on++
    labels.push({ n: s.n, name: s.name, y: y + 11, days, on })
    for (let i = 0; i < days; i++) {
      nodes.push({
        d: s.from + i,
        x: 8 + (i % cols) * 13.2,
        y: y + 24 + Math.floor(i / cols) * 12,
        on: lit(s.from + i),
      })
    }
    y += 26 + Math.ceil(days / cols) * 12
  }
  const done = nodes.filter((n) => n.on).length
  const y0 = y + 8
  const h = y0 + (cert ? 132 : 4)
  const line = (key: string, fallback: string) => {
    const t = (notes[key] ?? '').replace(/\s+/g, ' ').trim()
    return t ? t.slice(0, 42) : fallback
  }
  return (
    <div className="wg">
      <svg className="wg-svg" viewBox={`0 0 340 ${h}`} role="img" aria-label="知识星网">
        {labels.map((l) => (
          <text key={l.n} x={8} y={l.y} fontSize={10} fill={DIM}>{l.n} {l.name} · {l.on}/{l.days}</text>
        ))}
        {nodes.map((n) => (
          <circle key={n.d} cx={n.x} cy={n.y} r={n.on ? 3.1 : 1.6} fill={n.on ? '#f6f1e4' : 'rgba(246,241,228,0.16)'}
            style={n.on && !calm ? { animation: `g-star .7s ease ${(n.d - 1) * 0.01}s both` } : undefined} />
        ))}
        {cert && (
          <g>
            <rect x={24} y={y0} width={292} height={118} rx={10} fill="rgba(20,16,8,0.35)" stroke={GOLD} />
            <text x={40} y={y0 + 22} fontSize={13} fill={GOLD}>星学堂 · 毕业备忘</text>
            <text x={40} y={y0 + 44} fontSize={11} fill="#f6f1e4">五讲：{line('d700-lectures', '（这一格还空着）')}</text>
            <text x={40} y={y0 + 62} fontSize={11} fill="#f6f1e4">报告：{line('d700-report', '（这一格还空着）')}</text>
            <text x={40} y={y0 + 80} fontSize={11} fill="#f6f1e4">日记：{line('d700-stats', '（这一格还空着）')}</text>
            <text x={40} y={y0 + 102} fontSize={11} fill={DIM}>点亮 {done} / {nodes.length}</text>
            <circle cx={276} cy={y0 + 70} r={32} fill="none" stroke={GOLD} strokeWidth={2} />
            <circle cx={276} cy={y0 + 70} r={26} fill="none" stroke={GOLD} strokeWidth={1} />
            <text x={276} y={y0 + 74} fontSize={12} fill={GOLD} textAnchor="middle">{done === nodes.length && nodes.length === 700 ? '毕业' : `${done}`}</text>
          </g>
        )}
      </svg>
      <style>{'@keyframes g-star{from{opacity:0}to{opacity:1}}'}</style>
      <div className="wg-cap">已点亮 {done} / {nodes.length}。一颗星是一天，按 17 个阶段分行。{calm ? '你开了减少动态，星星直接显示。' : '完成了的星会慢慢亮起来。'}</div>
    </div>
  )
}

function zrAt(start: number, ageYears: number, fortune: number) {
  const t = ageYears * 360
  const ps = zodiacalReleasing(start, t + 1, 2, 360, fortune)
  const pick = (lv: number) => ps.find((p) => p.level === lv && p.start <= t && p.end > t)
  return { l1: pick(1), l2: pick(2) }
}
function zrText(p?: { sign: number; peak?: number; lb?: boolean }) {
  if (!p) return '—'
  return signName(p.sign) + (p.peak ? `（相对福点第 ${p.peak} 宫，巅峰）` : '') + (p.lb ? '，松绑' : '')
}

/* ── 某日的小限、释放、法达；回归和行运按按钮再算 ── */
function YearView({ src, onDate, lock, ids }: { src: string; onDate: string; lock?: boolean; ids?: string[] }) {
  const [id, setId] = useState(src)
  const [date, setDate] = useState(onDate)
  const { chart, birth } = useChartOf(id)
  const [busy, setBusy] = useState(false)
  const [sky, setSky] = useState<{ y: number; sr: Chart | null; hits: string[] } | null>(null)
  const [skyErr, setSkyErr] = useState('')
  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const run = async () => {
    if (!chart || !okDate) return
    setBusy(true); setSkyErr(''); setSky(null)
    try {
      const t = utcNoon(date)
      const y = t.getTime() < Date.UTC(t.getUTCFullYear(), chart.ut.getUTCMonth(), chart.ut.getUTCDate()) ? t.getUTCFullYear() - 1 : t.getUTCFullYear()
      const sr = await solarReturn(chart, y)
      const age = ageAt(chart.ut, t)
      const lord = profection(signIdx(chart.asc), age).lord
      const ann = new Date(Date.UTC(y, chart.ut.getUTCMonth(), chart.ut.getUTCDate()))
      const hits = await transitList(chart, ann, new Date(ann.getTime() + 370 * 86400000), ['jupiter', 'saturn'], [lord, 'asc', 'mc'])
      const lines = hits.slice(0, 8).map((h) => `${fmtDate(h.t)} ${BODY_NAME[h.body]}${h.aspect === 0 ? '合' : h.aspect === 60 ? '六分' : h.aspect === 90 ? '四分' : h.aspect === 120 ? '三分' : '对分'}${h.target === 'asc' ? '上升' : h.target === 'mc' ? '天顶' : BODY_NAME[h.target as Body]}`)
      setSky({ y, sr, hits: lines })
    } catch {
      setSkyErr('这一步没有算完。可以再按一次。')
    } finally { setBusy(false) }
  }
  return (
    <div className="wg">
      {!lock && <CasePicker value={id} onChange={(v) => { setId(v); setSky(null) }} ids={ids} />}
      <div className="wg-row"><label>日期</label><input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSky(null) }} /></div>
      {id === 'me' && !birth && <MyBirthForm />}
      {!chart && birth && <div className="wg-cap">计算中…</div>}
      {!birth && <div className="wg-cap">{id === 'me' ? '先保存出生日期。不知道钟点就先填 12:00，宫位先不要用。' : '没有这张盘。'}</div>}
      {chart && okDate && <YearTable c={chart} date={date} />}
      {chart && okDate && <button className="wg-btn on" onClick={run} disabled={busy}>{busy ? '计算中…' : '计算太阳回归和木土行运'}</button>}
      {skyErr && <div className="wg-cap">{skyErr}</div>}
      {sky && (
        <div className="wg-read">
          <span>
            {sky.y} 年太阳回归（出生地）{sky.sr ? `：世界时 ${fmtDate(sky.sr.ut)}，上升 ${SIGNS[signIdx(sky.sr.asc) - 1].name} ${fmtDegOnly(sky.sr.asc)}` : '没有找到'}。
            回归年从生日算，不从元旦算。木星、土星在这一小限年里碰到年主星或四轴：{sky.hits.length ? sky.hits.join('；') : '这张表里没有（只查了合、六分、四分、三分、对分）'}。
            行运是天象；它「意味着什么」是传统。
          </span>
        </div>
      )}
      <div className="wg-cap">算法结果不是事件证据。先写可核对的句子，再看对不对。</div>
    </div>
  )
}
function fmtDegOnly(lon: number) {
  const d = ((lon % 360) + 360) % 360 % 30
  return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′`
}
function YearTable({ c, date }: { c: Chart; date: string }) {
  const t = utcNoon(date)
  const age = ageAt(c.ut, t)
  const pr = profection(signIdx(c.asc), age)
  const fd = age >= 75 ? null : firdaria(c.isDay).find((p) => age >= p.from && age < p.to)
  const sub = fd?.subs?.find((p) => age >= p.from && age < p.to)
  const fSign = signIdx(c.fortune)
  const zf = zrAt(fSign, age, fSign)
  const zs = zrAt(signIdx(c.spirit), age, fSign)
  const yLord = PLANET[pr.lord].name
  return (
    <table className="wg-table">
      <tbody>
        <tr><th>年龄</th><td>{age.toFixed(2)} 岁 · {c.isDay ? '日生盘' : '夜生盘'}</td></tr>
        <tr><th>小限</th><td>{signName(pr.sign)} · 第 {pr.house} 宫 · 年主星 {yLord}</td></tr>
        <tr><th>宫题（传统）</th><td>{HOUSE_TOPICS[pr.house - 1]}</td></tr>
        <tr><th>法达</th><td>{fd ? `${lordName(fd.lord)}大运 ${fd.from.toFixed(0)}–${fd.to.toFixed(0)} 岁${sub ? `，子运 ${lordName(sub.lord)}` : ''}` : '75 年的表已经走完，本课不外推第二轮'}</td></tr>
        <tr><th>福点释放</th><td>L1 {zrText(zf.l1)}；L2 {zrText(zf.l2)}</td></tr>
        <tr><th>精神点释放</th><td>L1 {zrText(zs.l1)}；L2 {zrText(zs.l2)}</td></tr>
      </tbody>
    </table>
  )
}

export const W17: WidgetMap = {
  gRubric: (a) => <Rubric id={typeof a.id === 'string' && a.id ? a.id : 'g-rubric'} />,
  gDefense: (a) => <Defense n={typeof a.n === 'number' ? a.n : 10} />,
  gStarField: (a) => <StarField cert={a.cert === true} />,
  gLecturePlan: (a) => <LecturePlan id={typeof a.id === 'string' && a.id ? a.id : 'g-lecture'} />,
  gYear: (a) => <YearView src={typeof a.src === 'string' ? a.src : 'einstein'} onDate={typeof a.on === 'string' ? a.on : '1905-06-30'} lock={a.lock === true} ids={Array.isArray(a.ids) ? a.ids as string[] : undefined} />,
  gResearch: (a) => <Research id={typeof a.id === 'string' && a.id ? a.id : 'g-research'} />,
}
