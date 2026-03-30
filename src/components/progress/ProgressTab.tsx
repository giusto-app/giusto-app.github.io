import { useEffect, useState } from 'react'
import { loadSessions, type PracticeSession } from '../../utils/sessions'
import SessionBarChart from './SessionBarChart'
import SessionHistoryList from './SessionHistoryList'

interface ProgressTabProps {
  refreshKey: number  // bump this to force a reload (e.g. after a session is saved)
}

export default function ProgressTab({ refreshKey }: ProgressTabProps) {
  const [sessions, setSessions] = useState<PracticeSession[]>([])

  useEffect(() => {
    setSessions(loadSessions())
  }, [refreshKey])

  if (sessions.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
            stroke="#60a5fa" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p className="text-white font-semibold">No sessions yet</p>
        <p className="text-gray-500 text-sm max-w-xs">
          Complete a practice session and save it to start tracking your progress.
        </p>
      </div>
    )
  }

  const best = Math.max(...sessions.map(s => s.percentInTune))
  const latest = sessions[0]!
  const trend = sessions.length >= 2
    ? sessions[0]!.percentInTune - sessions[1]!.percentInTune
    : null

  return (
    <div className="min-h-full px-4 md:px-8 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-500">
          Progress
        </h1>
      </header>

      {/* Summary stats */}
      <div className="flex gap-3 max-w-none">
        <StatCard label="Sessions" value={String(sessions.length)} />
        <StatCard label="Best" value={`${best}%`} />
        {trend !== null && (
          <StatCard
            label="vs last"
            value={`${trend >= 0 ? '+' : ''}${trend}%`}
            positive={trend >= 0}
          />
        )}
        <StatCard label="Latest" value={`${latest.percentInTune}%`} />
      </div>

      {/* Chart + history: side by side on tablet */}
      <div className="flex flex-col md:flex-row gap-5 flex-1">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 md:flex-1 shadow-md shadow-black/30">
          <p className="text-xs text-gray-500 mb-2">% in tune per session (last 20)</p>
          <SessionBarChart sessions={sessions} />
        </div>

        <div className="md:flex-1">
          <SessionHistoryList
            sessions={sessions}
            onClear={() => setSessions([])}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined
    ? 'text-gray-200'
    : positive ? 'text-blue-400' : 'text-red-400'
  return (
    <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl py-3 px-2 text-center shadow-md shadow-black/30">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
