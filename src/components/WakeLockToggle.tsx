import { useWakeLock } from '../hooks/useWakeLock'

export default function WakeLockToggle() {
  const { active, toggle, supported } = useWakeLock()

  if (!supported) return null

  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span className="text-sm text-gray-300">
        Prevent your screen from going dark while you play
      </span>
      <button
        role="switch"
        aria-checked={active}
        onClick={toggle}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
          active ? 'bg-amber-500' : 'bg-gray-600',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200',
            active ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </label>
  )
}
