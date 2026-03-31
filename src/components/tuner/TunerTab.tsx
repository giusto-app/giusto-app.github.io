import { useEffect } from 'react'
import { usePitchDetection } from '../../hooks/usePitchDetection'
import { useWakeLock } from '../../hooks/useWakeLock'
import TunerMeter from '../TunerMeter'
import NoteDisplay from '../NoteDisplay'
import CentsDisplay from '../CentsDisplay'
import FrequencyDisplay from '../FrequencyDisplay'
import StartButton from '../StartButton'
import { TEMPERAMENTS, type TemperamentKey } from '../../utils/temperaments'
import { type ConcertPitchHz } from '../../utils/concertPitch'
import { getResonanceString } from '../../utils/noteUtils'

interface TunerTabProps {
  temperamentKey: TemperamentKey
  concertPitch: ConcertPitchHz
}

export default function TunerTab({ temperamentKey, concertPitch }: TunerTabProps) {
  const { note, listeningState, errorMessage, start, stop, setTemperament, setConcertPitch } = usePitchDetection()
  // Keep wake lock alive even though settings UI is in SettingsTab
  useWakeLock()

  // Sync temperament and concert pitch into the detection hook whenever they change
  useEffect(() => {
    setTemperament(TEMPERAMENTS[temperamentKey].offsets)
  }, [temperamentKey, setTemperament])

  useEffect(() => {
    setConcertPitch(concertPitch)
  }, [concertPitch, setConcertPitch])

  const resonanceString = note ? getResonanceString(note.pitchClass, note.cents) : null

  return (
    <div className="min-h-full flex flex-col items-center justify-between py-6 px-4 md:px-10">
      <header className="w-full max-w-sm md:max-w-none flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400">
          Intonation Trainer
        </h1>
        <span className="text-xs text-gray-600 tabular-nums">
          {TEMPERAMENTS[temperamentKey].label} · {concertPitch} Hz
        </span>
      </header>

      <main className="w-full max-w-sm md:max-w-none flex flex-col items-center gap-4 flex-1 justify-center">
        {/* Note name */}
        <div className="h-32 flex items-center justify-center">
          {note
            ? <NoteDisplay noteName={note.noteName} octave={note.octave} status={note.status} />
            : listeningState === 'idle'
              ? <span className="text-sm text-gray-600">Tap Start Listening to begin</span>
              : <span className="text-8xl font-bold text-gray-700">—</span>}
        </div>

        {/* Resonance indicator — fixed height to avoid layout shift */}
        <div className="h-7 flex items-center justify-center">
          {resonanceString && <ResonanceIndicator string={resonanceString} />}
        </div>

        {/* Frequency + concert pitch indicator */}
        <div className="h-7 flex items-center gap-3">
          {note
            ? <FrequencyDisplay frequency={note.frequency} />
            : <span className="text-lg font-mono text-gray-600">— Hz</span>}
          <span className="text-xs font-mono text-gray-600">A = {concertPitch}</span>
        </div>

        {/* Meter */}
        <div className="w-full">
          <TunerMeter cents={note?.cents ?? 0} status={note?.status ?? 'out-of-tune'} />
        </div>

        {/* Cents */}
        <div className="h-12 flex items-center">
          {note
            ? <CentsDisplay cents={note.cents} status={note.status} />
            : <span className="text-4xl font-mono text-gray-600">—</span>}
        </div>

        {/* Listening indicator — fixed height to avoid layout shift */}
        <div className="h-7 flex items-center justify-center">
          {listeningState === 'listening' && !note && (
            <div className="flex items-center gap-2 text-gray-400 text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              Listening…
            </div>
          )}
        </div>

        {/* Error */}
        {listeningState === 'error' && errorMessage && (
          <div className="text-center text-red-400 text-base max-w-xs px-4 bg-red-950/40 rounded-xl py-3">
            {errorMessage}
          </div>
        )}
      </main>

      <footer className="w-full flex justify-center pb-2">
        <StartButton listeningState={listeningState} onStart={start} onStop={stop} />
      </footer>
    </div>
  )
}

function ResonanceIndicator({ string: s }: { string: 'G' | 'D' | 'A' | 'E' }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
      <RingIcon />
      <span className="text-xs font-medium text-amber-300 tracking-wide">
        {s} string rings
      </span>
    </div>
  )
}

function RingIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke="#fcd34d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4" />
      <path d="M17.7 6.3a8 8 0 0 1 0 11.4" />
      <path d="M3.5 3.5a14 14 0 0 0 0 17" />
      <path d="M20.5 3.5a14 14 0 0 1 0 17" />
    </svg>
  )
}
