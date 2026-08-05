import { useEffect } from 'react'
import { useDrone } from '../../hooks/useDrone'
import { useIsActiveTab } from '../../activeTab'
import DroneControl from '../../components/DroneControl'
import { type ConcertPitchHz } from '../../utils/concertPitch'

interface DroneTabProps {
  concertPitch: ConcertPitchHz
}

export default function DroneTab({ concertPitch }: DroneTabProps) {
  const { droneState, toggle, setPitchClass, toggleInterval, setVolume, shiftOctave, setSoundType, stop } = useDrone()
  const isDroneTabActive = useIsActiveTab('drone')

  // Stop drone when tab unmounts
  useEffect(() => () => { stop() }, [stop])

  // Space bar stops/restarts the drone. Scoped to the active tab — background
  // tabs stay mounted (App.tsx toggles `hidden`), see activeTab.ts.
  useEffect(() => {
    if (!isDroneTabActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      // Leave text entry alone — but NOT buttons: a note button keeps focus
      // after a click, and letting space re-activate it would fight the
      // transport toggle. preventDefault always.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          target?.isContentEditable) return
      e.preventDefault()
      toggle(concertPitch)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDroneTabActive, toggle, concertPitch])

  // Tanpura is a fixed octave-3 recording; every other voice sounds at 4 + offset.
  const currentOctave = droneState.soundType === 'tanpura' ? 3 : 4 + droneState.octaveOffset

  // Added intervals only sound on the synth voice; sample voices play the root.
  const intervalParts = droneState.soundType === 'sawtooth'
    ? [droneState.intervals.fifth ? '5th' : null, droneState.intervals.octave ? '8ve' : null].filter(Boolean)
    : []
  const intervalLabel = intervalParts.length > 0 ? `Root + ${intervalParts.join(' + ')}` : 'Unison'

  return (
    <div id="drone-tab" className="min-h-full flex flex-col py-6 px-4 md:px-10 gap-6">
      <header id="drone-tab-header">
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-[color:var(--neu-fg2)]">
          Drone
        </h1>
      </header>

      <main id="drone-tab-main" className="flex flex-col gap-6 flex-1 justify-center max-w-sm md:max-w-none mx-auto w-full">

        {/* Fixed-height display — content swaps but height never changes */}
        <div id="drone-display" className="h-44 flex flex-col items-center justify-center gap-1">
          {droneState.active ? (
            <>
              <div id="drone-note-display" className="flex items-baseline gap-1">
                <span className="text-7xl font-bold text-[color:var(--neu-fg)] tracking-tight">
                  {NOTE_NAMES[droneState.pitchClass]}
                </span>
                <span className="text-2xl font-semibold text-[color:var(--neu-fg2)]">
                  {currentOctave}
                </span>
              </div>
              <span className="text-sm text-[color:var(--neu-fg2)] tracking-widest uppercase">
                {intervalLabel}
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
          onToggleInterval={toggleInterval}
          onVolume={setVolume}
          onShiftOctave={shiftOctave}
          onSoundType={setSoundType}
          alwaysExpanded
        />

        {/* Tip */}
        <div id="drone-tip" className="neu-surface rounded-2xl px-4 py-3">
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
