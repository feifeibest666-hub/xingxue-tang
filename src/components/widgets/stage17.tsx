import { useEffect, useMemo, useState } from 'react'
import { Btns, Note, reduceMotion, type WidgetMap } from './common'
import { setNote, useStore } from '../../lib/store'
import { STAGES } from '../../data/outline'
import { CASES, caseById } from '../../data/cases'
import { HOUSE_TOPICS, PLANET, dignityOf, type Planet } from '../../data/classical'
import { SIGNS, fmtLon, norm360 } from '../../data/zodiac'
import { BODY_NAME, chartAt, computeChart, signIdx, signRuler, wholeHouse, type Body, type Chart } from '../../lib/natal'
import { FLORD_NAME, ageAt, firdaria, fmtDate, monthlyProfection, profection, solarReturn, transitList, zodiacalReleasing, type FLord } from '../../lib/timing'
import { seasons } from '../../lib/astro'
import { CasePicker, MyBirthForm, NeedMine, useChartOf } from './natal'
import { moonNext } from './stage12'

const GOLD = '#c2a05a'
const DIM = 'rgba(246,241,228,0.55)'
const str = (v: unknown, d = '') => (typeof v === 'string' && v ? v : d)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const on = (v: unknown) => v === true
const signName = (i: number) => SIGNS[((i - 1) % 12 + 12) % 12]?.name ?? ''
const utcNoon = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
}
const ASP: Record<number, string> = { 0: '合', 60: '六分', 90: '四分', 120: '三分', 180: '对分' }
const ANGULAR = new Set([1, 4, 7, 10])

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

