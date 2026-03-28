import { usePitchDetection } from '../../hooks/usePitchDetection'
import TunerMeter from '../TunerMeter'
import NoteDisplay from '../NoteDisplay'
import CentsDisplay from '../CentsDisplay'
import FrequencyDisplay from '../FrequencyDisplay'
import StartButton from '../StartButton'
import TemperamentSelector from '../TemperamentSelector'
import WakeLockToggle from '../WakeLockToggle'
import { TEMPERAMENTS, type TemperamentKey } from '../../utils/temperaments'

interface TunerTabProps {
  temperamentKey: TemperamentKey
  onTemperamentChange: (key: TemperamentKey) => void
}

export default function TunerTab({ temperamentKey, onTemperamentChange }: TunerTabProps) {
  const { note, listeningState, errorMessage, start, stop, setTemperament } = usePitchDetection()

  function handleTemperamentChange(key: TemperamentKey) {
    onTemperamentChange(key)
    setTemperament(TEMPERAMENTS[key].offsets)
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-between py-6 px-4">
      <header className="w-full max-w-sm flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">
          Intonation Trainer
        </h1>
        <WakeLockToggle />
      </header>

      <main className="w-full max-w-sm flex flex-col items-center gap-3 flex-1 justify-center">
        {/* Note name */}
        <div className="h-28 flex items-center justify-center">
          {note
            ? <NoteDisplay noteName={note.noteName} octave={note.octave} status={note.status} />
            : <span className="text-7xl font-bold text-gray-700">—</span>}
        </div>

        {/* Frequency */}
        <div className="h-5">
          {note
            ? <FrequencyDisplay frequency={note.frequency} />
            : <span className="text-sm font-mono text-gray-600">— Hz</span>}
        </div>

        {/* Meter */}
        <div className="w-full">
          <TunerMeter cents={note?.cents ?? 0} status={note?.status ?? 'out-of-tune'} />
        </div>

        {/* Cents */}
        <div className="h-8 flex items-center">
          {note
            ? <CentsDisplay cents={note.cents} status={note.status} />
            : <span className="text-2xl font-mono text-gray-600">—</span>}
        </div>

        {/* Listening indicator */}
        {listeningState === 'listening' && !note && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Listening…
          </div>
        )}

        {/* Error */}
        {listeningState === 'error' && errorMessage && (
          <div className="text-center text-red-400 text-sm max-w-xs px-4 bg-red-950/40 rounded-xl py-3">
            {errorMessage}
          </div>
        )}

        {/* Temperament */}
        <div className="w-full pt-2">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 text-center mb-2">
            Temperament
          </p>
          <TemperamentSelector value={temperamentKey} onChange={handleTemperamentChange} />
        </div>
      </main>

      <footer className="w-full flex justify-center pb-2">
        <StartButton listeningState={listeningState} onStart={start} onStop={stop} />
      </footer>
    </div>
  )
}
