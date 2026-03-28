import { useEffect, useState } from 'react'
import { useSessionRecorder } from '../../hooks/useSessionRecorder'
import TunerMeter from '../TunerMeter'
import NoteDisplay from '../NoteDisplay'
import CentsDisplay from '../CentsDisplay'
import FrequencyDisplay from '../FrequencyDisplay'
import TemperamentSelector from '../TemperamentSelector'
import ScaleSelector from './ScaleSelector'
import RecordButton from './RecordButton'
import SessionResults from './SessionResults'
import { TEMPERAMENTS, type TemperamentKey } from '../../utils/temperaments'
import { SCALES, type ScaleKey } from '../../utils/scaleDefinitions'

interface PracticeTabProps {
  temperamentKey: TemperamentKey
  onTemperamentChange: (key: TemperamentKey) => void
  onSessionSaved: () => void  // navigate to Progress tab after save
}

export default function PracticeTab({
  temperamentKey,
  onTemperamentChange,
  onSessionSaved,
}: PracticeTabProps) {
  const [scaleKey, setScaleKey] = useState<ScaleKey>('d-major')
  const {
    recorderState, preCountdown, countdown, liveNote, session, errorMessage,
    startRecording, reset, cleanup,
  } = useSessionRecorder()

  // Cleanup audio when tab unmounts
  useEffect(() => () => cleanup(), [cleanup])

  function handleStart() {
    startRecording(scaleKey, temperamentKey, TEMPERAMENTS[temperamentKey].offsets)
  }

  function handleTemperamentChange(key: TemperamentKey) {
    onTemperamentChange(key)
    // temperament offsets are captured at startRecording() time, so changes
    // between sessions are fine — no need to restart anything
  }

  function handleSave() {
    reset()
    onSessionSaved()
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (recorderState === 'done' && session) {
    return (
      <div className="min-h-full overflow-y-auto px-4 py-6">
        <SessionResults
          session={session}
          onSave={handleSave}
          onDiscard={reset}
        />
      </div>
    )
  }

  // ── Pre-countdown ──────────────────────────────────────────────────────────
  if (recorderState === 'pre-countdown') {
    return (
      <div className="min-h-full flex flex-col items-center justify-between py-6 px-4">
        <header className="w-full max-w-sm text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">
            {SCALES[scaleKey].label}
          </p>
        </header>

        <main className="w-full max-w-sm flex flex-col items-center gap-4 flex-1 justify-center">
          <p className="text-sm text-gray-400 tracking-widest uppercase">Get ready…</p>
          <div className="w-28 h-28 flex items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10">
            <span className="text-7xl font-bold text-amber-400 tabular-nums">{preCountdown}</span>
          </div>
          <p className="text-xs text-gray-600">Recording starts when the countdown reaches zero</p>
        </main>

        <footer className="pb-2">
          <button
            onClick={reset}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </footer>
      </div>
    )
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  if (recorderState === 'recording') {
    const note = liveNote
    return (
      <div className="min-h-full flex flex-col items-center justify-between py-6 px-4">
        <header className="w-full max-w-sm text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">
            Recording · {SCALES[scaleKey].label}
          </p>
        </header>

        <main className="w-full max-w-sm flex flex-col items-center gap-3 flex-1 justify-center">
          <div className="h-28 flex items-center justify-center">
            {note
              ? <NoteDisplay noteName={note.noteName} octave={note.octave} status={note.status} />
              : <span className="text-7xl font-bold text-gray-700">—</span>}
          </div>
          <div className="h-5">
            {note
              ? <FrequencyDisplay frequency={note.frequency} />
              : <span className="text-sm font-mono text-gray-600">— Hz</span>}
          </div>
          <div className="w-full">
            <TunerMeter cents={note?.cents ?? 0} status={note?.status ?? 'out-of-tune'} />
          </div>
          <div className="h-8 flex items-center">
            {note
              ? <CentsDisplay cents={note.cents} status={note.status} />
              : (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Listening…
                </div>
              )}
          </div>
        </main>

        <footer className="pb-2">
          <RecordButton
            recorderState={recorderState}
            preCountdown={preCountdown}
            countdown={countdown}
            onStart={handleStart}
            onReset={reset}
          />
        </footer>
      </div>
    )
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full flex flex-col items-center justify-between py-6 px-4">
      <header className="w-full max-w-sm text-center">
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">
          Practice
        </h1>
      </header>

      <main className="w-full max-w-sm flex flex-col gap-5 flex-1 justify-center">
        {/* Scale */}
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">
            Scale
          </p>
          <ScaleSelector value={scaleKey} onChange={setScaleKey} />
        </section>

        {/* Temperament */}
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">
            Temperament
          </p>
          <TemperamentSelector value={temperamentKey} onChange={handleTemperamentChange} />
        </section>

        {/* Instructions */}
        <p className="text-xs text-gray-600 text-center">
          Tap Record, then play your scale. The app will track your intonation for 10 seconds.
        </p>

        {/* Error */}
        {errorMessage && (
          <div className="text-center text-red-400 text-sm bg-red-950/40 rounded-xl py-3 px-4">
            {errorMessage}
          </div>
        )}
      </main>

      <footer className="pb-2">
        <RecordButton
          recorderState={recorderState}
          preCountdown={preCountdown}
          countdown={countdown}
          onStart={handleStart}
          onReset={reset}
        />
      </footer>
    </div>
  )
}