/* ── 一年五技术：小限、释放、法达、行运、回归 ── */
function YearWidget({ src = 'einstein', onDate = '1905-06-30', lock = false, prospective = false, month = false, ids, aa = false }: {
  src?: string; onDate?: string; lock?: boolean; prospective?: boolean; month?: boolean; ids?: string[]; aa?: boolean
}) {
  const allowed = (ids?.length ? ids : CASES.map((c) => c.id)).filter((id) => !aa || caseById(id)?.rating === 'AA')
  const [id, setId] = useState(src)
  const [date, setDate] = useState(onDate)
  const [showBio, setShowBio] = useState(false)
  const { chart, birth } = useChartOf(id)
  const k = id === 'me' ? undefined : caseById(id)
  const [extra, setExtra] = useState<{ sr: Chart | null; hits: { t: Date; body: Body; target: string; aspect: number }[] } | null>(null)

  useEffect(() => { setShowBio(false) }, [id, date])
  useEffect(() => {
    if (prospective || id === 'me') return
    const person = caseById(id)
    if (person && !person.events.some((e) => e.date === date)) setDate(person.events[0].date)
  }, [id, prospective, date])
  useEffect(() => {
    if (!prospective || !birth) return
    const now = new Date()
    const [, m, d] = birth.date.split('-').map(Number)
    let y = now.getFullYear()
    if (new Date(y, m - 1, d) <= now) y += 1
    setDate(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }, [prospective, birth])

  useEffect(() => {
    if (!chart || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setExtra(null); return }
    let ok = true
    setExtra(null)
    const t = utcNoon(date)
    const y = t.getUTCFullYear()
    ;(async () => {
      let sr = await solarReturn(chart, y, chart.lat, chart.lon)
      if (sr && sr.ut.getTime() > t.getTime()) sr = await solarReturn(chart, y - 1, chart.lat, chart.lon)
      const hits = await transitList(chart, new Date(t.getTime() - 180 * 86400000), new Date(t.getTime() + 180 * 86400000), ['jupiter', 'saturn'], ['sun', 'moon', 'asc', 'mc'])
      if (!ok) return
      setExtra({
        sr,
        hits: hits.slice(0, 6).map((h) => ({ t: h.t, body: h.body, target: h.target === 'asc' ? '上升' : h.target === 'mc' ? '天顶' : BODY_NAME[h.target], aspect: h.aspect })),
      })
    })().catch(() => { if (ok) setExtra({ sr: null, hits: [] }) })
    return () => { ok = false }
  }, [chart, date])

  if (id === 'me' && !birth) {
    return <div className="wg"><Note>前瞻 · 用你自己的盘</Note><NeedMine /><MyBirthForm /></div>
  }
  if (!chart) return <div className="wg"><div className="wg-cap">计算中…</div></div>

  const t = utcNoon(date)
  const age = ageAt(chart.ut, t)
  const asc = signIdx(chart.asc)
  const pf = profection(asc, age)
  const mp = monthlyProfection(asc, age)
  const fd = firdaria(chart.isDay)
  const major = fd.find((p) => age >= p.from && age < p.to)
  const sub = major?.subs?.find((s) => age >= s.from && age < s.to)
  const fo = signIdx(chart.fortune)
  const sp = zrAt(signIdx(chart.spirit), age, fo)
  const fp = zrAt(fo, age, fo)
  const events = (k?.events ?? []).filter((e) => e.date.slice(0, 4) === date.slice(0, 4))
  const lord = (p: Planet) => PLANET[p].name

  return (
    <div className="wg">
      <Note>{prospective ? '前瞻：先写，到期再打分' : '回溯：先抄五栏，再对照传记'} · {chart.isDay ? '日生盘' : '夜生盘'}</Note>
      {!lock && (
        <div className="wg-btns" style={{ marginTop: 0 }}>
          <CasePicker value={id} onChange={setId} ids={allowed} allowMe={prospective} />
        </div>
      )}
      {!lock && k && (
        <div className="wg-row">
          <label>年份</label>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {k.events.map((e) => <option key={e.date} value={e.date}>{e.date.slice(0, 7)}</option>)}
          </select>
        </div>
      )}
      <div className="wg-cap" style={{ textAlign: 'left' }}>{k ? k.name : '我的盘'} · {date} · {age.toFixed(1)} 岁</div>
      <table className="wg-table"><tbody>
        <tr><th>小限</th><td>{signName(pf.sign)} · 第 {pf.house} 宫 · 年主{lord(pf.lord)}</td></tr>
        <tr><th>月小限</th><td>第 {mp.month} 个月 · {signName(mp.sign)} · 月主{lord(mp.lord)}{month ? ' ← 今天重点看这一行' : ''}</td></tr>
        <tr><th>法达</th><td>{major ? `${FLORD_NAME[major.lord as FLord]} / ${sub ? FLORD_NAME[sub.lord as FLord] : '（交点无子期）'}` : '已超出 75 年的常用周期'}</td></tr>
        <tr><th>释放·精神</th><td>L1 {zrText(sp.l1)}；L2 {zrText(sp.l2)}</td></tr>
        <tr><th>释放·福点</th><td>L1 {zrText(fp.l1)}；L2 {zrText(fp.l2)}</td></tr>
        <tr><th>回归</th><td>{extra?.sr ? `${fmtDate(extra.sr.ut)} 上升 ${fmtLon(extra.sr.asc)}（${extra.sr.isDay ? '日' : '夜'}盘，出生地）` : '计算中…'}</td></tr>
      </tbody></table>
      <div className="wg-read"><span>第 {pf.house} 宫的古典主题：{HOUSE_TOPICS[pf.house - 1]}。这是传统分类，不是事件清单。本课不判断疾病、寿命和死亡。</span></div>
      <div className="wg-read"><span>回归盘用出生地。改用「当年所在地」是另一派约定，这里不混用。</span></div>
      <div className="wg-cap" style={{ textAlign: 'left' }}>行运 · 木星和土星，这一天前后各半年，对日、月、上升、天顶的精确过点</div>
      {!extra && <div className="wg-cap">计算中…</div>}
      {extra && (extra.hits.length
        ? <div className="wg-read">{extra.hits.map((h, i) => <span key={i}>{fmtDate(h.t)} {BODY_NAME[h.body]}{ASP[h.aspect] ?? h.aspect}{h.target}</span>)}<span>半年里就能列出好几条。见到一条，不算「应验」。</span></div>
        : <div className="wg-read"><span>这半年里，木星和土星没有精确合、刑、冲到日、月、上升或天顶。没有过点，本身也是一个结果。</span></div>)}
      {!prospective && (
        <div className="wg-btns">
          <button className="wg-btn" onClick={() => setShowBio(true)} disabled={showBio}>对照传记（先写完再点）</button>
        </div>
      )}
      {showBio && <div className="wg-read">{events.length ? events.map((e) => <span key={e.date}>{e.date} {e.what}（{e.kind}）</span>) : <span>这一年在案例库里没有单独列出的事件。</span>}<span style={{ color: DIM }}>这是事后对照，不是预测成功的证据。</span></div>}
    </div>
  )
}

/* ── 择日评分：一次只评一个时刻。扫描一段日子的 eScan 不在这里。 ── */
function ElectWidget() {
  const st = useStore()
  const { lat, lon, place } = st.settings
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    setC(null)
    chartAt(new Date(when), lat, lon).then((x) => ok && setC(x)).catch(() => ok && setC(null))
    return () => { ok = false }
  }, [when, lat, lon])
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const phase = norm360(c.pos.moon.lon - c.pos.sun.lon)
  const waxing = phase > 0 && phase < 180
  const lord = signRuler(signIdx(c.asc))
  const dig = dignityOf(lord, c.pos[lord].lon, c.isDay)
  const dignified = dig.some((d) => d.score > 0)
  const maleficAng = (['mars', 'saturn'] as const).filter((p) => ANGULAR.has(wholeHouse(c.pos[p].lon, c.asc)))
  const checks: [boolean, string][] = [
    [waxing, waxing ? '月亮增光（从新月走向满月）' : '月亮减光'],
    [Boolean(moonNext(c).best), moonNext(c).best ? '月亮离开本星座前还有相位' : '月亮空亡'],
    [dignified, dignified ? `上升主${PLANET[lord].name}有正分尊贵（${dig.map((d) => d.name).join('、') || '无'}）` : `上升主${PLANET[lord].name}没有正分尊贵`],
    [maleficAng.length === 0, maleficAng.length ? `凶星在角宫：${maleficAng.map((p) => PLANET[p].name).join('、')}` : '火星、土星都不在 1/4/7/10 宫'],
  ]
  const score = checks.filter((x) => x[0]).length
  return (
    <div className="wg">
      <Note>手评一个时刻 · {place} · 不是 eScan</Note>
      <div className="wg-row"><label>候选时刻</label><input type="datetime-local" value={when} onChange={(e) => e.target.value && setWhen(e.target.value)} /></div>
      <div className="wg-cap" style={{ textAlign: 'left' }}>上升 {fmtLon(c.asc)} · 月亮 {fmtLon(c.pos.moon.lon)} · 水星{c.pos.mercury.retro ? '逆行' : '顺行'}</div>
      <div className="wg-read">{checks.map(([ok, t]) => <span key={t} style={{ color: ok ? '#8fbf9a' : '#e88a72' }}>{ok ? '通过' : '不过'} · {t}</span>)}</div>
      <div className="wg-cap">四条里过了 {score} 条。水星逆行没有写进这四条：古典文献没有这条硬禁忌，现代才常避。</div>
      <div className="wg-read"><span>eScan 若已装上，用它扫描一段日子；这里只给一个时刻打分，方便你看清每一条在查什么。</span></div>
    </div>
  )
}

