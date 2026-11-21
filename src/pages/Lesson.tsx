import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Lesson, Quiz, Screen } from '../data/types'
import { KIND_LABEL } from '../data/types'
import { cardIdsOf, isBuilt, lessonByDay, outlineByDay, stageOf } from '../data/curriculum'
import { COVER } from '../data/curriculum/build'
import { completeLesson, getState, recordQuiz, setNote, todayStr, toggleExplain, toggleTask, useStore } from '../lib/store'
import { Rich, inline } from '../components/Rich'
import { Widget } from '../components/widgets'
import { Starfield } from '../components/Starfield'
import { PatternSvg } from '../components/LearningMap'
import { StarShape } from '../components/Glyph'

const art = (n: string) => `${import.meta.env.BASE_URL}art/${n}.webp`
const STAR_D = 'M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z'

function shuffleIdx(n: number, seed: number) {
  let s = seed * 9301 + 49297
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  if (n > 1 && a.every((v, i) => v === i)) a.push(a.shift()!)
  return a
}

export function LessonRoute({ day }: { day: number }) {
  const lesson = lessonByDay(day)
  if (!lesson) return <ComingSoon day={day} />
  return <LessonPlayer key={day} lesson={lesson} />
}

// ───────────── 即将上线 ─────────────
const KIND_GOAL: Record<string, string> = {
  new: '本课的推导目标见下方阶段说明。',
  practice: '实践课：把这一阶段刚学的方法亲手用一遍——在真实星盘或天空模拟器上操作，写下你的推理过程，再对照参考答案。',
  case: '案例课：拿一张真实的星盘（名人盘或历史事件盘），用本阶段学到的方法一步步分析，并分清哪些判断来自几何、哪些来自传统约定。',
  review: '复盘课：把这一周的推导链重新排一遍，做混合题，并用自己的话讲给"我"听。',
}
function ComingSoon({ day }: { day: number }) {
  const ol = outlineByDay(day)
  if (!ol) return <div className="pad"><a className="back" href="#/course">‹</a><p className="empty">没有这一天。</p></div>
  const st = stageOf(day)
  return (
    <div className="coming">
      <div className="coming-hero">
        <Starfield />
        <a className="back floating close" href={`#/stage/${st.n}`} aria-label="关闭">×</a>
        <div style={{ position: 'relative' }}>
          <div className="ch-k">第 {day} 天 · 第 {st.n} 阶段 · {KIND_LABEL[ol.kind]}</div>
          <h1>{ol.title}</h1>
          <div className="serif" style={{ color: 'rgba(246,241,228,.7)' }}>{st.name} · {st.sub}</div>
        </div>
      </div>
      <div className="pad">
        <div className="soon" style={{ marginTop: 4 }}>
          <StarShape size={26} />
          <div className="serif" style={{ fontSize: 17, color: 'var(--ink)', margin: '6px 0 2px' }}>这一课正在制作中</div>
          课表和推导目标已经排好，内容会按阶段陆续补上。已经上线的课可以在「学程」里看到（没有"制作中"标记的阶段）。
        </div>
        <h3 className="section-title">这一课要推出什么</h3>
        <div className="card"><p className="serif" style={{ margin: 0, lineHeight: 1.85 }}>{ol.goal || KIND_GOAL[ol.kind]}</p></div>
        <h3 className="section-title">所在阶段的目标</h3>
        <div className="card"><p className="serif" style={{ margin: 0, lineHeight: 1.85 }}>{st.goal}</p></div>
        <div className="nav-btns">
          {day > 1 ? <a className="btn" href={`#/lesson/${day - 1}`}>‹ 第 {day - 1} 天</a> : <span />}
          {day < 700 ? <a className="btn" href={`#/lesson/${day + 1}`}>第 {day + 1} 天 ›</a> : <span />}
        </div>
        <a className="btn primary block" href="#/today">回到今日一课</a>
      </div>
    </div>
  )
}

// ───────────── 上课 ─────────────
type Phase = 'cover' | 'screens' | 'quiz' | 'result'

