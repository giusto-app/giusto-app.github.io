import { useEffect, useState } from 'react'
import { parseDocument } from 'lily-parser'
import type { ParsedTune, DocumentBlock } from 'lily-parser'
import { StaffView as LilyStaffView } from 'lily-viewer'
import 'lily-viewer/style.css'
import { centsToHsl } from '../../utils/colorUtils'
import { formatCents } from '../../utils/noteUtils'
import type { NoteEvent } from '../../utils/sessions'

interface StaffViewLilyPondProps {
  source: string
  noteEvents?: NoteEvent[]
  fontFamily?: string
  measureRange?: [number, number]
  showTitle?: boolean
}

export default function StaffViewLilyPond({
  source,
  noteEvents,
  fontFamily = 'Bravura',
  measureRange,
  showTitle = false,
}: StaffViewLilyPondProps) {
  const [tune, setTune] = useState<ParsedTune | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!source) return
    try {
      const blocks: DocumentBlock[] = parseDocument(source)
      const scoreBlock = blocks.find((b): b is Extract<DocumentBlock, { type: 'score' }> => b.type === 'score')
      if (scoreBlock) {
        setTune(scoreBlock.tune)
        setError(null)
      } else {
        setError('No score block found in LilyPond source')
      }
    } catch (e) {
      setError(String(e))
      setTune(null)
    }
  }, [source])

  if (error) {
    return <div className="text-red-400 text-sm p-2">{error}</div>
  }

  if (!tune) {
    return <div className="text-gray-500 text-sm p-2">Parsing…</div>
  }

  return (
    <div className="w-full">
      {/* Force the lily-viewer SVG to fill the container width */}
      <div className="[&_svg]:!w-full [&_svg]:!h-auto">
        <LilyStaffView
          tune={tune}
          fontFamily={fontFamily}
          showTitle={showTitle}
          measureRange={measureRange}
        />
      </div>

      {/* Intonation labels — same format as Options A and B */}
      {noteEvents && noteEvents.length > 0 && (
        <div className="flex mt-1" style={{ gap: 0 }}>
          {noteEvents.map((event, idx) => {
            const color = centsToHsl(event.absCentsAvg)
            return (
              <div key={idx} className="flex flex-col items-center text-center" style={{ flex: 1 }}>
                <span className="text-[9px] text-gray-400 leading-tight">
                  {event.noteName}{event.octave}
                </span>
                <span className="text-[9px] font-semibold font-mono leading-tight" style={{ color }}>
                  {formatCents(event.avgCents)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