/* ── 盲校：先猜日夜和上升星座，再揭晓 ── */
function BlindWidget({ src = 'hemingway' }: { src?: string }) {
  const k = caseById(src)
  const [sect, setSect] = useState<'day' | 'night' | ''>('')
  const [sign, setSign] = useState(0)
  const [c, setC] = useState<Chart | null>(null)
  if (!k) return <div className="wg"><div className="wg-cap">找不到这张盘。</div></div>
  const reveal = () => { if (sect && sign) computeChart(k.birth).then(setC) }
  const ascSign = c ? signIdx(c.asc) : 0
  return (
    <div className="wg">
      <Note>盲校 · 时刻先藏着 · 评级 {k.rating}</Note>
      <div className="wg-cap" style={{ textAlign: 'left' }}>{k.name} · {k.role}</div>
      <div className="wg-read">{k.bio.map((b) => <span key={b}>{b}</span>)}</div>
      <table className="wg-table"><tbody>
        {k.events.map((e) => <tr key={e.date}><th>{e.date}</th><td>{e.what}</td></tr>)}
      </tbody></table>
      {!c && <>
        <div className="wg-cap" style={{ textAlign: 'left' }}>先写下来，再揭晓。不要去翻前面的课。</div>
        <div className="wg-btns">
          <button className={`wg-btn ${sect === 'day' ? 'on' : ''}`} onClick={() => setSect('day')}>我猜日生</button>
          <button className={`wg-btn ${sect === 'night' ? 'on' : ''}`} onClick={() => setSect('night')}>我猜夜生</button>
        </div>
        <div className="wg-row">
          <label>上升星座</label>
          <select value={sign} onChange={(e) => setSign(Number(e.target.value))}>
            <option value={0}>先选</option>
            {SIGNS.map((s) => <option key={s.i} value={s.i}>{s.name}</option>)}
          </select>
        </div>
        <div className="wg-btns"><button className="wg-btn on" disabled={!sect || !sign} onClick={reveal}>揭晓</button></div>
      </>}
      {c && <div className="wg-read">
        <span>实际：{c.isDay ? '日生' : '夜生'}盘，上升 {fmtLon(c.asc)}。钟点是 {k.birth.time}（{k.clock}），{k.birth.place}。</span>
        <span>你猜的日夜{((sect === 'day') === c.isDay) ? '一致' : '不一致'}；上升星座{sign === ascSign ? '一致' : `不一致（你选了${signName(sign)}）`}。</span>
        <span>差一个星座，通常是几小时，不是几分钟。这只说明猜测碰到了哪一层，不能说明校正「成功了」。</span>
      </div>}
    </div>
  )
}