function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const st = useStore()
  const showYi = st.settings.showYi
  const screens = useMemo(() => lesson.screens.map((sc, i) => ({ sc, i })).filter((x) => showYi || x.sc.t !== 'yi'), [lesson, showYi])
  const [phase, setPhase] = useState<Phase>('cover')
  const [si, setSi] = useState(0)
  const [qi, setQi] = useState(0)
  const [revealed, setRevealed] = useState(1)
  const [results, setResults] = useState<(boolean | null)[]>(() => lesson.quiz.map(() => null))
  const [returnTo, setReturnTo] = useState<number | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const cur = screens[si]?.sc
  const deriveLen = cur?.t === 'derive' ? cur.steps.length + 1 : 0
  useEffect(() => { setRevealed(1) }, [si])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [si, qi, phase])

  const total = screens.length + lesson.quiz.length
  const done = phase === 'cover' ? 0 : phase === 'screens' ? si : phase === 'quiz' ? screens.length + qi : total
  const cover = lesson.cover ?? COVER[Math.min(5, Math.floor((lesson.day - 1) / 7))]
  const stage = stageOf(lesson.day)
  const exitHref = `#/stage/${stage.n}`

  const nextScreen = () => {
    if (cur?.t === 'derive' && revealed < deriveLen) { setRevealed(revealed + 1); return }
    if (si < screens.length - 1) setSi(si + 1)
    else if (lesson.quiz.length) { setPhase('quiz'); setQi(returnTo ?? 0); setReturnTo(null) }
    else finish()
  }
  const goBackTo = (orig: number | undefined) => {
    let k = orig != null ? screens.findIndex((x) => x.i === orig) : -1
    if (k < 0) k = Math.max(0, screens.findIndex((x) => x.sc.t === 'derive'))
    setReturnTo(qi); setSi(k); setPhase('screens')
  }
  const finish = () => {
    completeLesson(lesson.day, cardIdsOf(lesson))
    setPhase('result')
  }
  const answer = (ok: boolean | null) => {
    setResults((r) => { const c = [...r]; c[qi] = ok; return c })
    if (ok !== null) recordQuiz(lesson.day, qi, ok)
  }
  const nextQ = () => { if (qi < lesson.quiz.length - 1) setQi(qi + 1); else finish() }

  if (phase === 'cover') return (
    <div className="cover">
      <div className="cover-art-wrap">
        <motion.img className="cover-art" src={art(cover)} alt="" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.4 }} />
      </div>
      <a className="back floating close" href={exitHref} aria-label="关闭">×</a>
      <motion.div className="cover-body" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
        <div className="cover-day"><span className="cd-num">{lesson.day}</span><span>第 {lesson.day} 天 · {KIND_LABEL[lesson.kind]}<br />第 {stage.n} 阶段 · {stage.name}</span></div>
        <h1>{lesson.title}</h1>
        <div className="cover-q"><span className="gold small" style={{ letterSpacing: '.2em', display: 'block', color: 'var(--gold)' }}>本课问题</span>{lesson.question}</div>
        <div className="cover-meta"><span>约 {lesson.minutes ?? 20} 分钟</span><span>{screens.length} 屏讲解</span><span>{lesson.quiz.length} 道小题</span>{st.completed[lesson.day] && <span style={{ color: 'var(--gold)' }}>已学过 ✦</span>}</div>
        <button className="btn primary xl" onClick={() => { setPhase('screens'); setSi(0) }}>{st.completed[lesson.day] ? '再学一遍' : '开始上课'}</button>
        {st.completed[lesson.day] && <button className="btn ghost block" style={{ color: 'var(--star)', borderColor: 'rgba(246,241,228,.3)' }} onClick={() => setPhase('quiz')}>直接做题</button>}
      </motion.div>
    </div>
  )

  if (phase === 'result') return <Result lesson={lesson} results={results} onRedo={() => { setResults(lesson.quiz.map(() => null)); setQi(0); setPhase('quiz') }} />

  return (
    <div className="pad" ref={topRef}>
      <div className="lesson-head">
        <a className="back close" href={exitHref} aria-label="关闭">×</a>
        <div className="lh-mid"><div className="lh-day">第 {lesson.day} 天 · {phase === 'quiz' ? '小题' : '讲解'}</div><div className="lh-title">{lesson.title}</div></div>
        <span className="small muted" style={{ width: 38, textAlign: 'right' }}>{done + 1}/{total}</span>
      </div>
      <div className="progress"><i style={{ width: `${((done + (phase === 'quiz' && results[qi] !== null ? 1 : 0)) / total) * 100}%` }} /></div>

      <AnimatePresence mode="wait">
        {phase === 'screens' && cur && (
          <motion.div key={`s${si}`} className="screen" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28, ease: [0.22, 0.7, 0.3, 1] }}>
            <ScreenView sc={cur} lesson={lesson} revealed={revealed} onReveal={() => setRevealed(revealed + 1)} />
            {(cur.t === 'summary' || (si === screens.length - 1 && !screens.some((x) => x.sc.t === 'summary'))) && lesson.qa.length > 0 && <Faq lesson={lesson} />}
          </motion.div>
        )}
        {phase === 'quiz' && (
          <motion.div key={`q${qi}`} className="screen" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }}>
            <div className="quiz-n"><span>第 {qi + 1} / {lesson.quiz.length} 题</span><span>{QTYPE[lesson.quiz[qi].t]}</span></div>
            <QuizView q={lesson.quiz[qi]} day={lesson.day} idx={qi} onAnswer={answer} onBack={goBackTo} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="nav-btns">
        {phase === 'screens' ? (
          <>
            <button className="btn" disabled={si === 0} onClick={() => setSi(si - 1)}>‹ 上一屏</button>
            {returnTo != null ? (
              <button className="btn primary" onClick={() => { setPhase('quiz'); setQi(returnTo); setReturnTo(null) }}>回到第 {returnTo + 1} 题</button>
            ) : (
              <button className="btn primary" onClick={nextScreen}>
                {cur?.t === 'derive' && revealed < deriveLen ? `下一步 ${revealed}/${deriveLen}` : si < screens.length - 1 ? '下一屏 ›' : '去做小题 ›'}
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn" onClick={() => (qi > 0 ? setQi(qi - 1) : (setPhase('screens'), setSi(screens.length - 1)))}>‹ 上一步</button>
            <button className="btn primary" disabled={results[qi] === null && lesson.quiz[qi].t !== 'explain'} onClick={() => { if (lesson.quiz[qi].t === 'explain' && results[qi] === null) answer(null); nextQ() }}>
              {qi < lesson.quiz.length - 1 ? '下一题 ›' : '完成，看结果'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const QTYPE: Record<Quiz['t'], string> = { choice: '选择', sort: '分类', order: '排顺序', steps: '分步', calc: '算一算', explain: '讲给我听' }

function Faq({ lesson }: { lesson: Lesson }) {
  return (
    <div className="faq">
      <h3 className="section-title" style={{ marginTop: 18 }}>常见疑问 <small>点开看答案</small></h3>
      {lesson.qa.map((q, k) => (
        <details key={k}>
          <summary>{q.q}{q.tag && <span className={`tag tag-${q.tag}`} style={{ marginLeft: 'auto', height: 19, fontSize: 11 }}>{q.tag}</span>}</summary>
          <p>{inline(q.a)}</p>
        </details>
      ))}
    </div>
  )
}

// ───────────── 各种屏 ─────────────
function ScreenView({ sc, lesson, revealed, onReveal }: { sc: Screen; lesson: Lesson; revealed: number; onReveal: () => void }) {
  const s = useStore()
  switch (sc.t) {
    case 'hook':
      return (
        <div className="hook">
          <motion.div className="hook-mark" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 0.55 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>?</motion.div>
          <h2>{sc.q}</h2>
          {sc.body && <div className="rich"><Rich text={sc.body} /></div>}
        </div>
      )
    case 'text':
      return (<><div className="sc-head"><span className={`tag tag-${sc.tag}`}>{sc.tag}</span><h2>{sc.title}</h2></div><div className="rich"><Rich text={sc.body} /></div></>)
    case 'derive':
      return (
        <>
          <div className="sc-head"><span className="tag tag-推导">推导</span><h2>{sc.title}</h2></div>
          <div className="derive">
            <AnimatePresence initial={false}>
              {sc.steps.slice(0, revealed).map((st, k) => (
                <motion.div key={k} className="dv-step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                  <span className="dv-n">{k + 1}</span>
                  <div className="dv-body">{inline(st.s)}{st.tag && <span className={`tag tag-${st.tag}`}>{st.tag}</span>}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {revealed <= sc.steps.length
              ? <button className="dv-more" onClick={onReveal}>点一下，看下一步（{revealed}/{sc.steps.length}）</button>
              : <motion.div className="dv-result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>{inline(sc.result)}</motion.div>}
          </div>
        </>
      )
    case 'analogy':
      return (
        <>
          <div className="sc-head"><span className="tag tag-类比">类比</span><h2>{sc.title}</h2></div>
          <div className="analogy">
            <motion.div className="an-side an-life" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}><small>日常里</small>{inline(sc.life)}</motion.div>
            <div className="an-link"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 12h16M14 7l5 5-5 5" stroke="#c2a05a" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg></div>
            <motion.div className="an-side an-sky" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}><small>天上</small>{inline(sc.sky)}</motion.div>
          </div>
          {sc.pairs && <div className="an-pairs">{sc.pairs.map(([a, b], k) => (
            <motion.div key={k} className="an-pair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + k * 0.08 }}><span>{a}</span><i /><span>{b}</span></motion.div>
          ))}</div>}
          <div className="an-breaks"><b>这个比方哪里不成立</b>{inline(sc.breaks)}</div>
        </>
      )
    case 'debate':
      return (
        <>
          <div className="sc-head"><span className={`tag tag-${sc.tag}`}>{sc.tag}</span><h2>{sc.title}</h2></div>
          <div className="rich"><Rich text={sc.body} /></div>
          {sc.sides && <div className="debate-sides">{sc.sides.map((d, k) => (
            <motion.div key={k} className="ds" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + k * 0.08 }}><b>{d.who}</b><p>{inline(d.says)}</p></motion.div>
          ))}</div>}
        </>
      )
    case 'widget':
      return (
        <>
          <div className="sc-head"><span className="tag tag-互动">动手</span>{sc.tag && <span className={`tag tag-${sc.tag}`}>{sc.tag}</span>}<h2>{sc.title}</h2></div>
          {sc.body && <div className="rich"><Rich text={sc.body} /></div>}
          <Widget name={sc.w} args={sc.args} />
        </>
      )
    case 'connect':
      return <ConnectView from={sc.from} to={sc.to} next={sc.next} />
    case 'summary':
      return (
        <>
          <div className="sc-head"><span className="tag tag-小结">小结</span><h2>这一课记住三件事</h2></div>
          <div className="summary">
            {sc.points.map(([tag, p], k) => (
              <motion.div key={k} className="sum-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.12 }}>
                <span className={`tag tag-${tag}`}>{tag}</span><p>{inline(p)}</p>
              </motion.div>
            ))}
          </div>
        </>
      )
    case 'yi':
      return (
        <>
          <div className="sc-head"><span className="tag tag-传统">对照</span><h2>和周易比一比</h2></div>
          <details className="yi-card" open>
            <summary><span className="yi-seal">易</span>{sc.title}</summary>
            <div className="yi-b">{inline(sc.body)}</div>
          </details>
          <p className="muted small" style={{ marginTop: 10 }}>不需要的话，可以在「设置」里关掉周易对照。</p>
        </>
      )
    case 'quote':
      return (
        <>
          <div className="sc-head"><span className="tag tag-传统">原典</span><h2>古书里怎么说</h2></div>
          <blockquote className="quote" style={{ margin: 0 }}>{sc.text}<cite>—— {sc.source}</cite></blockquote>
          {sc.note && <div className="rich" style={{ marginTop: 14 }}><Rich text={sc.note} /></div>}
        </>
      )
    case 'tasks':
      return (
        <>
          <div className="sc-head"><span className="tag tag-互动">任务</span><h2>{sc.title}</h2></div>
          {sc.intro && <div className="rich"><Rich text={sc.intro} /></div>}
          <div className="tasks">
            {sc.tasks.map((t, k) => {
              const id = `${lesson.day}-${k}`
              const on = Boolean(s.tasks[id])
              return (
                <button key={k} className={`task ${on ? 'on' : ''}`} onClick={() => toggleTask(id)}>
                  <span className="tk">{on && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3 3 7-7" stroke="#fff" strokeWidth="2" fill="none" /></motion.svg>}</span>
                  <span className="tt">{inline(t)}</span>
                </button>
              )
            })}
          </div>
        </>
      )
    case 'write':
      return <WriteView id={sc.id} prompt={sc.prompt} hint={sc.hint} reference={sc.reference} />
  }
}

function ConnectView({ from, to, next }: { from: string[]; to: string; next?: string }) {
  const n = from.length
  const W = 320, H = 70
  return (
    <>
      <div className="sc-head"><span className="tag tag-推导">连线</span><h2>和学过的连起来</h2></div>
      <div className="connect">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 6, padding: '4px 2px 0' }}>
          {from.map((f, k) => (
            <motion.div key={k} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.12 }}
              style={{ textAlign: 'center', fontSize: 13, color: 'rgba(246,241,228,.85)', fontFamily: 'var(--serif)', lineHeight: 1.45, padding: '8px 4px', border: '1px solid rgba(246,241,228,.16)', borderRadius: 12, background: 'rgba(246,241,228,.04)' }}>
              <div style={{ color: 'var(--gold)', fontSize: 10, marginBottom: 2 }}>✦ 已学</div>{f}
            </motion.div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`}>
          {from.map((_, k) => (
            <motion.path key={k} d={`M${(W / n) * (k + 0.5)} 0 C${(W / n) * (k + 0.5)} ${H * 0.6} ${W / 2} ${H * 0.4} ${W / 2} ${H}`} stroke="#c2a05a" strokeWidth={1.3} fill="none"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.8 }} transition={{ delay: 0.3 + k * 0.12, duration: 0.7 }} />
          ))}
        </svg>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + n * 0.12, type: 'spring', stiffness: 220, damping: 16 }}
          style={{ textAlign: 'center', padding: '12px 14px', borderRadius: 14, background: 'var(--gold)', color: 'var(--night)', fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 700, boxShadow: '0 0 30px rgba(194,160,90,.45)' }}>
          {to}
        </motion.div>
      </div>
      {next && <div className="connect-next">下一课预告：<b>{next}</b></div>}
    </>
  )
}

function WriteView({ id, prompt, hint, reference }: { id: string; prompt: string; hint?: string; reference?: string }) {
  const s = useStore()
  const [text, setText] = useState(() => s.notes[id] ?? '')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (text === (getState().notes[id] ?? '')) return
    const t = setTimeout(() => { setNote(id, text); setSaved(true) }, 500)
    return () => clearTimeout(t)
  }, [text, id])
  return (
    <>
      <div className="sc-head"><span className="tag tag-互动">写一写</span><h2>{prompt}</h2></div>
      {hint && <p className="muted">{hint}</p>}
      <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false) }} placeholder="写在这里，只保存在这台设备上……" />
      <div className="saved">{saved ? '已保存到本机 ✓' : ''}</div>
      {reference && <details className="write-ref"><summary>写完了？看看参考说法</summary><p>{inline(reference)}</p></details>}
    </>
  )
}

// ───────────── 题目 ─────────────
function QuizView({ q, day, idx, onAnswer, onBack }: { q: Quiz; day: number; idx: number; onAnswer: (ok: boolean | null) => void; onBack: (screen?: number) => void }) {
  switch (q.t) {
    case 'choice': return <ChoiceView key={idx} q={q.q} opts={q.opts} a={q.a} ex={q.ex} seed={day * 100 + idx} onAnswer={onAnswer} onBack={() => onBack(q.back)} />
    case 'steps': return <StepsView key={idx} q={q} seed={day * 100 + idx} onAnswer={onAnswer} />
    case 'sort': return <SortView key={idx} q={q} onAnswer={onAnswer} />
    case 'order': return <OrderView key={idx} q={q} seed={day * 100 + idx} onAnswer={onAnswer} />
    case 'calc': return <CalcView key={idx} q={q} onAnswer={onAnswer} onBack={() => onBack()} />
    case 'explain': return <ExplainView key={idx} q={q} day={day} idx={idx} />
  }
}

export function ChoiceView({ q, opts, a, ex, seed, onAnswer, onBack, compact }: { q: string; opts: string[]; a: number; ex: string; seed: number; onAnswer: (ok: boolean) => void; onBack?: () => void; compact?: boolean }) {
  const order = useMemo(() => (opts.length > 2 ? shuffleIdx(opts.length, seed) : opts.map((_, i) => i)), [opts, seed])
  const [pick, setPick] = useState<number | null>(null)
  const locked = pick !== null
  const ok = pick === a
  return (
    <div>
      {!compact && <h2 className="quiz-q">{inline(q)}</h2>}
      <div className="opts">
        {order.map((oi) => {
          const cls = pick === null ? '' : oi === a ? 'right' : oi === pick ? 'wrong' : 'dim'
          return (
            <motion.button key={oi} className={`opt ${cls}`} disabled={locked} whileTap={{ scale: 0.98 }}
              animate={pick === oi && oi !== a ? { x: [0, -6, 6, -3, 0] } : {}} transition={{ duration: 0.35 }}
              onClick={() => { setPick(oi); onAnswer(oi === a) }}>
              {inline(opts[oi])}
              {pick !== null && oi === a && <motion.span className="ring-fx" initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.06 }} transition={{ duration: 0.8 }} />}
            </motion.button>
          )
        })}
      </div>
      {pick !== null && (
        <motion.div className={`explain ${ok ? 'ok' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <b>{ok ? '答对了' : '再想想'}</b>{inline(ex)}
          {!ok && onBack && <div><button className="goback" onClick={onBack}>回到讲这个的那一屏看看 ›</button></div>}
        </motion.div>
      )}
    </div>
  )
}

function StepsView({ q, seed, onAnswer }: { q: Extract<Quiz, { t: 'steps' }>; seed: number; onAnswer: (ok: boolean) => void }) {
  const [step, setStep] = useState(0)
  const [okAll, setOkAll] = useState(true)
  return (
    <div>
      <h2 className="quiz-q">{inline(q.q)}</h2>
      {q.parts.slice(0, step + 1).map((p, k) => (
        <div key={k} style={{ marginBottom: 18 }}>
          <div className="row" style={{ marginBottom: 8 }}><span className="dv-n">{k + 1}</span><span className="serif grow" style={{ fontSize: 16 }}>{inline(p.q)}</span></div>
          <ChoiceView q={p.q} opts={p.opts} a={p.a} ex={p.ex} seed={seed + k} compact onAnswer={(ok) => {
            const all = okAll && ok
            setOkAll(all)
            if (k === q.parts.length - 1) onAnswer(all)
            else setTimeout(() => setStep(k + 1), 600)
          }} />
        </div>
      ))}
    </div>
  )
}

function SortView({ q, onAnswer }: { q: Extract<Quiz, { t: 'sort' }>; onAnswer: (ok: boolean) => void }) {
  const [picks, setPicks] = useState<number[]>([])
  const cur = picks.length
  const doneAll = cur >= q.items.length
  const put = (b: number) => {
    if (doneAll) return
    const np = [...picks, b]
    setPicks(np)
    if (np.length === q.items.length) onAnswer(np.every((x, i) => x === q.items[i][1]))
  }
  const right = picks.filter((x, i) => x === q.items[i][1]).length
  return (
    <div>
      <h2 className="quiz-q">{inline(q.q)}</h2>
      <div className="sort-items">
        {q.items.map(([t, b], i) => {
          const st = i < cur ? (picks[i] === b ? 'ok' : 'no') : i === cur ? 'cur' : ''
          if (i > cur) return null
          return (
            <motion.div key={i} className={`sort-item ${st}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {i < cur && <span className={`tag tag-${q.bins[b]} si-tag`} style={!TAGNAMES.includes(q.bins[b]) ? { background: 'var(--surface-2)', color: 'var(--ink-2)', borderColor: 'var(--line-strong)' } : undefined}>{picks[i] === b ? '✓ ' : '✗ 应为 '}{q.bins[b]}</span>}
              {inline(t)}
            </motion.div>
          )
        })}
      </div>
      {!doneAll && (
        <>
          <p className="muted small">把上面高亮的这一条放进哪一类？</p>
          <div className="bins">
            {q.bins.map((b, k) => (
              <motion.button key={k} whileTap={{ scale: 0.94 }} className={`tag tag-${b}`} onClick={() => put(k)}
                style={!TAGNAMES.includes(b) ? { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line-strong)' } : undefined}>{b}</motion.button>
            ))}
          </div>
        </>
      )}
      {doneAll && (
        <motion.div className={`explain ${right === q.items.length ? 'ok' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <b>{right} / {q.items.length} 分对了</b>{q.ex ? inline(q.ex) : null}
        </motion.div>
      )}
    </div>
  )
}
const TAGNAMES = ['天文', '推导', '传统', '约定', '争议', '类比', '小结']

function OrderView({ q, seed, onAnswer }: { q: Extract<Quiz, { t: 'order' }>; seed: number; onAnswer: (ok: boolean) => void }) {
  const order = useMemo(() => shuffleIdx(q.steps.length, seed), [q, seed])
  const [seq, setSeq] = useState<number[]>([])
  const doneAll = seq.length === q.steps.length
  const ok = doneAll && seq.every((v, i) => v === i)
  const tap = (k: number) => {
    if (doneAll) return
    if (seq.includes(k)) { setSeq(seq.slice(0, seq.indexOf(k))); return }
    const ns = [...seq, k]
    setSeq(ns)
    if (ns.length === q.steps.length) onAnswer(ns.every((v, i) => v === i))
  }
  return (
    <div>
      <h2 className="quiz-q">{inline(q.q)}</h2>
      <p className="muted small" style={{ marginTop: -8 }}>按推导的先后依次点；点错了可以再点一下撤回。</p>
      <div className="order-list">
        {(doneAll ? seq : order).map((k) => {
          const pos = seq.indexOf(k)
          const cls = doneAll ? (seq[pos] === pos ? 'ok' : 'no') : ''
          return (
            <motion.button layout key={k} className={`order-item ${cls}`} onClick={() => tap(k)} transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
              <span className="on" style={pos < 0 ? { background: 'transparent', border: '1.5px dashed var(--line-strong)' } : undefined}>{pos >= 0 ? pos + 1 : ''}</span>
              <span className="grow">{inline(q.steps[k])}</span>
            </motion.button>
          )
        })}
      </div>
      {doneAll && (
        <motion.div className={`explain ${ok ? 'ok' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <b>{ok ? '顺序完全正确' : '正确顺序是：'}</b>
          {!ok && <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>{q.steps.map((s, i) => <li key={i}>{inline(s)}</li>)}</ol>}
          {q.ex && <div style={{ marginTop: 6 }}>{inline(q.ex)}</div>}
          {!ok && <div><button className="goback" onClick={() => { setSeq([]) }}>再排一次</button></div>}
        </motion.div>
      )}
    </div>
  )
}

function CalcView({ q, onAnswer, onBack }: { q: Extract<Quiz, { t: 'calc' }>; onAnswer: (ok: boolean) => void; onBack: () => void }) {
  const [v, setV] = useState('')
  const [res, setRes] = useState<boolean | null>(null)
  const check = () => {
    const n = parseFloat(v.replace(/[^\d.\-]/g, ''))
    const ok = Number.isFinite(n) && Math.abs(n - q.answer) <= (q.tol ?? 0.5)
    setRes(ok); onAnswer(ok)
  }
  return (
    <div>
      <h2 className="quiz-q">{inline(q.q)}</h2>
      <div className="calc-row">
        <input inputMode="decimal" value={v} disabled={res !== null} onChange={(e) => setV(e.target.value)} placeholder="填一个数" onKeyDown={(e) => e.key === 'Enter' && v && check()} />
        {q.unit && <span className="serif" style={{ alignSelf: 'center', fontSize: 18 }}>{q.unit}</span>}
        <button className="btn primary" disabled={!v || res !== null} onClick={check}>核对</button>
      </div>
      {res !== null && (
        <motion.div className={`explain ${res ? 'ok' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <b>{res ? '算对了' : `答案约是 ${q.answer}${q.unit ?? ''}`}</b><Rich text={q.ex} />
          {!res && <div><button className="goback" onClick={onBack}>回去再看看推导 ›</button></div>}
        </motion.div>
      )}
    </div>
  )
}

function ExplainView({ q, day, idx }: { q: Extract<Quiz, { t: 'explain' }>; day: number; idx: number }) {
  const s = useStore()
  const ids = q.points.map((_, k) => `${day}-${idx}-${k}`)
  const n = ids.filter((id) => s.explains[id]).length
  return (
    <div>
      <h2 className="quiz-q">{inline(q.q)}</h2>
      <p className="muted" style={{ marginTop: -8 }}>对着空气、家人或者镜子，用自己的话讲一遍。讲清楚一条，就勾一条。这里没有对错，只是帮你检查自己。</p>
      <div className="explain-pts">
        {q.points.map((p, k) => {
          const on = Boolean(s.explains[ids[k]])
          return (
            <button key={k} className={`task ${on ? 'on' : ''}`} onClick={() => toggleExplain(ids[k])}>
              <span className="tk">{on && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3 3 7-7" stroke="#fff" strokeWidth="2" fill="none" /></motion.svg>}</span>
              <span className="tt">{inline(p)}</span>
            </button>
          )
        })}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>已讲清 {n} / {q.points.length}</p>
    </div>
  )
}

// ───────────── 结果：点亮今天的星 ─────────────
function Result({ lesson, results, onRedo }: { lesson: Lesson; results: (boolean | null)[]; onRedo: () => void }) {
  const s = useStore()
  const graded = results.filter((r) => r !== null)
  const right = graded.filter(Boolean).length
  const [lit, setLit] = useState(false)
  const today = new Date()
  const wd = (today.getDay() + 6) % 7
  const weekDays = Array.from({ length: 7 }, (_, k) => { const d = new Date(today); d.setDate(today.getDate() - wd + k); return todayStr(d) })
  const slotX = (k: number) => 30 + k * 40
  const stage = stageOf(lesson.day)
  const nextDay = lesson.day + 1
  const explainQ = lesson.quiz.findIndex((q) => q.t === 'explain')
  const certOk = lesson.cert && explainQ >= 0 && (lesson.quiz[explainQ] as Extract<Quiz, { t: 'explain' }>).points.every((_, k) => s.explains[`${lesson.day}-${explainQ}-${k}`])
  const wrongIdx = results.map((r, i) => (r === false ? i : -1)).filter((i) => i >= 0)
  return (
    <div className="pad result">
      <div className="lesson-head" style={{ marginBottom: 6 }}>
        <a className="back close" href={`#/stage/${stage.n}`} aria-label="关闭">×</a>
        <div className="lh-mid"><div className="lh-day">第 {lesson.day} 天 · 完成</div><div className="lh-title">{lesson.title}</div></div>
        <span style={{ width: 38 }} />
      </div>
      <div className="result-score">{graded.length ? <><b>{right}</b><span> / {graded.length}</span></> : <b style={{ fontSize: 34 }}>完成</b>}</div>
      <p className="muted">{graded.length === 0 ? '这一课没有计分题，讲给自己听就是最好的检查。' : right === graded.length ? '全对！推导链条很牢。' : '答错的题已经放进温习的错题本，过几天会再见到它们。'}</p>

      <motion.div className="light-zone" animate={{ height: lit ? 84 : 200 }} transition={{ delay: lit ? 0.95 : 0, duration: 0.45 }}>
        <svg width="300" height="200" viewBox="0 0 300 200">
          <defs><radialGradient id="glowR"><stop offset="0" stopColor="#f3d999" stopOpacity=".8" /><stop offset="1" stopColor="#f3d999" stopOpacity="0" /></radialGradient></defs>
          <rect x="6" y="2" width="288" height="46" rx="23" fill="#141a2e" />
          {weekDays.map((d, k) => {
            const on = s.checkins.includes(d) && (k !== wd || lit)
            return (
              <g key={k}>
                {k > 0 && s.checkins.includes(weekDays[k - 1]) && on && <line x1={slotX(k - 1)} y1={25} x2={slotX(k)} y2={25} stroke="#c2a05a" strokeOpacity=".6" />}
                {on ? <path d={STAR_D} transform={`translate(${slotX(k)} 25) scale(.8)`} fill="#f3d999" /> : <circle cx={slotX(k)} cy={25} r={3} fill="rgba(246,241,228,.3)" />}
                <text x={slotX(k)} y={62} textAnchor="middle" fontSize="10" fill="var(--ink-soft)">{'一二三四五六日'[k]}</text>
              </g>
            )
          })}
          {lit && <motion.circle cx={slotX(wd)} cy={25} r={10} fill="none" stroke="#f3d999" initial={{ r: 6, opacity: 1 }} animate={{ r: 26, opacity: 0 }} transition={{ delay: 0.75, duration: 0.8 }} />}
          <motion.g initial={false} animate={lit ? { x: slotX(wd), y: 25, scale: 0.2, opacity: 0 } : { x: 150, y: 130, scale: 1, opacity: 1 }} transition={{ duration: 0.85, ease: [0.5, 0, 0.3, 1], opacity: { delay: 0.75, duration: 0.15 } }}>
            <motion.circle r={44} fill="url(#glowR)" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
            <path d={STAR_D} transform="scale(3.6)" fill="#f3d999" stroke="#c2a05a" strokeWidth={0.3} />
          </motion.g>
        </svg>
      </motion.div>
      {!lit ? (
        <button className="btn primary xl block" onClick={() => setLit(true)}>点亮今天的星 ✦</button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <p className="serif" style={{ fontSize: 17 }}>第 {Object.keys(s.completed).length} 颗星，已放进你的星空。</p>
          {certOk && <Certificate stage={stage} />}
          {lesson.cert && !certOk && <p className="muted small">把「讲给我听」的每一条都勾上，就能拿到第一阶段结业证书。</p>}
          {nextDay <= 700 && <a className="btn primary block" href={`#/lesson/${nextDay}`}>{isBuilt(nextDay) ? `继续：第 ${nextDay} 天` : `看看第 ${nextDay} 天（制作中）`}</a>}
          <a className="btn block" href="#/today">回到今日</a>
          {wrongIdx.length > 0 && <button className="btn ghost block" onClick={onRedo}>再做一遍小题</button>}
        </motion.div>
      )}
    </div>
  )
}

function Certificate({ stage }: { stage: ReturnType<typeof stageOf> }) {
  return (
    <motion.div className="sign-detail" style={{ textAlign: 'center', margin: '16px 0', position: 'relative', overflow: 'hidden' }} initial={{ opacity: 0, scale: 0.9, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 1.1 }}>
      <Starfield />
      <div style={{ position: 'relative' }}>
        <PatternSvg n={stage.n} lit={7} size={110} />
        <div className="eyebrow" style={{ color: 'var(--gold)' }}>星学堂 · 阶段结业</div>
        <h2>第 {stage.n} 阶段 · {stage.name}</h2>
        <p className="serif" style={{ color: 'rgba(246,241,228,.8)', fontSize: 14.5 }}>你已经能讲清这一阶段的 {stage.canExplain.length} 个要点：{stage.sub}。</p>
        <div className="small" style={{ color: 'var(--gold)', marginTop: 8 }}>{todayStr()} · 第 {stage.from}–{stage.to} 天</div>
      </div>
    </motion.div>
  )
}
