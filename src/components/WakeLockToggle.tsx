interface WakeLockToggleProps { active: boolean; toggle: () => void }

export default function WakeLockToggle({ active, toggle }: WakeLockToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span className="text-sm text-gray-300">
        Don't lock the screen while I play
      </span>
      <button
        role="switch"
        aria-checked={active}
        onClick={toggle}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
          active ? 'bg-amber-500' : 'bg-blue-800/80',
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