/* ── 下一次春分入境盘 ── */
function IngressWidget() {
  const { lat, lon, place } = useStore().settings
  const [pack, setPack] = useState<{ y: number; when: Date; c: Chart } | null>(null)
  useEffect(() => {
    let ok = true
    setPack(null)
    ;(async () => {
      const now = new Date()
      let y = now.getUTCFullYear()
      let list = await seasons(y)
      if (list[0].date.getTime() <= now.getTime()) { y += 1; list = await seasons(y) }
      const c = await chartAt(list[0].date, lat, lon)
      if (ok) setPack({ y, when: list[0].date, c })
    })().catch(() => { /* 星历失败时保持「计算中」不再抛 */ })
    return () => { ok = false }
  }, [lat, lon])
  if (!pack) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const { y, when, c } = pack
  const row = (b: 'sun' | 'moon' | 'jupiter' | 'saturn') => `${BODY_NAME[b]} ${fmtLon(c.pos[b].lon)} · 第 ${wholeHouse(c.pos[b].lon, c.asc)} 宫`
  return (
    <div className="wg">
      <Note>{y} 年春分入境 · {place}</Note>
      <div className="wg-cap" style={{ textAlign: 'left' }}>{when.toISOString().slice(0, 16).replace('T', ' ')} UTC · 太阳黄经回到 0°</div>
      <table className="wg-table"><tbody>
        <tr><th>上升</th><td>{fmtLon(c.asc)} · {c.isDay ? '日' : '夜'}盘</td></tr>
        <tr><th>天顶</th><td>{fmtLon(c.mc)}</td></tr>
        <tr><th>日</th><td>{row('sun')}</td></tr>
        <tr><th>月</th><td>{row('moon')}</td></tr>
        <tr><th>木</th><td>{row('jupiter')}</td></tr>
        <tr><th>土</th><td>{row('saturn')}</td></tr>
      </tbody></table>
      <div className="wg-read"><span>这是{place}的天空，不是全世界共用的一张盘。传统用它谈一年的公共主题。它不能指定某一次灾难，也不该拿来吓人。</span></div>
    </div>
  )
}

const RUBRIC: [string, string][] = [
  ['依据', '每个结论都说出来源'],
  ['分层', '标出事实、推导、传统、约定、争议'],
  ['不跳步', '推导链完整'],
  ['类比', '至少一个恰当类比，并说出它在哪里不成立'],
  ['诚实', '不夸大预测力，提及证据状态'],
  ['清楚', '外行也能听懂主线'],
]

