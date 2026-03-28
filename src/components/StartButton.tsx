import { type ListeningState } from '../hooks/usePitchDetection'

interface StartButtonProps {
  listeningState: ListeningState
  onStart: () => void
  onStop: () => void
}

export default function StartButton({ listeningState, onStart, onStop }: StartButtonProps) {
  if (listeningState === 'listening') {
    return (
      <button
        onClick={onStop}
        className="flex items-center gap-2 px-8 py-4 rounded-full bg-gray-800 text-gray-300 text-lg font-semibold active:scale-95 transition-transform touch-none"
      >
        <span className="w-3 h-3 rounded-sm bg-gray-300" />
        Stop
      </button>
    )
  }

  return (
    <button
      onClick={onStart}
      className="flex items-center gap-3 px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-lg font-semibold transition-all touch-none shadow-lg shadow-emerald-900/40"
    >
      <MicIcon />
      Start Listening
    </button>
  )
}

function MicIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}
