import { useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { TodayPage } from './pages/Today'
import { CoursePage, StagePage } from './pages/Course'
import { LessonRoute } from './pages/Lesson'
import { SkyPage } from './pages/Sky'
import { ReviewPage } from './pages/Review'
import { QAPage } from './pages/QA'
import { SettingsPage } from './pages/Settings'
import { WelcomePage } from './pages/Welcome'
import { isOnboarded, useStore } from './lib/store'

const useHash = () => {
  const [h, setH] = useState(() => window.location.hash.slice(1) || '/today')
  useEffect(() => {
    const read = () => { setH(window.location.hash.slice(1) || '/today'); window.scrollTo(0, 0) }
    // 结果页的「继续」是 #/lesson/N 这种链接。iOS Safari 在带 transform / filter 的层里
    // 会改地址但不发 hashchange，页面就停在原地。点击时自己同步一次。
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || href === '#') return
      e.preventDefault()
      if (window.location.hash !== href) window.location.hash = href
      read()
    }
    window.addEventListener('hashchange', read)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', read)
      document.removeEventListener('click', onClick)
    }
  }, [])
  return h
}

const ICONS: Record<string, React.ReactNode> = {
  today: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>,
  course: <svg viewBox="0 0 24 24"><path d="M5 20c2-4 0-7 3-10s7-1 9-5" /><circle cx="5" cy="20" r="1.6" /><circle cx="12" cy="10.5" r="1.6" /><circle cx="18" cy="4.5" r="1.6" /></svg>,
  sky: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-23 12 12)" /><circle cx="15.5" cy="8.5" r="1.2" /></svg>,
  review: <svg viewBox="0 0 24 24"><rect x="4" y="6" width="13" height="15" rx="2" /><path d="M8 3h10a2 2 0 0 1 2 2v12" /><path d="M8 12h5M8 15.5h3" /></svg>,
  qa: <svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /><path d="M10 9.2a2 2 0 1 1 2.6 1.9c-.5.2-.6.5-.6 1" /><circle cx="12" cy="14" r=".4" /></svg>,
}
const TABS = [
  { to: 'today', label: '今日' }, { to: 'course', label: '学程' }, { to: 'sky', label: '星图' }, { to: 'review', label: '温习' }, { to: 'qa', label: '问答' },
]

export default function App() {
  const path = useHash()
  const s = useStore()
  const parts = path.split('/').filter(Boolean)
  const showWelcome = (!isOnboarded(s) && (parts[0] === 'today' || !parts[0])) || parts[0] === 'welcome'
  let page
  if (showWelcome) page = <WelcomePage />
  else switch (parts[0]) {
    case 'course': page = <CoursePage />; break
    case 'stage': page = <StagePage n={Number(parts[1])} />; break
    case 'lesson': page = <LessonRoute day={Number(parts[1])} />; break
    case 'sky': page = <SkyPage tab={parts[1]} sign={parts[2] ? Number(parts[2]) : undefined} />; break
    case 'review': page = <ReviewPage mode={parts[1]} />; break
    case 'qa': page = <QAPage />; break
    case 'settings': page = <SettingsPage />; break
    default: page = <TodayPage />
  }
  const active = parts[0] === 'stage' || parts[0] === 'lesson' ? 'course' : parts[0] === 'settings' ? 'today' : parts[0] || 'today'
  const immersive = showWelcome || parts[0] === 'lesson'
  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={showWelcome ? 'welcome' : path}
            className={`main ${immersive ? 'immersive' : ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 0.7, 0.3, 1] }}
          >
            {page}
          </motion.main>
        </AnimatePresence>
        {!immersive && (
          <nav className="tabbar">
            {TABS.map((t) => (
              <a key={t.to} href={`#/${t.to}`} className={active === t.to ? 'on' : ''}>
                <span className="tab-ico">
                  {active === t.to && <motion.span layoutId="tab-glow" className="tab-glow" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  {ICONS[t.to]}
                </span>
                <span>{t.label}</span>
              </a>
            ))}
          </nav>
        )}
      </div>
    </MotionConfig>
  )
}