function RubricWidget({ id = 'draft' }: { id?: string }) {
  const key = `g-rubric-${id}`
  const notes = useStore().notes[key]
  const saved = useMemo(() => {
    try {
      const v = JSON.parse(notes ?? '')
      if (Array.isArray(v) && v.length === 6) return v.map((n) => (n === 1 || n === 2 || n === 3 ? n : 0))
    } catch { /* 空笔记 */ }
    return [0, 0, 0, 0, 0, 0]
  }, [notes])
  const set = (i: number, n: number) => {
    const next = [...saved]
    next[i] = n
    setNote(key, JSON.stringify(next))
  }
  const total = saved.reduce((a, b) => a + b, 0)
  const scored = saved.map((v, i) => ({ v, i })).filter((x) => x.v > 0)
  const min = scored.length ? Math.min(...scored.map((x) => x.v)) : 0
  const weak = scored.filter((x) => x.v === min).map((x) => RUBRIC[x.i][0])
  return (
    <div className="wg">
      <Note>毕业评分表 · {id}</Note>
      {RUBRIC.map(([name, std], i) => (
        <div key={name} className="wg-row" style={{ alignItems: 'center' }}>
          <span style={{ flex: 1 }}><b style={{ color: GOLD }}>{name}</b> · {std}</span>
          <Btns items={[[1, '1星'], [2, '2星'], [3, '3星']]} value={saved[i] || 0} onChange={(v) => set(i, v)} />
        </div>
      ))}
      <div className="wg-cap">合计 {total} / 18。{scored.length ? `最弱：${weak.join('、')}（${min} 星）` : '还没打分。'}</div>
      <div className="wg-read"><span>录音在手机自带的录音机里。这里只记你自己打的分，存在本机。</span></div>
    </div>
  )
}

const SLOTS = ['钩子', '观察', '推导', '约定', '类比', '检验'] as const

function LecturePlanWidget({ id = 'draft' }: { id?: string }) {
  const key = `g-lecture-${id}`
  const saved = useStore().notes[key]
  const init = useMemo(() => {
    try {
      const v = JSON.parse(saved ?? '{}') as Record<string, string>
      return Object.fromEntries(SLOTS.map((s) => [s, typeof v[s] === 'string' ? v[s] : ''])) as Record<(typeof SLOTS)[number], string>
    } catch { return Object.fromEntries(SLOTS.map((s) => [s, ''])) as Record<(typeof SLOTS)[number], string> }
  }, [saved])
  const [text, setText] = useState(init)
  useEffect(() => { setText(init) }, [init])
  return (
    <div className="wg">
      <Note>15 分钟提纲 · {id}</Note>
      {SLOTS.map((s) => (
        <div key={s} style={{ marginTop: 8 }}>
          <div className="wg-cap" style={{ textAlign: 'left', margin: '4px 0' }}>{s}</div>
          <textarea value={text[s]} onChange={(e) => setText({ ...text, [s]: e.target.value })} placeholder={s === '类比' ? '写明它在哪里不成立' : ''} />
        </div>
      ))}
      <div className="wg-btns"><button className="wg-btn on" onClick={() => setNote(key, JSON.stringify(text))}>保存提纲</button></div>
    </div>
  )
}

type Drill = { kind: string; q: string; a: string; ex: string; from: string }

