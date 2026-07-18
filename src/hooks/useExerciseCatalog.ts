import { useEffect, useState } from 'react'

// Play-Along exercise catalog, published by violin-music_private's
// generate-exercises-catalog.mjs to violin-music.github.io (same hosting as
// the tune catalog — see useTuneCatalog). The bundled exercise is always
// available as an offline/first-run fallback, so a failed fetch degrades to
// a working single-exercise picker rather than an error state.

const CATALOG_URL = 'https://violin-music.github.io/exercises-catalog.json'
const CACHE_KEY = 'giusto-exercise-catalog-cache-v1'
const BASE_URL = 'https://violin-music.github.io/'

export interface ExerciseCatalogEntry {
  id: string
  /** Path relative to BASE_URL, e.g. "exercises/Flesch-Arpeggios.ly" — or an
   *  absolute local path for bundled exercises. */
  file: string
  /** Which \score block of the file this entry plays (0-based). */
  scoreIndex: number
  title: string
  subtitle?: string
  category: string
  key: string
  timeSig: string | null
  bars: number
  hasChords: boolean
  bpm?: number
  tags: string[]
}

/** Ships with the app (public/exercises/) — always playable offline. */
const BUNDLED_EXERCISE_FILE = '/exercises/practice-arpeggios-Gm-Cm-F-Bb.ly'

export function exerciseIdFromFile(file: string): string {
  const filename = file.split('/').pop() ?? file
  return filename.replace(/\.ly$/i, '')
}

export const BUNDLED_EXERCISE: ExerciseCatalogEntry = {
  id: exerciseIdFromFile(BUNDLED_EXERCISE_FILE),
  file: BUNDLED_EXERCISE_FILE,
  scoreIndex: 0,
  title: 'Practice Arpeggios',
  category: 'Arpeggios',
  key: 'C',
  timeSig: '4/4',
  bars: 8,
  hasChords: true,
  tags: [],
}

export function exerciseUrl(entry: ExerciseCatalogEntry): string {
  return entry.file.startsWith('/') ? entry.file : BASE_URL + entry.file
}

// The selected exercise is stored as a full entry (not an id) so the last
// selection keeps working offline even before the catalog fetch resolves.
const SELECTED_KEY = 'giusto-playalong-exercise-v1'

export function readStoredExercise(): ExerciseCatalogEntry {
  try {
    const raw = localStorage.getItem(SELECTED_KEY)
    if (!raw) return BUNDLED_EXERCISE
    const stored = JSON.parse(raw) as ExerciseCatalogEntry
    // Migrate the original bundled ID so existing installations immediately
    // generate and display the new canonical share URL.
    return stored.id === 'bundled-practice-arpeggios' ? BUNDLED_EXERCISE : stored
  } catch {
    return BUNDLED_EXERCISE
  }
}

export function storeExercise(entry: ExerciseCatalogEntry): void {
  try {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(entry))
  } catch {
    /* best-effort */
  }
}

export interface ExerciseCatalogResult {
  /** Bundled exercise first, then the published catalog. */
  exercises: ExerciseCatalogEntry[]
  loading: boolean
  /** Set when the fetch failed AND no cache existed (bundled entry still works). */
  error: string | null
}

function readCache(): ExerciseCatalogEntry[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as ExerciseCatalogEntry[]) : null
  } catch {
    return null
  }
}

export function useExerciseCatalog(): ExerciseCatalogResult {
  const [remote, setRemote] = useState<ExerciseCatalogEntry[] | null>(readCache)
  const [loading, setLoading] = useState(remote === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(CATALOG_URL)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { exercises: ExerciseCatalogEntry[] }) => {
        if (cancelled) return
        setRemote(data.exercises)
        setLoading(false)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.exercises))
        } catch {
          /* cache is best-effort */
        }
      })
      .catch(err => {
        if (cancelled) return
        setLoading(false)
        // A stale cache (already in state) beats an error message.
        if (readCache() === null) setError(`Exercise catalog unavailable: ${err.message}`)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { exercises: [BUNDLED_EXERCISE, ...(remote ?? [])], loading, error }
}
