import { useEffect } from 'react'
import { useDrone } from '../../hooks/useDrone'
import DroneControl from '../DroneControl'
import { type ConcertPitchHz } from '../../utils/concertPitch'

interface DroneTabProps {
  concertPitch: ConcertPitchHz
}

export default function DroneTab({ concertPitch }: DroneTabProps) {
  const { droneState, toggle, setPitchClass, setInterval, setVolume, stop } = useDrone()

  // Stop drone when tab unmounts
  useEffect(() => () => { stop() }, [stop])

  return (
    <div className="min-h-full flex flex-col py-6 px-4 md:px-10 gap-6">
      <header>
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-[color:var(--neu-fg2)]">
          Drone
        </h1>
      </header>

      <main className="flex flex-col gap-6 flex-1 justify-center max-w-sm md:max-w-none mx-auto w-full">

        {/* Fixed-height display — content swaps but height never changes */}
        <div className="h-44 flex flex-col items-center justify-center gap-1">
          {droneState.active ? (
            <>
              <span className="text-7xl font-bold text-[color:var(--neu-fg)] tracking-tight">
                {NOTE_NAMES[droneState.pitchClass]}
              </span>
              <span className="text-sm text-[color:var(--neu-fg2)] tracking-widest uppercase">
                {INTERVAL_LABELS[droneState.interval]}
              </span>
              <div className="mt-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-[color:var(--neu-fg2)]">Playing</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-[color:var(--neu-fg2)]">Select a note below to start the drone</p>
          )}
        </div>

        {/* Drone control — always expanded on this tab */}
        <DroneControl
          droneState={droneState}
          concertPitchHz={concertPitch}
          onToggle={toggle}
          onPitchClass={setPitchClass}
          onInterval={setInterval}
          onVolume={setVolume}
          alwaysExpanded
        />

        {/* Tip */}
        <div className="neu-surface rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[color:var(--neu-fg2)] mb-1.5">Tip</p>
          <p className="text-sm text-[color:var(--neu-fg2)] leading-relaxed">
            Play open strings against the drone first. Zero beating = your reference.
            Use <span className="font-mono text-[color:var(--neu-fg)]">5th</span> to sustain two strings at once (e.g. D+A).
          </p>
        </div>

      </main>
    </div>
  )
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const INTERVAL_LABELS: Record<string, string> = {
  unison: 'Unison',
  octave: 'Octave',
  fifth: 'Fifth',
}
