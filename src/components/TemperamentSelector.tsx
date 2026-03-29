import { TEMPERAMENT_KEYS, TEMPERAMENTS, type TemperamentKey } from '../utils/temperaments'

interface TemperamentSelectorProps {
  value: TemperamentKey
  onChange: (key: TemperamentKey) => void
}

export default function TemperamentSelector({ value, onChange }: TemperamentSelectorProps) {
  const selected = TEMPERAMENTS[value]

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* Pill row */}
      <div className="flex rounded-xl bg-gray-900 p-1 gap-1 w-full">
        {TEMPERAMENT_KEYS.map(key => {
          const t = TEMPERAMENTS[key]
          const isActive = key === value
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={[
                'flex-1 py-2.5 px-1 rounded-lg text-sm font-semibold transition-all active:scale-95 touch-none',
                isActive
                  ? 'bg-gray-700 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              {t.shortLabel}
            </button>
          )
        })}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 text-center leading-snug px-2 h-[4rem] overflow-hidden">
        {selected.description}
      </p>
    </div>
  )
}
