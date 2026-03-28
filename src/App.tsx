import { useState } from 'react'
import TabBar, { type AppTab } from './components/TabBar'
import TunerTab from './components/tuner/TunerTab'
import PracticeTab from './components/practice/PracticeTab'
import ProgressTab from './components/progress/ProgressTab'
import { type TemperamentKey } from './utils/temperaments'

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('tuner')
  const [temperamentKey, setTemperamentKey] = useState<TemperamentKey>('equal')
  // Bumped when a session is saved, so ProgressTab reloads
  const [progressRefreshKey, setProgressRefreshKey] = useState(0)

  function handleSessionSaved() {
    setProgressRefreshKey(k => k + 1)
    setActiveTab('progress')
  }

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Tab content — keep all mounted so state is preserved across tab switches */}
      <div className="flex-1 overflow-y-auto relative">
        <div className={activeTab === 'tuner' ? 'block h-full' : 'hidden'}>
          <TunerTab
            temperamentKey={temperamentKey}
            onTemperamentChange={setTemperamentKey}
          />
        </div>
        <div className={activeTab === 'practice' ? 'block h-full' : 'hidden'}>
          <PracticeTab
            temperamentKey={temperamentKey}
            onTemperamentChange={setTemperamentKey}
            onSessionSaved={handleSessionSaved}
          />
        </div>
        <div className={activeTab === 'progress' ? 'block h-full' : 'hidden'}>
          <ProgressTab refreshKey={progressRefreshKey} />
        </div>
      </div>

      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      <a
        href="/?compare"
        className="text-center text-xs text-gray-700 hover:text-gray-500 py-1 transition-colors"
      >
        Staff rendering comparison
      </a>
    </div>
  )
}
