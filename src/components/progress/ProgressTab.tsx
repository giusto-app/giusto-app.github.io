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
        <div className="text-5xl">📈</div>
        <p className="text-gray-400 font-medium">No sessions yet</p>
        <p className="text-gray-600 text-sm">
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
    <div className="min-h-full px-4 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">
          Progress
        </h1>
      </header>

      {/* Summary stats */}
      <div className="flex gap-3">
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

      {/* Chart */}
      <div className="bg-gray-900 rounded-xl p-3">
        <p className="text-xs text-gray-500 mb-2">% in tune per session (last 20)</p>
        <SessionBarChart sessions={sessions} />
      </div>

      {/* History list */}
      <SessionHistoryList
        sessions={sessions}
        onClear={() => setSessions([])}
      />
    </div>
  )
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined
    ? 'text-gray-200'
    : positive ? 'text-emerald-400' : 'text-red-400'
  return (
    <div className="flex-1 bg-gray-900 rounded-xl py-3 px-2 text-center">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
