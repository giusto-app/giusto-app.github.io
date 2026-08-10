import StaffView from './StaffView'
import StaffViewVexFlow from './StaffViewVexFlow'
import LilyScore from './LilyScore'
import { centsToHsl } from '../../utils/colorUtils'
import { formatCents } from '../../utils/noteUtils'
import type { NoteEvent } from '../../utils/sessions'

// Option C's sample, in LilyPond. The old third panel rendered this through the
// frozen lily-viewer; it now goes through LilyScore, so the page compares the
// two hand-rolled options against the renderer production actually uses.
const LILY_SOURCE = `\\relative g' {
  \\key g \\minor
  \\time 4/4
  \\tempo "Andante" 4=80
  g4 a bf c d e fs g
  f ef d c bf a g2
}`

/**
 * Per-note intonation readout under a staff, in the format Options A and B use.
 *
 * It lives here rather than in LilyScore because LilyScore is a production
 * component with no business knowing about intonation — this panel is the only
 * caller that wants the labels, so it owns them. Carried over from the deleted
 * StaffViewLilyPond, which is where they used to live.
 */
function IntonationLabels({ noteEvents }: { noteEvents: NoteEvent[] }) {
  if (noteEvents.length === 0) return null
  return (
    <div className="flex mt-1" style={{ gap: 0 }}>
      {noteEvents.map((event, idx) => (
        <div key={idx} className="flex flex-col items-center text-center" style={{ flex: 1 }}>
          <span className="text-[9px] text-gray-400 leading-tight">
            {event.noteName}{event.octave}
          </span>
          <span
            className="text-[9px] font-semibold font-mono leading-tight"
            style={{ color: centsToHsl(event.absCentsAvg) }}
          >
            {formatCents(event.avgCents)}
          </span>
        </div>
      ))}
    </div>
  )
}

// G Melodic Minor scale fed to both renderers:
// Ascending: G – A – Bb – C – D – E♮ – F# – G
// Descending: F♮ – Eb – D – C – Bb – A – G
const SAMPLE: NoteEvent[] = [
  // ascending
  { midiNote: 67, noteName: 'G',  octave: 4, pitchClass: 7,  avgCents: -2,  absCentsAvg: 2,  durationMs: 300, startTime: 0,    status: 'in-tune' },
  { midiNote: 69, noteName: 'A',  octave: 4, pitchClass: 9,  avgCents: +5,  absCentsAvg: 5,  durationMs: 300, startTime: 400,  status: 'in-tune' },
  { midiNote: 70, noteName: 'Bb', octave: 4, pitchClass: 10, avgCents: -8,  absCentsAvg: 8,  durationMs: 300, startTime: 800,  status: 'in-tune' },
  { midiNote: 72, noteName: 'C',  octave: 5, pitchClass: 0,  avgCents: +3,  absCentsAvg: 3,  durationMs: 300, startTime: 1200, status: 'in-tune' },
  { midiNote: 74, noteName: 'D',  octave: 5, pitchClass: 2,  avgCents: +12, absCentsAvg: 12, durationMs: 300, startTime: 1600, status: 'close' },
  { midiNote: 76, noteName: 'E',  octave: 5, pitchClass: 4,  avgCents: -6,  absCentsAvg: 6,  durationMs: 300, startTime: 2000, status: 'in-tune' },
  { midiNote: 78, noteName: 'F#', octave: 5, pitchClass: 6,  avgCents: +18, absCentsAvg: 18, durationMs: 300, startTime: 2400, status: 'close' },
  { midiNote: 79, noteName: 'G',  octave: 5, pitchClass: 7,  avgCents: -1,  absCentsAvg: 1,  durationMs: 300, startTime: 2800, status: 'in-tune' },
  // descending
  { midiNote: 77, noteName: 'F',  octave: 5, pitchClass: 5,  avgCents: +8,  absCentsAvg: 8,  durationMs: 300, startTime: 3200, status: 'in-tune' },
  { midiNote: 75, noteName: 'Eb', octave: 5, pitchClass: 3,  avgCents: -22, absCentsAvg: 22, durationMs: 300, startTime: 3600, status: 'close' },
  { midiNote: 74, noteName: 'D',  octave: 5, pitchClass: 2,  avgCents: +7,  absCentsAvg: 7,  durationMs: 300, startTime: 4000, status: 'in-tune' },
  { midiNote: 72, noteName: 'C',  octave: 5, pitchClass: 0,  avgCents: -4,  absCentsAvg: 4,  durationMs: 300, startTime: 4400, status: 'in-tune' },
  { midiNote: 70, noteName: 'Bb', octave: 4, pitchClass: 10, avgCents: +15, absCentsAvg: 15, durationMs: 300, startTime: 4800, status: 'close' },
  { midiNote: 69, noteName: 'A',  octave: 4, pitchClass: 9,  avgCents: -30, absCentsAvg: 30, durationMs: 300, startTime: 5200, status: 'out-of-tune' },
  { midiNote: 67, noteName: 'G',  octave: 4, pitchClass: 7,  avgCents: +2,  absCentsAvg: 2,  durationMs: 300, startTime: 5600, status: 'in-tune' },
]

interface OptionCardProps {
  label: string
  tag: string
  tagColor: string
  meta: string
  children: React.ReactNode
}

function OptionCard({ label, tag, tagColor, meta, children }: OptionCardProps) {
  return (
    <div className="neu-surface rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tagColor}`}>{tag}</span>
        <span className="text-sm font-semibold text-gray-200">{label}</span>
        <span className="text-xs text-gray-500 ml-auto">{meta}</span>
      </div>
      <div className="bg-gray-900 rounded-xl p-3 overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

export default function StaffComparison() {
  return (
    <div className="min-h-screen bg-gray-900">
    <div className="max-w-5xl mx-auto px-4 py-6 text-white">
      <h1 className="text-lg font-bold text-gray-100 mb-1">Staff Rendering Comparison</h1>
      {/* Color legend */}
      <div className="flex gap-4 mb-6 text-xs text-gray-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />≤10¢ in tune</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />10–25¢ close</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />&gt;25¢ off</span>
      </div>

      <div className="flex flex-col gap-5">
        <OptionCard
          tag="Option A"
          tagColor="bg-emerald-900 text-emerald-300"
          label="Custom SVG"
          meta="0 KB added · system serif font for clef"
        >
          <StaffView noteEvents={SAMPLE} />
        </OptionCard>

        <OptionCard
          tag="Option B"
          tagColor="bg-blue-900 text-blue-300"
          label="VexFlow 4"
          meta="~450 KB gzip · Bravura engraving font"
        >
          <StaffViewVexFlow noteEvents={SAMPLE} />
        </OptionCard>

        {/* Was lily-viewer, which turned out to be a pre-rename build of lilyJS
            itself — so this panel had been comparing the current renderer
            against its own ancestor. Repointed at LilyScore on 2026-08-10 so it
            compares against what production actually renders with. */}
        <OptionCard
          tag="Option C"
          tagColor="bg-violet-900 text-violet-300"
          label="lilyjs (current renderer)"
          meta="vendored bundle · Bravura SMuFL font · used in production"
        >
          <LilyScore source={LILY_SOURCE} />
          <IntonationLabels noteEvents={SAMPLE} />
        </OptionCard>

      </div>

      <p className="text-xs text-gray-600 text-center mt-8">
        Open at <code className="text-gray-500">/?compare</code> · not part of the production app
      </p>
    </div>
    </div>
  )
}
