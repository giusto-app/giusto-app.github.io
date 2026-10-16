import { useEffect, useMemo, useRef, useState } from 'react'
import TunerMeter from '../../components/TunerMeter'
import CentsDisplay from '../../components/CentsDisplay'
import type { TuningStatus } from '../../utils/noteUtils'
import { nearestString, openStringTargets, type Instrument } from '../../utils/instruments'

/** A string counts as tuned once it stays within this many cents … */
const TUNED_CENTS = 3
/** … for this long. */
const TUNED_HOLD_MS = 1000
/** Moving-average weight of a new reading (usePitchDetection uses the same). */
const SMOOTHING = 0.08

const statusFor = (cents: number): TuningStatus =>
  Math.abs(cents) <= TUNED_CENTS ? 'in-tune' : Math.abs(cents) <= 10 ? 'close' : 'out-of-tune'

const formatOffset = (cents: number): string => {
  const r = Math.round(cents * 10) / 10
  if (Math.abs(r) < 0.05) return '±0¢'
  return `${r > 0 ? '+' : ''}${r.toFixed(1)}¢`
}

interface OpenStringsPanelProps {
  instrument: Instrument
  concertPitch: number
  /** The detected frequency, or null when nothing is sounding. */
  frequency: number | null
  listening: boolean
  onDone: () => void
}

/**
 * Open-string tuning: each string against its own target — pure fifths (or
 * fourths) from the reference A for bowed strings, equal temperament on guitar
 * or when playing with a piano. Guides the usual order (A first, then outward)
 * and marks a string tuned once it holds within ±3 ¢ for a second.
 */
export default function OpenStringsPanel({ instrument, concertPitch, frequency, listening, onDone }: OpenStringsPanelProps) {
  const [withPiano, setWithPiano] = useState(false)
  const [tuned, setTuned] = useState<Set<string>>(new Set())
  const holdRef = useRef<{ name: string; since: number } | null>(null)

  const targets = useMemo(
    () => openStringTargets(instrument, concertPitch, withPiano),
    [instrument, concertPitch, withPiano],
  )

  // A new instrument, pitch or tuning starts the strings over.
  useEffect(() => { setTuned(new Set()); holdRef.current = null }, [instrument, concertPitch, withPiano])

  const detected = frequency != null ? nearestString(frequency, targets) : null
  const current = detected ? targets[detected.index]! : null
  // Smoothed per string, as the pitch hook smooths its own cents (EMA 0.08):
  // raw per-frame cents jitter more than the ±3 ¢ the hold asks for.
  const smoothRef = useRef<{ name: string; cents: number } | null>(null)
  if (!detected || !current) smoothRef.current = null
  else if (smoothRef.current?.name !== current.name) smoothRef.current = { name: current.name, cents: detected.cents }
  else smoothRef.current = { name: current.name, cents: SMOOTHING * detected.cents + (1 - SMOOTHING) * smoothRef.current.cents }
  const cents = smoothRef.current?.cents ?? 0

  // Hold-to-confirm: within ±TUNED_CENTS for TUNED_HOLD_MS marks the string tuned.
  useEffect(() => {
    if (!current || Math.abs(cents) > TUNED_CENTS) { holdRef.current = null; return }
    const now = performance.now()
    if (holdRef.current?.name !== current.name) { holdRef.current = { name: current.name, since: now }; return }
    if (now - holdRef.current.since >= TUNED_HOLD_MS && !tuned.has(current.name)) {
      setTuned((prev) => new Set(prev).add(current.name))
    }
  }, [current, cents, tuned])

  const next = instrument.tuneOrder.find((name) => !tuned.has(name)) ?? null
  const allTuned = next === null

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Strings, lowest first */}
      <div className="flex w-full justify-center gap-2" role="list" aria-label="Open strings">
        {targets.map((t) => {
          const isCurrent = current?.name === t.name
          const isNext = next === t.name
          const isTuned = tuned.has(t.name)
          return (
            <div
              key={t.name}
              role="listitem"
              className={[
                'flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-14 border transition-colors',
                isCurrent ? 'border-blue-400 bg-blue-500/10' : 'border-gray-700',
                isNext && !isCurrent ? 'animate-pulse' : '',
              ].join(' ')}
            >
              <span className={['text-2xl font-bold', isTuned ? 'text-emerald-400' : 'text-gray-200'].join(' ')}>
                {t.name}{isTuned ? ' ✓' : ''}
              </span>
              <span className="text-[11px] font-mono text-gray-500 tabular-nums" title="Target vs equal temperament">
                {formatOffset(t.centsFromEqual)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Guidance */}
      <div className="h-6 text-sm text-gray-400 text-center">
        {!listening
          ? 'Tap Start Listening, then bow each open string'
          : allTuned
            ? 'All strings tuned'
            : current
              ? `${current.name} string — ${Math.abs(cents) <= TUNED_CENTS ? 'hold…' : cents > 0 ? 'lower it' : 'raise it'}`
              : `Play the ${next} string`}
      </div>

      <div className="w-full">
        <TunerMeter cents={cents} status={current ? statusFor(cents) : 'out-of-tune'} />
      </div>
      <div className="h-12 flex items-center">
        {current
          ? <CentsDisplay cents={cents} status={statusFor(cents)} />
          : <span className="text-4xl font-mono text-gray-600">—</span>}
      </div>

      {instrument.openTuning !== 'equal' && (
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={withPiano} onChange={(e) => setWithPiano(e.target.checked)} />
          Playing with piano (tempered {instrument.openTuning === 'pure-fourths' ? 'fourths' : 'fifths'})
        </label>
      )}

      {allTuned && (
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-4 py-2 text-sm font-semibold bg-emerald-600/80 text-white hover:bg-emerald-600"
        >
          Strings tuned ✓ — start playing →
        </button>
      )}
    </div>
  )
}
