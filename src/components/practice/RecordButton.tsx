import type { RecorderState } from '../../hooks/useSessionRecorder'

interface RecordButtonProps {
  recorderState: RecorderState
  preCountdown: number
  countdown: number
  onStart: () => void
  onReset: () => void
}

const TOTAL_SECS = 10
const RADIUS = 30
const CIRC = 2 * Math.PI * RADIUS

export default function RecordButton({ recorderState, preCountdown, countdown, onStart, onReset }: RecordButtonProps) {
  if (recorderState === 'pre-countdown') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-20 flex items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10">
          <span className="text-4xl font-bold text-amber-400 tabular-nums">{preCountdown}</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (recorderState === 'recording') {
    const progress = (TOTAL_SECS - countdown) / TOTAL_SECS
    const dashOffset = CIRC * (1 - progress)
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Background ring */}
          <svg className="absolute inset-0 -rotate-90" width={80} height={80}>
            <circle cx={40} cy={40} r={RADIUS} fill="none" stroke="#374151" strokeWidth={4} />
            <circle
              cx={40} cy={40} r={RADIUS}
              fill="none"
              stroke="#ef4444"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.3s linear' }}
            />
          </svg>
          {/* Countdown number */}
          <span className="text-2xl font-bold text-red-400 tabular-nums">{countdown}</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (recorderState === 'done') {
    return (
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-6 py-3 rounded-full bg-gray-800 text-gray-300 font-semibold active:scale-95 transition-transform touch-none"
      >
        <RetryIcon />
        Try Again
      </button>
    )
  }

  // idle
  return (
    <button
      onClick={onStart}
      className="flex items-center gap-3 px-8 py-4 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white text-lg font-semibold transition-all touch-none shadow-lg shadow-red-900/40"
    >
      <RecordIcon />
      Record 10s
    </button>
  )
}

function RecordIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <circle cx={12} cy={12} r={8} />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  )
}
