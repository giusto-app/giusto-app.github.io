import { useState } from 'react'
import TabBar, { type AppTab } from './components/TabBar'
import ThemeToggle from './components/ThemeToggle'
import TunerTab from './components/tuner/TunerTab'
import DroneTab from './components/drone/DroneTab'
import PracticeTab from './components/practice/PracticeTab'
import ProgressTab from './components/progress/ProgressTab'
import GuideTab from './components/guide/GuideTab'
import SettingsTab from './components/settings/SettingsTab'
import LearnTab from './components/learn/LearnTab'
import { type TemperamentKey } from './utils/temperaments'
import { loadConcertPitch, saveConcertPitch, type ConcertPitchHz } from './utils/concertPitch'

export default function App() {
  const [activeTab, setActiveTab]           = useState<AppTab>('tuner')
  const [temperamentKey, setTemperamentKey] = useState<TemperamentKey>('equal')
  const [concertPitch, setConcertPitchState]= useState<ConcertPitchHz>(loadConcertPitch)
  const [progressRefreshKey, setProgressRefreshKey] = useState(0)
  const [isDark, setIsDark]                 = useState(() => localStorage.getItem('giusto-theme') !== 'light')

  // Keep body class in sync for CSS overrides
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('light', !isDark)
  }

  function handleConcertPitchChange(hz: ConcertPitchHz) {
    saveConcertPitch(hz)
    setConcertPitchState(hz)
  }

  function handleSessionSaved() {
    setProgressRefreshKey(k => k + 1)
    setActiveTab('progress')
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">

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
      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      <ThemeToggle isDark={isDark} onToggle={() => setIsDark(d => {
        const next = !d
        localStorage.setItem('giusto-theme', next ? 'dark' : 'light')
        return next
      })} />
    </div>
  )
}
