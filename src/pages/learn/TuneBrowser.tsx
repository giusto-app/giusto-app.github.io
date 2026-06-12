import { useMemo, useState } from 'react'
import { useTuneCatalog, type TuneCatalogEntry } from '../../hooks/useTuneCatalog'

interface TuneBrowserProps {
  isAdded: (tuneId: string) => boolean
  onSelect: (tune: TuneCatalogEntry) => void
  onBack: () => void
}

const DIFFICULTIES = ['All', 'Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Professional']

export default function TuneBrowser({ isAdded, onSelect, onBack }: TuneBrowserProps) {
  const { tunes, loading, error } = useTuneCatalog()
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const [genre, setGenre] = useState('All')

  const genres = useMemo(() => {
    const set = new Set(tunes.map(t => t.category || t.genre).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [tunes])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return tunes.filter(t => {
      if (q && !t.title.toLowerCase().includes(q) && !t.composer.toLowerCase().includes(q)) return false
      if (difficulty !== 'All' && t.difficulty !== difficulty) return false
      if (genre !== 'All' && t.category !== genre && t.genre !== genre) return false
      return true
    })
  }, [tunes, query, difficulty, genre])

  return (
    <div className="min-h-full flex flex-col px-4 py-6 gap-4">
      <header className="flex items-center gap-3">
        <button onClick={onBack} className="neu-btn rounded-full p-2 text-[color:var(--neu-fg2)]">
          <ChevronLeft />
        </button>
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-[color:var(--neu-fg2)]">
          Browse Tunes
        </h1>
      </header>

      {/* Search */}
      <div className="neu-inset rounded-xl px-3 py-2 flex items-center gap-2">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search by title or composer…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[color:var(--neu-fg)] placeholder:text-[color:var(--neu-fg2)] outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[color:var(--neu-fg2)]">
            <XIcon />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <FilterRow label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        <FilterRow label="Genre" options={genres} value={genre} onChange={setGenre} />
      </div>

      {/* Results */}
      {loading && tunes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[color:var(--neu-fg2)]">Loading catalog…</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-400 text-center px-4">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          <p className="text-xs text-[color:var(--neu-fg2)]">{filtered.length} tunes</p>
          {filtered.map(tune => (
            <button
              key={tune.tune_folder}
              onClick={() => onSelect(tune)}
              className="neu-surface rounded-xl px-4 py-3 text-left flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[color:var(--neu-fg)] truncate">{tune.title}</span>
                  {isAdded(tune.tune_folder) && (
                    <span className="shrink-0 text-[10px] font-semibold text-emerald-400 neu-inset px-1.5 py-0.5 rounded-full">
                      In queue
                    </span>
                  )}
                </div>
                <p className="text-xs text-[color:var(--neu-fg2)]">
                  {tune.composer} · {tune.type} · {tune.key} · {tune.difficulty}
                </p>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterRow({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
      <span className="text-xs text-[color:var(--neu-fg2)] shrink-0 w-16">{label}</span>
      <div className="flex gap-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={[
              'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors neu-btn',
              value === opt
                ? 'neu-pill-active text-[color:var(--neu-fg)]'
                : 'text-[color:var(--neu-fg2)]',
            ].join(' ')}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="var(--neu-fg2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="var(--neu-fg2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="var(--neu-fg2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
