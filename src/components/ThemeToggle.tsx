interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

export default function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <div className="neu-surface fixed top-4 right-4 z-50 flex rounded-full p-1 gap-0.5 select-none">
      <button
        onClick={() => !isDark && onToggle()}
        style={isDark ? { background: 'rgba(59,130,246,0.15)' } : undefined}
        className={[
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-widest uppercase transition-all duration-150',
          isDark
            ? 'neu-pill-active text-[color:var(--neu-fg)]'
            : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
        ].join(' ')}
      >
        <span className="text-base leading-none">🌙</span>
        <span className="hidden sm:inline">Dark</span>
      </button>
      <button
        onClick={() => isDark && onToggle()}
        style={!isDark ? { background: 'rgba(59,130,246,0.15)' } : undefined}
        className={[
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-widest uppercase transition-all duration-150',
          !isDark
            ? 'neu-pill-active text-[color:var(--neu-fg)]'
            : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
        ].join(' ')}
      >
        <span className="text-base leading-none">☀️</span>
        <span className="hidden sm:inline">Light</span>
      </button>
    </div>
  )
}
