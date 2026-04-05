import { useEffect, useState } from 'react'
import { type DroneInterval, type DroneSoundType, type DroneState } from '../hooks/useDrone'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const INTERVALS: { value: DroneInterval; label: string }[] = [
  { value: 'unison', label: '·' },
  { value: 'octave', label: '8ve' },
  { value: 'fifth',  label: '5th' },
]

const SOUND_TYPES: { value: DroneSoundType; label: string; title: string }[] = [
  { value: 'sawtooth', label: 'Drone',     title: 'Continuous synthesized drone' },
  { value: 'shruti',   label: 'Shruti',    title: 'Shruti box — warm bellows-driven reed drone' },
  { value: 'cello',    label: 'Cello',     title: 'Cello section sustain (VSCO2 CE, CC0)' },
]

interface DroneControlProps {
  droneState: DroneState
  concertPitchHz?: number
  onToggle: (concertPitchHz?: number) => void
  onPitchClass: (pc: number, concertPitchHz?: number) => void
  onInterval: (interval: DroneInterval, concertPitchHz?: number) => void
  onVolume: (v: number) => void
  onShiftOctave: (delta: number, concertPitchHz?: number) => void
  onSoundType: (type: DroneSoundType, concertPitchHz?: number) => void
  /** When true, controls are always shown and never auto-collapse */
  alwaysExpanded?: boolean
}

export default function DroneControl({
  droneState, concertPitchHz = 440,
  onToggle, onPitchClass, onInterval, onVolume, onShiftOctave, onSoundType,
  alwaysExpanded = false,
}: DroneControlProps) {
  const { active, pitchClass, interval, volume, octaveOffset, soundType } = droneState
  const [expanded, setExpanded] = useState(alwaysExpanded)
  const isShruti = soundType === 'shruti'
  const isSampleBased = soundType === 'cello' || soundType === 'shruti'

  // When not alwaysExpanded: auto-expand when drone turns on, collapse when off
  useEffect(() => {
    if (alwaysExpanded) return
    if (active) setExpanded(true)
    else setExpanded(false)
  }, [active, alwaysExpanded])

  return (
    <div id="drone-control" className="neu-surface rounded-2xl">

      {/* Header row: always visible */}
      <div id="drone-control-header" className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <DroneIcon active={active} />
          <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">
            Drone
          </span>
          {active && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle switch */}
          <button
            id="drone-toggle"
            role="switch"
            aria-checked={active}
            onClick={() => onToggle(concertPitchHz)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none"
            style={{ backgroundColor: active ? '#34d399' : 'rgba(128,128,128,0.25)' }}
            aria-label={active ? 'Turn drone off' : 'Turn drone on'}
          >
            <span
              className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: active ? 'translateX(26px)' : 'translateX(4px)' }}
            />
          </button>

          {/* Expand/collapse chevron — hidden when alwaysExpanded */}
          {!alwaysExpanded && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)] transition-colors"
              aria-label={expanded ? 'Collapse drone controls' : 'Expand drone controls'}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded controls */}
      {(alwaysExpanded || expanded) && (
        <div id="drone-control-body" className="px-3 pb-3 flex flex-col gap-3 border-t pt-3" style={{ borderColor: 'rgba(128,128,128,0.15)' }}>

          {/* Sound type selector */}
          <div id="drone-sound-type-row" className="flex items-center gap-2">
            <span className="text-xs text-[color:var(--neu-fg2)] shrink-0">Sound</span>
            <div id="drone-sound-type-buttons" className="flex gap-1">
              {SOUND_TYPES.map(({ value, label, title }) => (
                <button
                  key={value}
                  title={title}
                  onClick={() => onSoundType(value, concertPitchHz)}
                  className={[
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors neu-btn',
                    soundType === value
                      ? 'neu-pill-active text-[color:var(--neu-fg)]'
                      : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            {isShruti && (
              <span className="text-[10px] text-[color:var(--neu-fg2)] opacity-60 ml-1">
                reed · bellows · continuous
              </span>
            )}
          </div>

          {/* Note selector with octave shift buttons on each side */}
          <div id="drone-note-selector-row" className="flex items-center gap-2">

            {/* Octave down — vertical arrow ▼ + "oct" label, clearly distinct from notes */}
            <button
              id="drone-octave-down"
              onClick={() => onShiftOctave(-1, concertPitchHz)}
              disabled={octaveOffset <= -2}
              className="flex flex-col items-center justify-center gap-0.5 w-9 py-1.5 rounded-lg transition-colors neu-btn text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)] disabled:opacity-25 shrink-0 border border-[rgba(128,128,128,0.2)]"
              aria-label="Shift octave down"
            >
              <svg width={14} height={10} viewBox="0 0 14 10" fill="currentColor">
                <polygon points="0,0 14,0 7,10" />
              </svg>
              <span className="text-[9px] font-bold tracking-widest uppercase leading-none">oct</span>
            </button>

            {/* Note buttons */}
            <div id="drone-note-buttons" className="flex gap-1 flex-1 flex-wrap">
              {NOTE_NAMES.map((name, pc) => (
                <button
                  key={pc}
                  onClick={() => {
                    if (!active) {
                      onPitchClass(pc, concertPitchHz)
                      onToggle(concertPitchHz)
                    } else if (pitchClass === pc) {
                      onToggle(concertPitchHz)
                    } else {
                      onPitchClass(pc, concertPitchHz)
                    }
                  }}
                  className={[
                    'flex-1 min-w-[2rem] py-1.5 rounded-lg text-xs font-medium transition-colors neu-btn',
                    pitchClass === pc
                      ? active
                        ? 'neu-pill-active text-[color:var(--neu-fg)]'
                        : 'neu-pill-active text-[color:var(--neu-fg2)]'
                      : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
                    name.includes('#') ? 'text-[10px]' : '',
                  ].join(' ')}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Octave up — vertical arrow ▲ + "oct" label */}
            <button
              id="drone-octave-up"
              onClick={() => onShiftOctave(+1, concertPitchHz)}
              disabled={octaveOffset >= 2}
              className="flex flex-col items-center justify-center gap-0.5 w-9 py-1.5 rounded-lg transition-colors neu-btn text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)] disabled:opacity-25 shrink-0 border border-[rgba(128,128,128,0.2)]"
              aria-label="Shift octave up"
            >
              <svg width={14} height={10} viewBox="0 0 14 10" fill="currentColor">
                <polygon points="0,10 14,10 7,0" />
              </svg>
              <span className="text-[9px] font-bold tracking-widest uppercase leading-none">oct</span>
            </button>
          </div>

          {/* Interval + volume row */}
          <div id="drone-interval-volume-row" className="flex items-center gap-3">
            {/* Interval — disabled in tanpura mode (tanpura has its own fixed string pattern) */}
            <div
              id="drone-interval-buttons"
              className={['flex gap-1 shrink-0 transition-opacity', isSampleBased ? 'opacity-30 pointer-events-none' : ''].join(' ')}
              title={isSampleBased ? 'Interval not available in this mode' : undefined}
            >
              {INTERVALS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onInterval(value, concertPitchHz)}
                  className={[
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors neu-btn',
                    interval === value
                      ? 'neu-pill-active text-[color:var(--neu-fg)]'
                      : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Volume slider */}
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={volume}
              onChange={e => onVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-blue-500 cursor-pointer"
              aria-label="Drone volume"
            />
            <span className="text-xs text-[color:var(--neu-fg2)] w-7 text-right tabular-nums">
              {Math.round(volume * 100)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function DroneIcon({ active }: { active: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#34d399' : 'var(--neu-fg2)'} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}
