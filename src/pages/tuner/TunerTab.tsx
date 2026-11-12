import { useEffect, useState } from 'react'
import { usePitchDetection } from '../../hooks/usePitchDetection'
import TunerMeter from '../../components/TunerMeter'
import NoteDisplay from '../../components/NoteDisplay'
import CentsDisplay from '../../components/CentsDisplay'
import FrequencyDisplay from '../../components/FrequencyDisplay'
import { useIsActiveTab } from '../../activeTab'
import { TEMPERAMENTS, type TemperamentKey } from '../../utils/temperaments'
import { type ConcertPitchHz } from '../../utils/concertPitch'
import { getResonanceString } from '../../utils/noteUtils'
import { INSTRUMENTS, INSTRUMENT_KEYS, loadInstrument, saveInstrument, type InstrumentKey } from '../../utils/instruments'
import OpenStringsPanel from './OpenStringsPanel'

interface TunerTabProps {
  temperamentKey: TemperamentKey
  concertPitch: ConcertPitchHz
  /** Choosing an instrument applies the temperament it plays in. */
  onTemperamentChange: (key: TemperamentKey) => void
}

type TunerMode = 'strings' | 'play'

export default function TunerTab({ temperamentKey, concertPitch, onTemperamentChange }: TunerTabProps) {
  const { note, listeningState, errorMessage, start, stop, setTemperament, setConcertPitch } = usePitchDetection()
  const [instrumentKey, setInstrumentKey] = useState<InstrumentKey>(loadInstrument)
  const [mode, setMode] = useState<TunerMode>('strings')
  const instrument = INSTRUMENTS[instrumentKey]

  // The tuner listens while its tab is shown and stops when the user leaves it
  // (every tab stays mounted, activeTab.ts), so there is no Start button.
  const active = useIsActiveTab('tuner')
  useEffect(() => {
    if (!active) return
    start()
    return stop
  }, [active, start, stop])

  function chooseInstrument(key: InstrumentKey) {
    setInstrumentKey(key)
    saveInstrument(key)
    onTemperamentChange(INSTRUMENTS[key].playTemperament)
    setMode('strings')
  }

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

      {/* Instrument + mode */}
      <div className="w-full max-w-md flex flex-col items-center gap-3 pt-3">
        <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Instrument">
          {INSTRUMENT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={instrumentKey === key}
              onClick={() => chooseInstrument(key)}
              className={[
                'rounded-full px-3 py-1 text-sm font-medium border transition-colors',
                instrumentKey === key
                  ? 'bg-gray-700 text-gray-100 border-gray-500'
                  : 'border-gray-700 text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
              ].join(' ')}
            >
              {INSTRUMENTS[key].label}
            </button>
          ))}
        </div>
        <div className="grid w-full grid-cols-2 gap-1 rounded-lg p-1 neu-inset" role="tablist" aria-label="Tuner mode">
          {([['strings', '① Open strings'], ['play', '② Play']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={[
                'min-h-10 rounded-md px-3 text-sm font-semibold transition-colors',
                mode === m
                  ? 'bg-gray-700 text-gray-100 shadow-sm'
                  : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'play' && (
          <p className="text-xs text-gray-500 text-center">
            Playing in {TEMPERAMENTS[temperamentKey].label}
            {temperamentKey === instrument.playTemperament
              ? ` — recommended for ${instrument.label.toLowerCase()}`
              : ''}
          </p>
        )}
      </div>

      {mode === 'strings' ? (
        <main className="w-full max-w-sm md:max-w-none flex flex-col items-center gap-4 flex-1 justify-center">
          <OpenStringsPanel
            instrument={instrument}
            concertPitch={concertPitch}
            frequency={note?.frequency ?? null}
            listening={listeningState === 'listening'}
            onDone={() => setMode('play')}
          />
          {listeningState === 'error' && errorMessage && (
            <div className="text-center text-red-400 text-base max-w-xs px-4 bg-red-950/40 rounded-xl py-3">
              {errorMessage}
            </div>
          )}
        </main>
      ) : (
      <main className="w-full max-w-sm md:max-w-none flex flex-col items-center gap-4 flex-1 justify-center">
        {/* Note name */}
        <div className="h-32 flex items-center justify-center">
          {note
            ? <NoteDisplay noteName={note.noteName} octave={note.octave} status={note.status} />
            : listeningState === 'idle'
              ? <span className="text-sm text-gray-600">Starting the microphone…</span>
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
      )}

      {/* Only after a failure: the browser asks for the microphone again. */}
      {listeningState === 'error' && (
        <footer className="w-full flex justify-center pb-2">
          <button onClick={start} className="px-8 py-4 neu-btn text-[color:var(--neu-fg)] rounded-full">Try again</button>
        </footer>
      )}
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
