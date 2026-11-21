import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { DAILY_REVIEW_CAP, INTERVALS, clearWrong, dueCards, getState, reviewCard, useStore } from '../lib/store'
import { cardById, dayOfCard, peekLesson, useLessons } from '../data/curriculum'
import { inline } from '../components/Rich'
import { ChoiceView } from './Lesson'
import { StarShape } from '../components/Glyph'

export function ReviewPage({ mode }: { mode?: string }) {
  const s = useStore()
  const due = dueCards(s).slice(0, DAILY_REVIEW_CAP)
  const { ready } = useLessons([...due.map(dayOfCard), ...Object.values(s.wrong).map((w) => w.day)])
  if (mode === 'go' && due.length) return ready ? <Session ids={due} /> : <div className="pad"><p className="muted">正在取出今天的卡…</p></div>
  const boxes = INTERVALS.map((_, b) => Object.values(s.cards).filter((c) => c.box === b).length)
  const maxBox = Math.max(1, ...boxes)
  const wrong = Object.entries(s.wrong).sort((a, b) => b[1].last.localeCompare(a[1].last))
  const notes = Object.entries(s.notes).filter(([k, v]) => k !== 'sun-people' && v.trim())
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow">温习</div><h1>记住，比学过更重要</h1></div></div>
      <div className="flash" style={{ textAlign: 'center', minHeight: 0, background: 'var(--night)', color: 'var(--star)' }}>
        <div style={{ display: 'grid', placeItems: 'center' }}><StarShape size={30} fill={due.length ? '#f3d999' : 'rgba(246,241,228,.4)'} /></div>
        <h2 style={{ color: 'var(--star)', margin: '8px 0 4px' }}>今天要温习 {due.length} 张卡</h2>
        <p style={{ color: 'rgba(246,241,228,.65)', fontSize: 14, fontFamily: 'var(--serif)' }}>
          {Object.keys(s.cards).length === 0 ? '学完第一课后，课里的题会变成温习卡，第二天开始出现。' : due.length ? '答对的卡会隔更久再出现（1、2、4、7、15、30、60 天）；答错就回到明天。' : '今天的温习做完了，明天见。'}
        </p>
        {due.length > 0 && <a className="btn gold" href="#/review/go" style={{ marginTop: 8 }}>开始温习</a>}
      </div>

      {Object.keys(s.cards).length > 0 && (
        <>
          <h3 className="section-title">记忆盒子 <small>越往右记得越牢</small></h3>
          <div className="card" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {boxes.map((n, b) => (
              <div key={b} style={{ flex: 1, textAlign: 'center' }}>
                <div className="small muted">{n}</div>
                <motion.div initial={{ height: 0 }} animate={{ height: `${(n / maxBox) * 60}px` }} style={{ background: b >= 4 ? 'var(--gold)' : 'var(--night-3)', borderRadius: 6, minHeight: 3 }} />
                <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 4 }}>{INTERVALS[b]}天</div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">错题本 <small>{wrong.length} 道</small></h3>
      {wrong.length === 0 ? <div className="empty">还没有错题。答错的题会自动收进来。</div> : !ready ? <p className="muted small">正在载入错题…</p> : (
        <div className="card">
          {wrong.map(([k, w]) => {
            const l = peekLesson(w.day)
            const q = l?.quiz[w.idx]
            if (!l || !q) return null
            return (
              <div key={k} className="qa-item">
                <h3>{inline(q.q)}</h3>
                {q.t === 'choice' && <p>答案：{inline(q.opts[q.a])}</p>}
                <div className="qa-meta"><a href={`#/lesson/${w.day}`}>第 {w.day} 天 · {l.title}</a><span>错过 {w.count} 次</span><button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => clearWrong(k)}>已掌握</button></div>
              </div>
            )
          })}
        </div>
      )}

      <h3 className="section-title">我写下的 <small>课里"写一写"的内容</small></h3>
      {notes.length === 0 ? <div className="empty">还没有。课里遇到"写一写"时，写下的话会出现在这里。</div> : (
        <div className="card">{notes.map(([k, v]) => <div key={k} className="qa-item"><div className="small gold">{k}</div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{v}</p></div>)}</div>
      )}
    </div>
  )
}

function Session({ ids }: { ids: string[] }) {
  const list = useMemo(() => ids, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [k, setK] = useState(0)
  const [answered, setAnswered] = useState<boolean | null>(null)
  const [right, setRight] = useState(0)
  const c = list[k] ? cardById(list[k]) : null
  if (k >= list.length || !c) return (
    <div className="center" style={{ paddingTop: 40 }}>
      <StarShape size={48} />
      <h1 style={{ marginTop: 12 }}>温习完成</h1>
      <p className="muted">{list.length} 张卡，答对 {right} 张。下一次出现的时间已经按记忆盒子排好。</p>
      <a className="btn primary block" href="#/review">回到温习</a>
    </div>
  )
  const card = getState().cards[list[k]]
  return (
    <div>
      <div className="lesson-head" style={{ marginBottom: 6 }}>
        <a className="back close" href="#/review" aria-label="关闭">×</a>
        <div className="lh-mid"><div className="lh-day">温习 {k + 1} / {list.length}</div><div className="lh-title">来自第 {c.lesson.day} 天</div></div>
        <span style={{ width: 38 }} />
      </div>
      <div className="progress"><i style={{ width: `${(k / list.length) * 100}%` }} /></div>
      <motion.div key={k} className="flash" initial={{ opacity: 0, rotateY: -12 }} animate={{ opacity: 1, rotateY: 0 }}>
        <div className="quiz-n"><span>{c.lesson.title}</span><span>盒子 {(card?.box ?? 0) + 1}</span></div>
        <ChoiceView q={c.q.q} opts={c.q.opts} a={c.q.a} ex={c.q.ex} seed={k + 7} onAnswer={(ok) => { setAnswered(ok); if (ok) setRight(right + 1); reviewCard(list[k], ok) }} />
      </motion.div>
      <button className="btn primary block" disabled={answered === null} onClick={() => { setK(k + 1); setAnswered(null) }}>{answered === null ? '先选一个答案' : answered ? '记得 · 下一张' : '没记住 · 明天再见'}</button>
    </div>
  )
}
