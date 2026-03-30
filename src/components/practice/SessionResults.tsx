import { centsToHsl } from '../../utils/colorUtils'
import { SCALES } from '../../utils/scaleDefinitions'
import { saveSession, type PracticeSession } from '../../utils/sessions'
import StaffView from './StaffView'
import NoteResultsTable from './NoteResultsTable'

interface SessionResultsProps {
  session: PracticeSession
  onSave: () => void
  onDiscard: () => void
}

export default function SessionResults({ session, onSave, onDiscard }: SessionResultsProps) {
  const scaleName = SCALES[session.scaleKey].label
  const scoreColor = centsToHsl(session.avgAbsCents)
  const date = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(session.timestamp))

  function handleSave() {
    saveSession(session)
    onSave()
  }

  return (
    <div className="w-full flex flex-col md:flex-row md:gap-8 gap-4">

      {/* Left column: staff notation + note table */}
      <div className="flex flex-col gap-4 flex-1">
        {session.noteEvents.length > 0 && (
          <div className="bg-blue-950/80 rounded-xl p-3">
            <StaffView noteEvents={session.noteEvents} />
          </div>
        )}
        {session.noteEvents.length > 0 && (
          <NoteResultsTable noteEvents={session.noteEvents} />
        )}
        {session.noteEvents.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">
            No notes detected. Try playing closer to the microphone.
          </p>
        )}
      </div>

      {/* Right column: header + score + stats + actions */}
      <div className="flex flex-col gap-4 md:min-w-52">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Results</h2>
            <p className="text-xs text-gray-500">{scaleName} · {date}</p>
          </div>
          {/* Score badge */}
          <div
            className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-2"
            style={{ borderColor: scoreColor, color: scoreColor }}
          >
            <span className="text-2xl font-bold tabular-nums leading-none">
              {session.percentInTune}
            </span>
            <span className="text-xs">%</span>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex gap-2 text-center">
          <StatChip label="Notes" value={String(session.totalNotes)} color="#9ca3af" />
          <StatChip label="In tune" value={String(session.inTuneCount)} color="#34d399" />
          <StatChip label="Close" value={String(session.closeCount)} color="#fbbf24" />
          <StatChip label="Off" value={String(session.outOfTuneCount)} color="#f87171" />
          <StatChip
            label="Avg ¢"
            value={`±${Math.round(session.avgAbsCents)}`}
            color={scoreColor}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold transition-all touch-none"
          >
            Save
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 py-3 rounded-full bg-blue-900/70 hover:bg-blue-900/70 active:scale-95 text-gray-300 font-semibold transition-all touch-none"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 bg-blue-950/80 rounded-lg py-2 px-1 flex flex-col items-center gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}