function DefenseWidget({ n = 10 }: { n?: number }) {
  const [items, setItems] = useState<Drill[]>([])
  const [ready, setReady] = useState(false)
  const [draw, setDraw] = useState(0)
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)
  const [round, setRound] = useState<(boolean | null)[]>([])
  const [sum, setSum] = useState({ ok: 0, n: 0 })

  useEffect(() => {
    let alive = true
    setReady(false)
    void import('../../data/curriculum').then((m) => {
      if (!alive) return
      const lessons = Array.isArray(m.LESSONS) ? m.LESSONS : []
      const qa = Array.isArray(m.QA_ALL) ? m.QA_ALL : []
      const pool: Drill[] = []
      for (const l of lessons) {
        for (const q of l.quiz ?? []) {
          if (q.t === 'choice' && q.opts?.[q.a]) pool.push({ kind: '选择', q: q.q, a: q.opts[q.a], ex: q.ex || '', from: `第 ${l.day} 天 · ${l.title}` })
        }
      }
      for (const x of qa) {
        if (x?.q && x?.a) pool.push({ kind: '问答', q: x.q, a: x.a, ex: '', from: `第 ${x.day} 天` })
      }
      for (let k = pool.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1))
        ;[pool[k], pool[j]] = [pool[j], pool[k]]
      }
      const take = pool.slice(0, Math.max(0, n))
      setItems(take)
      setI(0)
      setShow(false)
      setRound(take.map(() => null))
      setReady(true)
    }).catch(() => { if (alive) { setItems([]); setReady(true) } })
    return () => { alive = false }
  }, [draw, n])

  if (!ready) return <div className="wg"><div className="wg-cap">正在抽题…</div></div>
  if (!items.length) return <div className="wg"><div className="wg-cap">题库还是空的。等前面的课写进课程之后，再来抽。</div></div>
  const cur = items[i]
  const done = round.every((x) => x != null)
  const mark = (ok: boolean) => {
    if (round[i] != null) return
    const next = [...round]
    next[i] = ok
    setRound(next)
    setSum((s) => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))
  }
  return (
    <div className="wg">
      <Note>口试 · 先大声说，再看答案 · 累计 {sum.ok}/{sum.n}</Note>
      {!done && cur && <>
        <div className="wg-cap" style={{ textAlign: 'left' }}>{i + 1} / {items.length} · {cur.kind}</div>
        <div className="wg-read"><span>{cur.q}</span></div>
        {!show && <div className="wg-btns"><button className="wg-btn on" onClick={() => setShow(true)}>我说完了，看答案</button></div>}
        {show && <>
          <div className="wg-read"><span><b style={{ color: GOLD }}>答案。</b>{cur.a}</span>{cur.ex && <span>{cur.ex}</span>}<span style={{ color: DIM }}>{cur.from}</span></div>
          {round[i] == null
            ? <div className="wg-btns"><button className="wg-btn" onClick={() => mark(true)}>我说对了</button><button className="wg-btn" onClick={() => mark(false)}>我说错了</button></div>
            : <div className="wg-btns"><button className="wg-btn on" onClick={() => { setI(i + 1); setShow(false) }}>下一题</button></div>}
        </>}
      </>}
      {done && <>
        <div className="wg-cap">这一轮 {round.filter(Boolean).length} / {items.length}。累计 {sum.ok} / {sum.n}。</div>
        <div className="wg-btns"><button className="wg-btn on" onClick={() => setDraw(draw + 1)}>再抽一轮</button></div>
      </>}
    </div>
  )
}

const SHORT = ['天空', '行星', '尊贵', '相位', '宫位', '区分', '解盘', '现代', '时间', '时主', '校正', '卜卦', '择日', '世俗', '关系', '证据', '毕业']

