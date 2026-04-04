import { useEffect, useState } from 'react'
import { type LearnCard } from '../../utils/spaceRepetition'
import { type TuneCatalogEntry, type TuneNote } from '../../hooks/useTuneCatalog'
import { useMeasureRecorder } from '../../hooks/useMeasureRecorder'
import { dtw, computeOverallScore, type DTWResult } from '../../utils/dtw'
import StaffView from '../practice/StaffView'
import ScoreDisplay from './ScoreDisplay'

const NOTES_PER_SECTION = 12

/** Convert TuneNote to the shape StaffView expects. */
function toNoteEvent(n: TuneNote) {
  const midiNote = n.pc + (n.o + 1) * 12
  return {
    midiNote, pitchClass: n.pc,
    noteName: n.n, octave: n.o,
    avgCents: 0, absCentsAvg: 0,
    durationMs: 0, startTime: 0,
    status: 'in-tune' as const,
  }
}

function groupIntoSections(notes: TuneNote[]): TuneNote[][] {
  if (notes.length === 0) return [[]]
  const sections: TuneNote[][] = []
  for (let i = 0; i < notes.length; i += NOTES_PER_SECTION) {
    sections.push(notes.slice(i, i + NOTES_PER_SECTION))
  }
  return sections
}

type Phase = 'study' | 'play' | 'results'

interface PracticeViewProps {
  card: LearnCard
  tune: TuneCatalogEntry
  tuneNotes: TuneNote[]
  onGrade: (grade: 1 | 2 | 3 | 4, score: number) => void
  onCancel: () => void
}

