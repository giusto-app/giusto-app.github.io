import { centsToHsl } from '../../utils/colorUtils'
import { SCALES } from '../../utils/scaleDefinitions'
import { TEMPERAMENTS } from '../../utils/temperaments'
import { clearSessions, type PracticeSession } from '../../utils/sessions'

interface SessionHistoryListProps {
  sessions: PracticeSession[]
  onClear: () => void
}

export default function SessionHistoryList({ sessions, onClear }: SessionHistoryListProps) {
  if (sessions.length === 0) return null

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest uppercase text-gray-500">
          History
        </h3>
        <button
          onClick={() => { clearSessions(); onClear() }}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      {sessions.map(s => {
        const color = centsToHsl(s.avgAbsCents)
        const date = new Intl.DateTimeFormat(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(new Date(s.timestamp))
        const scaleName = SCALES[s.scaleKey]?.label ?? s.scaleKey
        const tempName = TEMPERAMENTS[s.temperamentKey]?.label ?? s.temperamentKey

        return (
          <div key={s.id}
            className="flex items-center justify-between bg-blue-950/80 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-sm text-gray-200 font-medium">{scaleName}</p>
              <p className="text-xs text-gray-500">{date} · {tempName}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-lg font-bold tabular-nums" style={{ color }}>
                {s.percentInTune}%
              </span>
              <span className="text-xs text-gray-600">
                ±{Math.round(s.avgAbsCents)}¢ avg
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