function StarFieldWidget({ finale = false }: { finale?: boolean }) {
  const completed = useStore().completed
  const notes = useStore().notes
  const reduce = reduceMotion()
  const [run, setRun] = useState(0)
  const [litN, setLitN] = useState(finale && !reduce ? 0 : 700)
  const [settled, setSettled] = useState(!finale || reduce)

  useEffect(() => {
    if (!finale || reduce) { setLitN(700); setSettled(true); return }
    setSettled(false)
    setLitN(0)
    let i = 0
    const timer = window.setInterval(() => {
      i += 8
      if (i >= 700) { setLitN(700); setSettled(true); window.clearInterval(timer) }
      else setLitN(i)
    }, 50)
    return () => window.clearInterval(timer)
  }, [finale, reduce, run])

  const rows = STAGES.map((s, idx) => {
    const days = Array.from({ length: s.to - s.from + 1 }, (_, k) => s.from + k)
    return { s, idx, days }
  })
  const lit = (day: number) => {
    const done = Boolean(completed[day])
    if (!finale) return done
    if (!settled) return day <= litN
    return done
  }
  const lectures = [
    ['sky', '天空的几何'], ['dign', '行星与尊贵'], ['phase', '相位与宫位'], ['read', '读一张盘'], ['time', '时间技术与证据'],
  ].map(([id, title]) => {
    let hookText = ''
    let score = ''
    try { hookText = String((JSON.parse(notes[`g-lecture-${id}`] || '{}') as { 钩子?: string }).钩子 || '') } catch { /* 空 */ }
    try {
      const r = JSON.parse(notes[`g-rubric-${id}`] || 'null') as unknown
      if (Array.isArray(r)) score = `${r.reduce((a: number, b: number) => a + (Number(b) || 0), 0)}/18`
    } catch { /* 空 */ }
    return { title, hookText: hookText.replace(/\s+/g, ' ').slice(0, 36), score }
  })

  return (
    <div className="wg">
      <Note>{finale ? '700 天的星图' : '知识星网'} · 亮着的是已学完的一天</Note>
      <svg className="wg-svg" viewBox="0 0 340 430">
        {rows.map(({ s, idx, days }) => {
          const y = 18 + idx * 24
          const gap = 276 / Math.max(days.length, 1)
          return (
            <g key={s.n}>
              <text x={2} y={y + 3} fontSize="9" fill={DIM}>{s.n} {SHORT[idx] ?? ''}</text>
              {days.map((d, k) => {
                const gold = lit(d)
                return <circle key={d} cx={58 + k * gap} cy={y} r={gold ? 2.2 : 1.3} fill={gold ? GOLD : 'rgba(246,241,228,0.18)'} />
              })}
            </g>
          )
        })}
        {finale && settled && rows.slice(0, -1).map(({ days, idx }) => {
          const y1 = 18 + idx * 24
          const y2 = 18 + (idx + 1) * 24
          const x1 = 58 + ((days.length - 1) * 276) / Math.max(days.length, 1) / 2
          const next = rows[idx + 1]
          const x2 = 58 + ((next.days.length - 1) * 276) / Math.max(next.days.length, 1) / 2
          return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth="0.6" opacity="0.45" />
        })}
      </svg>
      {finale && <div className="wg-btns"><button className="wg-btn" onClick={() => setRun(run + 1)}>{reduce ? '系统要求减少动画，星图直接展开' : '再看一次点亮'}</button></div>}
      <div className="wg-read"><span>每一颗星是一天。停稳之后，只有学完的日子还亮着。没亮的一串，就是还没走完的阶段。</span></div>
      {finale && settled && (
        <div style={{ marginTop: 12, background: 'linear-gradient(#f6edd4, #e7d3a1)', color: '#3a2e1e', borderRadius: 12, padding: '16px 14px 18px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 12, top: 12 }}>
            <svg viewBox="0 0 80 80" width="64" height="64">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#8c1c1c" strokeWidth="3" />
              <circle cx="40" cy="40" r="27" fill="none" stroke="#8c1c1c" strokeWidth="1" />
              <text x="40" y="36" textAnchor="middle" fontSize="13" fill="#8c1c1c">星学堂</text>
              <text x="40" y="54" textAnchor="middle" fontSize="12" fill="#8c1c1c">毕业</text>
            </svg>
          </div>
          <div style={{ fontSize: 18, letterSpacing: 2 }}>毕业证书</div>
          <div style={{ fontSize: 13, margin: '8px 0 4px' }}>五讲录音（存在手机里）</div>
          {lectures.map((L) => <div key={L.title} style={{ fontSize: 12.5, lineHeight: 1.6 }}>{L.title}{L.score ? ` · ${L.score}` : ' · 尚未自评'}{L.hookText ? ` · ${L.hookText}` : ''}</div>)}
          <div style={{ fontSize: 13, marginTop: 8 }}>报告书：{notes['d684-lay'] ? '外行版摘要已写入' : '还没有外行版摘要'}</div>
          <div style={{ fontSize: 13 }}>预测日记：{notes['d687-rate'] ? notes['d687-rate'].slice(0, 80) : '还没有命中率统计'}</div>
        </div>
      )}
    </div>
  )
}

export const W17: WidgetMap = {
  gRubric: (a) => <RubricWidget id={str(a.id, 'draft')} />,
  gDefense: (a) => <DefenseWidget n={num(a.n, 10)} />,
  gStarField: (a) => <StarFieldWidget finale={on(a.finale)} />,
  gLecturePlan: (a) => <LecturePlanWidget id={str(a.id, 'draft')} />,
  gYear: (a) => (
    <YearWidget
      src={str(a.src, 'einstein')}
      onDate={str(a.on, '1905-06-30')}
      lock={on(a.lock)}
      prospective={on(a.prospective)}
      month={on(a.month)}
      ids={Array.isArray(a.ids) ? (a.ids as string[]) : undefined}
      aa={on(a.aa)}
    />
  ),
  gElect: () => <ElectWidget />,
  gBlind: (a) => <BlindWidget src={str(a.src, 'hemingway')} />,
  gIngress: () => <IngressWidget />,
}
