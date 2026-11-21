import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { DAILY_REVIEW_CAP, dueCards, scheduleInfo, streak, todayStr, useStore } from '../lib/store'
import { isBuilt, outlineByDay, stageOf, useLesson } from '../data/curriculum'
import { KIND_LABEL } from '../data/types'
import { COVER } from '../data/curriculum/build'
import { fmtDeg, signOf, termAt } from '../data/zodiac'
import { sunLongitude, ayanamsaAt } from '../lib/astro'
import { Glyph, StarShape } from '../components/Glyph'
import { LearningMap } from '../components/LearningMap'
import { StarCalendar } from '../components/StarCalendar'

const art = (n: string) => `${import.meta.env.BASE_URL}art/${n}.webp`
const WD = ['日', '一', '二', '三', '四', '五', '六']

function SkyNow() {
  const s = useStore()
  const [lon, setLon] = useState<number | null>(null)
  useEffect(() => { sunLongitude(new Date()).then(setLon).catch(() => setLon(null)) }, [])
  if (lon == null) return <div className="sky-now"><div className="sn-glyph" /><div><div className="sn-t">今日天象</div><div className="sn-v">正在计算太阳位置…</div></div></div>
  const sid = s.settings.zodiac === 'sidereal'
  const L = sid ? lon - ayanamsaAt(new Date().getFullYear()) : lon
  const { sign, deg } = signOf(L)
  return (
    <a href={`#/sky/atlas/${sign.i}`} className="sky-now">
      <div className="sn-glyph"><Glyph i={sign.i} size={52} color="#c2a05a" draw width={6} /></div>
      <div>
        <div className="sn-t">今日天象 · 太阳在</div>
        <div className="sn-v">{sign.name}座 {fmtDeg(deg)}</div>
        <div className="sn-s">{sid ? '恒星黄道' : `回归黄道 · 黄经 ${lon.toFixed(1)}° · 节气段：${termAt(lon)}`}</div>
      </div>
    </a>
  )
}

export function TodayPage() {
  const s = useStore()
  const info = scheduleInfo(s)
  const next = info.next ?? 700
  const loaded = useLesson(next)
  const loading = loaded === undefined
  const lesson = loaded ?? null
  const ol = outlineByDay(next)!
  const st = stageOf(next)
  const due = Math.min(dueCards(s).length, DAILY_REVIEW_CAP)
  const sk = streak(s)
  const d = new Date()
  const doneToday = s.checkins.includes(todayStr())
  const cover = lesson?.cover ?? COVER[Math.min(5, Math.floor((Math.min(next, 42) - 1) / 7))]
  const missed = info.missed.filter((x) => x !== next).slice(0, 5)
  return (
    <div>
      <div className="today-head">
        <div>
          <div className="today-date">{d.getMonth() + 1} 月 {d.getDate()} 日 · 星期{WD[d.getDay()]}</div>
          <h1>{doneToday ? '今天的星已点亮' : info.doneCount === 0 ? '从第 1 天开始' : '今天学点什么'}</h1>
        </div>
        <a href="#/settings" className="streak" aria-label="设置">
          <span className="streak-star"><StarShape size={22} fill={sk > 0 ? '#f3d999' : 'rgba(246,241,228,.35)'} /></span>
          <b>{sk}</b>连续天
        </a>
      </div>

      <motion.a href={`#/lesson/${next}`} className="lesson-card" whileTap={{ scale: 0.985 }}>
        <img src={art(cover)} alt="" />
        {doneToday && <span className="lc-done">今日已学 ✦</span>}
        <div className="lc-body">
          <div className="lc-kicker"><span>第 {next} 天 · 第 {st.n} 阶段 {st.name}</span><span className="lc-kind">{KIND_LABEL[ol.kind]}</span></div>
          <h2>{ol.title}</h2>
          <p>{loading ? '正在打开…' : lesson ? lesson.question : `这一课还在制作中：${ol.goal || st.goal}`}</p>
          <div className="lc-go">
            <span className="small" style={{ color: 'rgba(246,241,228,.6)' }}>{lesson ? `约 ${lesson.minutes ?? 20} 分钟 · ${lesson.screens.length} 屏 · ${lesson.quiz.length} 道题` : loading ? '正在载入…' : '即将上线'}</span>
            <span className="btn sm">{isBuilt(next) ? (doneToday ? '再学一课' : '开始') : '看看'} ›</span>
          </div>
        </div>
      </motion.a>

      <div className="stats">
        <div className="stat"><b>{info.doneCount}</b><span>已学 / 700</span></div>
        <div className="stat"><b>{sk}</b><span>连续天数</span></div>
        <a className="stat" href="#/review"><b>{due}</b><span>今日温习</span></a>
      </div>

      <SkyNow />

      {missed.length > 0 && (
        <>
          <h3 className="section-title">还没学的 <small>按日历落下的课，慢慢补，不着急</small></h3>
          <div className="card mini-list">
            {missed.map((m) => <a key={m} href={`#/lesson/${m}`}><span className="md">第{m}天</span><span className="grow serif">{outlineByDay(m)?.title}</span><span className="ll-arrow">›</span></a>)}
          </div>
        </>
      )}

      <h3 className="section-title">学习地图 <small>点开看全部 17 个阶段</small></h3>
      <a href="#/course"><LearningMap s={s} current={next} compact /></a>

      <h3 className="section-title">星空打卡</h3>
      <StarCalendar checkins={s.checkins} />
      <p className="muted small center" style={{ marginTop: 18 }}>数据只存在这台设备上。可在 <a href="#/settings" className="gold">设置</a> 里导出备份。</p>
    </div>
  )
}
