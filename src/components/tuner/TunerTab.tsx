import { useEffect } from 'react'
import { usePitchDetection } from '../../hooks/usePitchDetection'
import TunerMeter from '../TunerMeter'
import NoteDisplay from '../NoteDisplay'
import CentsDisplay from '../CentsDisplay'
import FrequencyDisplay from '../FrequencyDisplay'
import StartButton from '../StartButton'
import TemperamentSelector from '../TemperamentSelector'
import WakeLockToggle from '../WakeLockToggle'
import ConcertPitchSelector from '../ConcertPitchSelector'
import { TEMPERAMENTS, type TemperamentKey } from '../../utils/temperaments'
import { type ConcertPitchHz } from '../../utils/concertPitch'

interface TunerTabProps {
  temperamentKey: TemperamentKey
  onTemperamentChange: (key: TemperamentKey) => void
  concertPitch: ConcertPitchHz
  onConcertPitchChange: (hz: ConcertPitchHz) => void
}

export default function TunerTab({ temperamentKey, onTemperamentChange, concertPitch, onConcertPitchChange }: TunerTabProps) {
  const { note, listeningState, errorMessage, start, stop, setTemperament, setConcertPitch } = usePitchDetection()

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

  return (
    <div className="min-h-full flex flex-col items-center justify-between py-6 px-4 md:px-10">
      <header className="w-full max-w-sm md:max-w-none flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400">
            Intonation Trainer
          </h1>
          <a href="/?compare" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">
            Staff rendering comparison
          </a>
        </div>
        <WakeLockToggle />
      </header>

      <main className="w-full max-w-sm md:max-w-none flex flex-col items-center gap-4 flex-1 justify-center">
        {/* Note name */}
        <div className="h-32 flex items-center justify-center">
          {note
            ? <NoteDisplay noteName={note.noteName} octave={note.octave} status={note.status} />
            : <span className="text-8xl font-bold text-gray-700">—</span>}
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

        {/* Listening indicator */}
        {listeningState === 'listening' && !note && (
          <div className="flex items-center gap-2 text-gray-400 text-base">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Listening…
          </div>
        )}

        {/* Error */}
        {listeningState === 'error' && errorMessage && (
          <div className="text-center text-red-400 text-base max-w-xs px-4 bg-red-950/40 rounded-xl py-3">
            {errorMessage}
          </div>
        )}

        {/* Temperament */}
        <div className="w-full pt-2">
          <p className="text-sm font-semibold tracking-widest uppercase text-gray-500 text-center mb-2">
            Temperament
          </p>
          <TemperamentSelector value={temperamentKey} onChange={handleTemperamentChange} />
        </div>

        {/* Concert pitch */}
        <div className="w-full">
          <p className="text-sm font-semibold tracking-widest uppercase text-gray-500 text-center mb-2">
            Concert Pitch
          </p>
          <ConcertPitchSelector value={concertPitch} onChange={handleConcertPitchChange} />
        </div>
      </main>

      <footer className="w-full flex justify-center pb-2">
        <StartButton listeningState={listeningState} onStart={start} onStop={stop} />
      </footer>
    </div>
  )
}
