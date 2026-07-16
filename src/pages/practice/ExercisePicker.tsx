import { useMemo, useState } from 'react'
import {
  useExerciseCatalog,
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
  onSelect: (entry: ExerciseCatalogEntry) => void
}

export default function ExercisePicker({ selectedId, onSelect }: ExercisePickerProps) {
  const { exercises, loading, error } = useExerciseCatalog()
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_KEY))
  const [activePill, setActivePill] = useState<string | null>(null)

  const categories = useMemo(
    () => [...new Set(exercises.map(e => e.category))],
    [exercises],
  )
  const recents = readIds(RECENTS_KEY)

  const pills = useMemo(() => {
    const list: string[] = []
    if (recents.some(id => exercises.some(e => e.id === id))) list.push('Recent')
    if (favorites.some(id => exercises.some(e => e.id === id))) list.push('Favorites')
    return [...list, ...categories]
  }, [recents, favorites, categories, exercises])

  const pill = activePill && pills.includes(activePill) ? activePill : pills[0]

  const visible = useMemo(() => {
    if (pill === 'Recent') {
      return recents
        .map(id => exercises.find(e => e.id === id))
        .filter((e): e is ExerciseCatalogEntry => e !== undefined)
    }
    if (pill === 'Favorites') return exercises.filter(e => favorites.includes(e.id))
    return exercises.filter(e => e.category === pill)
  }, [pill, exercises, recents, favorites])

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
    <div className="flex flex-col gap-2">
      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {pills.map(p => (
          <button
            key={p}
            onClick={() => setActivePill(p)}
            className={[
              'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
              p === pill ? 'bg-gray-700 text-gray-100' : 'bg-gray-800/60 text-gray-500 hover:text-gray-300',
            ].join(' ')}
          >
            {p}
          </button>
        ))}
        {loading && <span className="text-xs text-gray-600 self-center px-1">updating…</span>}
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
        {visible.map(e => (
          <div
            key={e.id}
            className={[
              'flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
              e.id === selectedId ? 'bg-gray-700/80' : 'bg-gray-800/40 hover:bg-gray-800',
            ].join(' ')}
          >
            <button onClick={() => onSelect(e)} className="flex-1 min-w-0 text-left">
              <div className="text-sm text-gray-200 truncate">{e.title}</div>
              <div className="text-xs text-gray-500 flex gap-2">
                {e.timeSig && <span>{e.timeSig}</span>}
                <span>{e.bars} bars</span>
                {e.hasChords && <span className="text-amber-400/80">drone</span>}
              </div>
            </button>
            <button
              onClick={() => toggleFavorite(e.id)}
              aria-label={favorites.includes(e.id) ? 'Unfavorite' : 'Favorite'}
              className={[
                'text-lg leading-none shrink-0 transition-colors',
                favorites.includes(e.id) ? 'text-amber-400' : 'text-gray-600 hover:text-gray-400',
              ].join(' ')}
            >
              {favorites.includes(e.id) ? '★' : '☆'}
            </button>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-xs text-gray-600 px-3 py-2">Nothing here yet.</div>
        )}
      </div>

      {error && <div className="text-xs text-gray-600">{error}</div>}
    </div>
  )
}
