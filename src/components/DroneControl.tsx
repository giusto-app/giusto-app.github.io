import { useEffect, useState } from 'react'
import { type DroneInterval, type DroneState } from '../hooks/useDrone'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const INTERVALS: { value: DroneInterval; label: string }[] = [
  { value: 'unison', label: '·' },
  { value: 'octave', label: '8ve' },
  { value: 'fifth',  label: '5th' },
]

interface DroneControlProps {
  droneState: DroneState
  concertPitchHz?: number
  onToggle: (concertPitchHz?: number) => void
  onPitchClass: (pc: number, concertPitchHz?: number) => void
  onInterval: (interval: DroneInterval, concertPitchHz?: number) => void
  onVolume: (v: number) => void
  /** When true, controls are always shown and never auto-collapse */
  alwaysExpanded?: boolean
}

export default function DroneControl({
  droneState, concertPitchHz = 440,
  onToggle, onPitchClass, onInterval, onVolume,
  alwaysExpanded = false,
}: DroneControlProps) {
  const { active, pitchClass, interval, volume } = droneState
  const [expanded, setExpanded] = useState(alwaysExpanded)

  // When not alwaysExpanded: auto-expand when drone turns on, collapse when off
  useEffect(() => {
    if (alwaysExpanded) return
    if (active) setExpanded(true)
    else setExpanded(false)
  }, [active, alwaysExpanded])

  return (
    <div className="neu-surface rounded-2xl">

      {/* Header row: always visible */}
      <div className="flex items-center justify-between px-3 py-2.5">
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
          {/* ON/OFF */}
          <button
            onClick={() => onToggle(concertPitchHz)}
            className={[
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors neu-btn',
              active
                ? 'text-[color:var(--neu-fg)] neu-pill-active'
                : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
            ].join(' ')}
          >
            {active ? 'ON' : 'OFF'}
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
        <div className="px-3 pb-3 flex flex-col gap-3 border-t pt-3" style={{ borderColor: 'rgba(128,128,128,0.15)' }}>
          {/* Note selector */}
          <div className="flex gap-1 flex-wrap">
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

          {/* Interval + volume row */}
          <div className="flex items-center gap-3">
            {/* Interval */}
            <div className="flex gap-1 shrink-0">
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
