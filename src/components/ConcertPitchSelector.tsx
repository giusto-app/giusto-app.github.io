import { CONCERT_PITCH_PRESETS, type ConcertPitchHz } from '../utils/concertPitch'

interface ConcertPitchSelectorProps {
  value: ConcertPitchHz
  onChange: (hz: ConcertPitchHz) => void
}

export default function ConcertPitchSelector({ value, onChange }: ConcertPitchSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {CONCERT_PITCH_PRESETS.map(hz => (
        <button
          key={hz}
          onClick={() => onChange(hz)}
          className={[
            'px-2.5 py-1 rounded-full text-xs font-mono transition-colors',
            value === hz
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
          ].join(' ')}
        >
          {hz}
        </button>
      ))}
    </div>
  )
}
