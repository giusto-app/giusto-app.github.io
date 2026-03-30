import { useEffect, useState } from 'react'
import { usePitchDetection } from '../../hooks/usePitchDetection'
import { useDrone } from '../../hooks/useDrone'
import { useWakeLock } from '../../hooks/useWakeLock'
import TunerMeter from '../TunerMeter'
import NoteDisplay from '../NoteDisplay'
import CentsDisplay from '../CentsDisplay'
import FrequencyDisplay from '../FrequencyDisplay'
import StartButton from '../StartButton'
import TemperamentSelector from '../TemperamentSelector'
import WakeLockToggle from '../WakeLockToggle'
import ConcertPitchSelector from '../ConcertPitchSelector'
import DroneControl from '../DroneControl'
import { TEMPERAMENTS, type TemperamentKey } from '../../utils/temperaments'
import { type ConcertPitchHz } from '../../utils/concertPitch'
import { getResonanceString } from '../../utils/noteUtils'

interface TunerTabProps {
  temperamentKey: TemperamentKey
  onTemperamentChange: (key: TemperamentKey) => void
  concertPitch: ConcertPitchHz
  onConcertPitchChange: (hz: ConcertPitchHz) => void
}

export default function TunerTab({ temperamentKey, onTemperamentChange, concertPitch, onConcertPitchChange }: TunerTabProps) {
  const { note, listeningState, errorMessage, start, stop, setTemperament, setConcertPitch } = usePitchDetection()
  const { droneState, toggle: droneToggle, setPitchClass: dronePitchClass, setInterval: droneInterval, setVolume: droneVolume, stop: droneStop } = useDrone()
  const { active: wakeLockActive, toggle: wakeLockToggle, supported: wakeLockSupported } = useWakeLock()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Stop drone when tuner stops
  useEffect(() => {
    if (listeningState === 'idle') droneStop()
  }, [listeningState, droneStop])

  // Sync concert pitch into the detection hook whenever it changes
  useEffect(() => {
    setConcertPitch(concertPitch)
  }, [concertPitch, setConcertPitch])

  function handleTemperamentChange(key: TemperamentKey) {
    onTemperamentChange(key)
    setTemperament(TEMPERAMENTS[key].offsets)
  }

  function handleConcertPitchChange(hz: ConcertPitchHz) {
    onConcertPitchChange(hz)
    setConcertPitch(hz)
  }

  const resonanceString = note ? getResonanceString(note.pitchClass, note.cents) : null

  return (
    <div className="min-h-full flex flex-col items-center justify-between py-6 px-4 md:px-10">
      <header className="w-full max-w-sm md:max-w-none flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400">
          Intonation Trainer
        </h1>
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </header>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="w-full max-w-sm md:max-w-none mt-3 flex flex-col gap-4 rounded-xl border border-white/28 bg-white/20 backdrop-blur-md shadow-lg shadow-black/40 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500">Settings</p>
            {wakeLockSupported && <WakeLockToggle active={wakeLockActive} toggle={wakeLockToggle} />}
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">Temperament</p>
            <TemperamentSelector value={temperamentKey} onChange={handleTemperamentChange} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">Concert Pitch</p>
            <ConcertPitchSelector value={concertPitch} onChange={handleConcertPitchChange} />
          </div>
        </div>
      )}

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

        {/* Drone */}
        <div className="w-full">
          <DroneControl
            droneState={droneState}
            concertPitchHz={concertPitch}
            onToggle={droneToggle}
            onPitchClass={dronePitchClass}
            onInterval={droneInterval}
            onVolume={droneVolume}
          />
        </div>

        {/* Settings status badge — tappable shortcut when settings panel is closed */}
        {!settingsOpen && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors tabular-nums"
          >
            {TEMPERAMENTS[temperamentKey].label} · {concertPitch} Hz
          </button>
        )}

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

function GearIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
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
