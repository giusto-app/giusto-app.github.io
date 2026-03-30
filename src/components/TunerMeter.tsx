import { useRef } from 'react'
import { type TuningStatus } from '../utils/noteUtils'

interface TunerMeterProps {
  cents: number       // -50 to +50
  status: TuningStatus
}

const EMA_ALPHA = 0.08

function deviationColor(absCents: number): string {
  if (absCents <= 10) return '#34d399'  // emerald — in tune
  if (absCents <= 25) return '#eab308'  // amber — close
  return '#ef4444'                       // red — off
}

export default function TunerMeter({ cents, status }: TunerMeterProps) {
  const smoothed = useRef(cents)
  smoothed.current = smoothed.current * (1 - EMA_ALPHA) + cents * EMA_ALPHA

  const sc = Math.max(-50, Math.min(50, smoothed.current))
  const hasSignal = status !== 'out-of-tune' || Math.abs(cents) > 1
  const absSc = Math.abs(sc)
  const fillWidth = (absSc / 50) * 50  // 0–50% of bar width
  const isFlat = sc < -1.5
  const isSharp = sc > 1.5
  const color = deviationColor(absSc)
  const inTune = status === 'in-tune'

  // Dot left position as a percentage of the track width
  const dotLeft = isFlat ? `${50 - fillWidth}%` : `${50 + fillWidth}%`

  return (
    <div className="w-full select-none">

      {/* ── Main track ── */}
      <div className="relative w-full h-12 rounded-full bg-blue-950/80">

        {/* Permanent dim zone tints */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'linear-gradient(to right, #ef444430 0%, #ef444418 18%, transparent 35%, #34d39918 42%, #34d39930 50%, #34d39918 58%, transparent 65%, #ef444418 82%, #ef444430 100%)',
        }} />

        {/* Flat fill — extends leftward from center */}
        {hasSignal && isFlat && (
          <div
            className="absolute top-2 bottom-2 rounded-full"
            style={{
              right: '50%',
              width: `${fillWidth}%`,
              background: `linear-gradient(to left, ${color}, ${color}44)`,
              transition: 'width 80ms ease-out',
            }}
          />
        )}

        {/* Sharp fill — extends rightward from center */}
        {hasSignal && isSharp && (
          <div
            className="absolute top-2 bottom-2 rounded-full"
            style={{
              left: '50%',
              width: `${fillWidth}%`,
              background: `linear-gradient(to right, ${color}, ${color}44)`,
              transition: 'width 80ms ease-out',
            }}
          />
        )}

        {/* Center pivot line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/25 z-10" />

        {/* In-tune glow at center */}
        {inTune && hasSignal && (
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 rounded-full z-10"
            style={{ background: '#34d39950', boxShadow: '0 0 16px #34d399' }}
          />
        )}

        {/* Cursor dot — vertically centered using top+translate in inline style only */}
        {hasSignal && (isFlat || isSharp) && (
          <div
            className="absolute z-20 rounded-full"
            style={{
              width: 20,
              height: 20,
              top: '50%',
              left: dotLeft,
              transform: 'translate(-50%, -50%)',
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}, 0 0 3px #fff`,
              transition: 'left 80ms ease-out',
            }}
          />
        )}
      </div>

      {/* ── Scale labels ── */}
      <div className="flex justify-between text-sm text-gray-600 mt-2 px-0.5">
        <span>♭ −50¢</span>
        <span>−25¢</span>
        <span className="text-gray-500">0</span>
        <span>+25¢</span>
        <span>+50¢ ♯</span>
      </div>
    </div>
  )
}
