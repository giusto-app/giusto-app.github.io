import { useEffect, useState } from 'react'
import TabBar, { type AppTab } from './components/TabBar'
import { ActiveTabContext } from './activeTab'
import ThemeToggle from './components/ThemeToggle'
import SoundAlertBanner from './components/SoundAlertBanner'
import TunerTab from './pages/tuner/TunerTab'
import DroneTab from './pages/drone/DroneTab'
import PracticeTab from './pages/practice/PracticeTab'
import ProgressTab from './pages/progress/ProgressTab'
import GuideTab from './pages/guide/GuideTab'
import SettingsTab from './pages/settings/SettingsTab'
import LearnTab from './pages/learn/LearnTab'
import { type TemperamentKey } from './utils/temperaments'
import { loadConcertPitch, saveConcertPitch, type ConcertPitchHz } from './utils/concertPitch'

const TABS: AppTab[] = ['tuner', 'drone', 'practice', 'learn', 'progress', 'guide', 'settings']

// The URL hash drives the active tab: #learn, #practice, etc. The Learn tab's
// tune deep links (#tune/<genre>/<folder>, owned by LearnTab) also imply Learn.
function tabFromHash(hash: string): AppTab | null {
  const slug = (hash.startsWith('#') ? hash.slice(1) : hash).split('/')[0]
  if (slug === 'tune') return 'learn'
  return (TABS as string[]).includes(slug) ? (slug as AppTab) : null
}

export default function App() {
  const [activeTab, setActiveTab]           = useState<AppTab>(() => tabFromHash(window.location.hash) ?? 'tuner')
  const [temperamentKey, setTemperamentKey] = useState<TemperamentKey>('equal')
  const [concertPitch, setConcertPitchState]= useState<ConcertPitchHz>(loadConcertPitch)
  const [progressRefreshKey, setProgressRefreshKey] = useState(0)
  const [isDark, setIsDark]                 = useState(() => localStorage.getItem('giusto-theme') !== 'light')

  // Keep body class in sync for CSS overrides
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('light', !isDark)
  }

  // Keep the active tab in sync with the URL hash (deep links, back button).
  useEffect(() => {
    function syncFromHash() {
      const tab = tabFromHash(window.location.hash)
      if (tab) setActiveTab(tab)
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  function selectTab(tab: AppTab) {
    setActiveTab(tab)
    // Don't stomp a Learn tune deep link (#tune/...) when re-selecting Learn.
    if (tab === 'learn' && window.location.hash.startsWith('#tune/')) return
    if (window.location.hash !== `#${tab}`) window.location.hash = tab
  }

  function handleConcertPitchChange(hz: ConcertPitchHz) {
    saveConcertPitch(hz)
    setConcertPitchState(hz)
  }

  function handleSessionSaved() {
    setProgressRefreshKey(k => k + 1)
    selectTab('progress')
  }

  return (
    <ActiveTabContext.Provider value={activeTab}>
    <div className="h-full flex flex-col relative overflow-hidden">

      {/* Speaks up when sound is playing but cannot be heard — see audio/audibility.ts */}
      <SoundAlertBanner />

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative">
        <div className={activeTab === 'tuner'    ? 'block h-full' : 'hidden'}>
          <TunerTab
            temperamentKey={temperamentKey}
            concertPitch={concertPitch}
          />
        </div>
        <div className={activeTab === 'drone'    ? 'block h-full' : 'hidden'}>
          <DroneTab concertPitch={concertPitch} />
        </div>
        <div className={activeTab === 'practice' ? 'block h-full' : 'hidden'}>
          <PracticeTab
            temperamentKey={temperamentKey}
            onTemperamentChange={setTemperamentKey}
            concertPitch={concertPitch}
            onSessionSaved={handleSessionSaved}
          />
        </div>
        <div className={activeTab === 'learn'    ? 'block h-full' : 'hidden'}>
          <LearnTab />
        </div>
        <div className={activeTab === 'progress' ? 'block h-full' : 'hidden'}>
          <ProgressTab refreshKey={progressRefreshKey} />
        </div>
        <div className={activeTab === 'guide'    ? 'block h-full' : 'hidden'}>
          <GuideTab />
        </div>
        <div className={activeTab === 'settings' ? 'block h-full' : 'hidden'}>
          <SettingsTab
            temperamentKey={temperamentKey}
            onTemperamentChange={setTemperamentKey}
            concertPitch={concertPitch}
            onConcertPitchChange={handleConcertPitchChange}
          />
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <TabBar activeTab={activeTab} onChange={selectTab} />

      <ThemeToggle isDark={isDark} onToggle={() => setIsDark(d => {
        const next = !d
        localStorage.setItem('giusto-theme', next ? 'dark' : 'light')
        return next
      })} />
    </div>
    </ActiveTabContext.Provider>
  )
}
