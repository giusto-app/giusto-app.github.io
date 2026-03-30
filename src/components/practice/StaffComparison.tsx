import StaffView from './StaffView'
import StaffViewVexFlow from './StaffViewVexFlow'
import type { NoteEvent } from '../../utils/sessions'

// G Melodic Minor scale fed to all three renderers:
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
    <div className="bg-blue-950/80 rounded-2xl p-4 flex flex-col gap-3">
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

      </div>

      <p className="text-xs text-gray-600 text-center mt-8">
        Open at <code className="text-gray-500">/?compare</code> · not part of the production app
      </p>
    </div>
    </div>
  )
}