export default function PracticeView({ card, tune, tuneNotes, onGrade, onCancel }: PracticeViewProps) {
  const sections      = groupIntoSections(tuneNotes)
  const totalSections = sections.length

  const [sectionIdx, setSectionIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('study')
  const [dtwResult, setDtwResult] = useState<DTWResult | null>(null)
  const [sectionScores, setSectionScores] = useState<number[]>([])

  const { recorderState, startRecording, stopRecording, detectedNotes, errorMessage, reset } =
    useMeasureRecorder()

  const currentSection = sections[sectionIdx] ?? []
  const isLastSection  = sectionIdx === totalSections - 1

  // Run DTW when analysis finishes
  useEffect(() => {
    if (recorderState !== 'done') return
    const detectedMidi  = detectedNotes.map(n => n.midiNote)
    const expectedMidi  = currentSection.map(n => n.pc + (n.o + 1) * 12)
    const detectedCents = detectedNotes.map(n => n.avgCents)
    const result = dtw(detectedMidi, expectedMidi, detectedCents)
    setDtwResult(result)
    setPhase('results')
  }, [recorderState]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRetry() {
    reset()
    setDtwResult(null)
    setPhase('study')
  }

  function handleNextSection() {
    const score = dtwResult ? computeOverallScore(dtwResult) : 0
    const newScores = [...sectionScores, score]
    setSectionScores(newScores)
    reset()
    setDtwResult(null)

    if (isLastSection) {
      const avg = Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length)
      const suggested: 1 | 2 | 3 | 4 = avg >= 80 ? 4 : avg >= 60 ? 3 : avg >= 40 ? 2 : 1
      onGrade(suggested, avg)
    } else {
      setSectionIdx(i => i + 1)
      setPhase('study')
    }
  }

  function handleGradeOverride(grade: 1 | 2 | 3 | 4) {
    const score = dtwResult ? computeOverallScore(dtwResult) : 0
    onGrade(grade, score)
  }

  // ── Study phase ────────────────────────────────────────────────────────────
  if (phase === 'study') {
    return (
      <div className="min-h-full flex flex-col px-4 py-6 gap-4">
        <header className="flex items-center gap-3">
          <button onClick={onCancel} className="neu-btn rounded-full p-2 text-[color:var(--neu-fg2)]">
            <XIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-[color:var(--neu-fg)] truncate">{tune.title}</h1>
            <p className="text-xs text-[color:var(--neu-fg2)]">{card.sectionLabel}</p>
          </div>
          <SectionPill current={sectionIdx + 1} total={totalSections} />
        </header>

        <ProgressBar current={sectionIdx} total={totalSections} />

        <div className="neu-surface rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">👁</span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--neu-fg)]">
              Section {sectionIdx + 1} of {totalSections}
            </p>
            {currentSection.length > 0 && (
              <p className="text-xs text-[color:var(--neu-fg2)]">{currentSection.length} notes</p>
            )}
          </div>
        </div>

        {/* Staff — current section notes only */}
        <div className="neu-inset rounded-2xl p-3 flex-1">
          {currentSection.length > 0 ? (
            <StaffView
              noteEvents={currentSection.map(toNoteEvent)}
              showCentsLabels={false}
              noteColor="var(--neu-fg2)"
            />
          ) : (
            <p className="text-sm text-[color:var(--neu-fg2)] text-center py-4">
              No note data — MIDI still loading
            </p>
          )}
        </div>

        <button
          onClick={() => setPhase('play')}
          className="w-full py-4 rounded-2xl neu-btn text-sm font-bold text-[color:var(--neu-fg)]"
        >
          Ready to play →
        </button>
      </div>
    )
  }

  // ── Play phase ─────────────────────────────────────────────────────────────
  if (phase === 'play') {
    return (
      <div className="min-h-full flex flex-col px-4 py-6 gap-5">
        <header className="flex items-center gap-3">
          <button onClick={() => { reset(); setPhase('study') }} className="neu-btn rounded-full p-2 text-[color:var(--neu-fg2)]">
            <ChevronLeft />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-[color:var(--neu-fg)] truncate">{tune.title}</h1>
            <p className="text-xs text-[color:var(--neu-fg2)]">Section {sectionIdx + 1} of {totalSections}</p>
          </div>
          <SectionPill current={sectionIdx + 1} total={totalSections} />
        </header>

        <ProgressBar current={sectionIdx} total={totalSections} />

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 rounded-full neu-inset flex items-center justify-center">
            {recorderState === 'idle'      && <ViolinIcon />}
            {recorderState === 'recording' && <span className="w-5 h-5 rounded-full bg-red-500 animate-pulse" />}
            {recorderState === 'analyzing' && <span className="w-5 h-5 rounded-full bg-blue-400 animate-pulse" />}
          </div>

          {recorderState === 'idle' && (
            <p className="text-sm text-[color:var(--neu-fg2)] text-center max-w-xs">
              Play section {sectionIdx + 1} from memory. Tap Record when ready.
            </p>
          )}
          {recorderState === 'recording' && (
            <p className="text-sm text-red-400 text-center">Recording — play now</p>
          )}
          {recorderState === 'analyzing' && (
            <p className="text-sm text-[color:var(--neu-fg2)] text-center">Analyzing…</p>
          )}
          {recorderState === 'done' && detectedNotes.length === 0 && (
            <p className="text-sm text-[color:var(--neu-fg2)] text-center max-w-xs">
              No notes detected — play louder or check your microphone.
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="text-center text-red-400 text-sm bg-red-950/40 rounded-xl py-3 px-4">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col items-center gap-3 pb-2">
          {recorderState === 'idle' && (
            <button
              onClick={startRecording}
              className="w-44 py-4 rounded-2xl neu-btn text-sm font-bold text-[color:var(--neu-fg)]"
            >
              ● Record
            </button>
          )}
          {recorderState === 'recording' && (
            <button
              onClick={stopRecording}
              className="w-44 py-4 rounded-2xl neu-btn text-sm font-bold text-red-400"
            >
              ■ Done
            </button>
          )}
          {(recorderState === 'done' || recorderState === 'error') && detectedNotes.length === 0 && (
            <button onClick={handleRetry} className="neu-btn rounded-xl px-5 py-3 text-sm text-[color:var(--neu-fg)]">
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Results phase ──────────────────────────────────────────────────────────
  if (dtwResult) {
    const score    = computeOverallScore(dtwResult)
    const autoPass = score >= 60

    return (
      <div className="min-h-full flex flex-col px-4 py-6 gap-5">
        <header className="flex items-center gap-3">
          <button onClick={onCancel} className="neu-btn rounded-full p-2 text-[color:var(--neu-fg2)]">
            <XIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-[color:var(--neu-fg)] truncate">{tune.title}</h1>
            <p className="text-xs text-[color:var(--neu-fg2)]">Section {sectionIdx + 1} of {totalSections}</p>
          </div>
          <button onClick={handleRetry} className="neu-btn rounded-full px-3 py-1.5 text-xs text-[color:var(--neu-fg2)]">
            Retry
          </button>
        </header>

        <ProgressBar current={sectionIdx} total={totalSections} />

        <div className="flex-1 overflow-y-auto">
          <ScoreDisplay
            dtwResult={dtwResult}
            onGrade={handleGradeOverride}
            showGradeButtons={isLastSection}
          />
        </div>

        {!isLastSection && (
          <button
            onClick={handleNextSection}
            className={[
              'w-full py-4 rounded-2xl neu-btn text-sm font-bold',
              autoPass ? 'text-emerald-400' : 'text-[color:var(--neu-fg)]',
            ].join(' ')}
          >
            {autoPass ? '✓ Next →' : 'Continue anyway →'}
          </button>
        )}
      </div>
    )
  }

  return null
}

function SectionPill({ current, total }: { current: number; total: number }) {
  return (
    <span className="shrink-0 neu-inset text-xs px-2.5 py-1 rounded-full text-[color:var(--neu-fg2)]">
      {current}/{total}
    </span>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  if (total <= 1) return null
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all ${i < current ? 'bg-emerald-500' : i === current ? 'bg-[color:var(--neu-fg2)]' : 'bg-[color:var(--neu-fg2)] opacity-30'}`}
        />
      ))}
    </div>
  )
}

function ViolinIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
      stroke="var(--neu-fg2)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
