import { useMemo, useState } from 'react'
import {
  type ExerciseCatalogEntry,
} from '../../hooks/useExerciseCatalog'

// Exercise picker for Play-Along: category pills → entry list, with Recents
// and Favorites pinned as pseudo-categories. Selection state lives in the
// parent (persisted); this component only owns favorites and the open pill.

const FAVORITES_KEY = 'giusto-playalong-favorites-v1'
const RECENTS_KEY = 'giusto-playalong-recents-v1'

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/** Called by the parent when an exercise is chosen, so Recents stay accurate. */
export function recordRecentExercise(id: string): void {
  const next = [id, ...readIds(RECENTS_KEY).filter(x => x !== id)].slice(0, 8)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* best-effort */
  }
}

interface ExercisePickerProps {
  selectedId: string
  exercises: ExerciseCatalogEntry[]
  loading: boolean
  error: string | null
  onSelect: (entry: ExerciseCatalogEntry) => void
  onClose: () => void
}

export default function ExercisePicker({
  selectedId,
  exercises,
  loading,
  error,
  onSelect,
  onClose,
}: ExercisePickerProps) {
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_KEY))
  const [activeFilter, setActiveFilter] = useState('All')
  const [query, setQuery] = useState('')

  const categories = useMemo(
    () => [...new Set(exercises.map(e => e.category))],
    [exercises],
  )
  const recents = useMemo(() => readIds(RECENTS_KEY), [])

  const filters = useMemo(() => {
    const shortcuts: string[] = ['All']
    if (recents.some(id => exercises.some(e => e.id === id))) shortcuts.push('Recent')
    if (favorites.some(id => exercises.some(e => e.id === id))) shortcuts.push('Favorites')
    return [...shortcuts, ...categories]
  }, [recents, favorites, categories, exercises])

  const visible = useMemo(() => {
    let filtered: ExerciseCatalogEntry[]
    if (activeFilter === 'Recent') {
      filtered = recents
        .map(id => exercises.find(e => e.id === id))
        .filter((e): e is ExerciseCatalogEntry => e !== undefined)
    } else if (activeFilter === 'Favorites') {
      filtered = exercises.filter(e => favorites.includes(e.id))
    } else if (activeFilter === 'All') {
      filtered = exercises
    } else {
      filtered = exercises.filter(e => e.category === activeFilter)
    }

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return filtered
    return filtered.filter(e => [e.title, e.subtitle, e.category, e.key, ...e.tags]
      .filter(Boolean)
      .some(value => value!.toLowerCase().includes(normalizedQuery)))
  }, [activeFilter, exercises, recents, favorites, query])

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Choose an exercise</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading ? 'Updating library...' : `${exercises.length} available`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3 rounded-md text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          Done
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by title, key, or category"
        aria-label="Search exercises"
        className="w-full h-10 rounded-md border border-gray-700 bg-gray-950/60 px-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-amber-400"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Exercise filters">
        {filters.map(filter => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            aria-pressed={filter === activeFilter}
            className={[
              'min-h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors',
              filter === activeFilter
                ? 'bg-amber-400 text-gray-950'
                : 'bg-gray-800/60 text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
        {visible.map(e => (
          <div
            key={e.id}
            className={[
              'flex items-stretch rounded-md border text-left transition-colors',
              e.id === selectedId
                ? 'border-amber-400/70 bg-amber-400/10'
                : 'border-transparent bg-gray-800/40 hover:border-gray-700 hover:bg-gray-800/70',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelect(e)}
              className="flex-1 min-w-0 px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200 truncate">{e.title}</span>
                {e.id === selectedId && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300 bg-amber-400/10">
                    Selected
                  </span>
                )}
              </div>
              {e.subtitle && <div className="text-xs text-gray-500 truncate mt-0.5">{e.subtitle}</div>}
              <div className="text-xs text-gray-500 flex gap-x-2 gap-y-0.5 flex-wrap mt-1">
                <span>{e.category}</span>
                {e.key && <span>Key {e.key}</span>}
                {e.timeSig && <span>{e.timeSig}</span>}
                <span>{e.bars} bars</span>
                {e.hasChords && <span className="text-amber-400/80">Chord drone</span>}
              </div>
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(e.id)}
              aria-label={favorites.includes(e.id) ? 'Unfavorite' : 'Favorite'}
              aria-pressed={favorites.includes(e.id)}
              className={[
                'w-11 shrink-0 text-lg leading-none transition-colors',
                favorites.includes(e.id) ? 'text-amber-400' : 'text-gray-600 hover:text-gray-400',
              ].join(' ')}
            >
              {favorites.includes(e.id) ? '★' : '☆'}
            </button>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-sm text-gray-500 text-center px-3 py-8">
            {query ? 'No exercises match that search.' : 'No exercises in this filter yet.'}
          </div>
        )}
      </div>

      {error && <div className="text-xs text-amber-400/80">Showing the offline exercise. {error}</div>}
    </div>
  )
}
