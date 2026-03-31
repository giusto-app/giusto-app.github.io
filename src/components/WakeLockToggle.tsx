interface WakeLockToggleProps { active: boolean; toggle: () => void }

export default function WakeLockToggle({ active, toggle }: WakeLockToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none w-full">
      <span className="text-sm text-gray-300">
        Don't lock the screen while I play
      </span>
      <button
        role="switch"
        aria-checked={active}
        onClick={toggle}
        className={[
          'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-all duration-200 focus:outline-none',
          active ? '' : 'neu-btn',
        ].join(' ')}
        style={active ? {
          background: '#10b981',
          boxShadow: 'inset -2px -2px 5px rgba(255,255,255,0.15), inset 2px 2px 5px rgba(0,0,0,0.30)',
        } : undefined}
      >
        <span
          className="pointer-events-none absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200"
          style={{ left: active ? 'calc(100% - 1.5rem)' : '0.25rem' }}
        />
      </button>
    </label>
  )
}
