import { useEffect, useState } from 'react'

const CATALOG_URL = 'https://violin-music.github.io/tunes-catalog.json'
const CACHE_KEY = 'giusto-catalog-cache-v1'
const BASE_URL = 'https://violin-music.github.io/'

export interface TuneCatalogEntry {
  title: string
  composer: string
  type: string
  key: string
  time_sig: string
  difficulty: string
  genre: string
  category: string
  genre_folder: string
  tune_folder: string
  svg: string
  midi: string
  svg_files: string[]
  midi_files: string[]
}

export interface TuneCatalogResult {
  tunes: TuneCatalogEntry[]
  loading: boolean
  error: string | null
}

// Full URLs for assets
export function svgUrl(tune: TuneCatalogEntry): string {
  return BASE_URL + tune.svg
}

export function midiUrl(tune: TuneCatalogEntry): string {
  return BASE_URL + tune.midi
}

export function notesUrl(tune: TuneCatalogEntry): string {
  return `${BASE_URL}tunes/${tune.genre_folder}/${tune.tune_folder}.notes.json`
}

export interface TuneNote {
  n:  string   // note name e.g. 'G', 'F#', 'Bb'
  o:  number   // octave e.g. 4
  pc: number   // pitch class 0–11
  d:  number   // duration in quarter-note units (0.5 = eighth)
}


export function useTuneCatalog(): TuneCatalogResult {
  const [tunes, setTunes] = useState<TuneCatalogEntry[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as { tunes: TuneCatalogEntry[] }
        return parsed.tunes ?? []
      }
    } catch { /* ignore */ }
    return []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(CATALOG_URL)
      .then(r => r.json())
      .then((data: { tunes: TuneCatalogEntry[] }) => {
        if (cancelled) return
        const freshTunes = data.tunes ?? []
        setTunes(freshTunes)
        setError(null)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ tunes: freshTunes })) } catch { /* quota */ }
      })
      .catch(err => {
        if (cancelled) return
        if (tunes.length === 0) setError('Could not load tune catalog. Check your connection.')
        else console.warn('Catalog refresh failed, using cached data:', err)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { tunes, loading, error }
}
