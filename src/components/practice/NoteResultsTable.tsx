import { centsToHsl } from '../../utils/colorUtils'
import { formatCents } from '../../utils/noteUtils'
import type { NoteEvent } from '../../utils/sessions'

interface NoteResultsTableProps {
  noteEvents: NoteEvent[]
}

export default function NoteResultsTable({ noteEvents }: NoteResultsTableProps) {
  if (noteEvents.length === 0) return null

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th className="text-left px-3 py-2">Note</th>
            <th className="text-right px-3 py-2">Avg ¢</th>
            <th className="text-right px-3 py-2">Duration</th>
            <th className="px-3 py-2 text-center">Intonation</th>
          </tr>
        </thead>
        <tbody>
          {noteEvents.map((event, idx) => {
            const color = centsToHsl(event.absCentsAvg)
            return (
              <tr key={idx} className="border-b border-gray-800/60 last:border-0">
                <td className="px-3 py-2 font-semibold tabular-nums" style={{ color }}>
                  {event.noteName}{event.octave}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                  style={{ color }}
                >
                  {formatCents(event.avgCents)}
                </td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                  {Math.round(event.durationMs)}ms
                </td>
                <td className="px-3 py-2 text-center">
                  <IntonationBar absCents={event.absCentsAvg} color={color} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IntonationBar({ absCents, color }: { absCents: number; color: string }) {
  const pct = Math.min((absCents / 50) * 100, 100)
  return (
    <div className="flex items-center justify-center gap-1">
      <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right tabular-nums">
        {Math.round(absCents)}
      </span>
    </div>
  )
}
