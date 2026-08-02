import { describe, expect, test } from 'bun:test'
import {
  BUNDLED_EXERCISE,
  exerciseIdFromFile,
  refreshedExercise,
  type ExerciseCatalogEntry,
} from './useExerciseCatalog'

describe('exerciseIdFromFile', () => {
  test('derives the canonical exercise id from a LilyPond filename', () => {
    expect(exerciseIdFromFile('/exercises/practice-arpeggios-Gm-Cm-F-Bb.ly')).toBe(
      'practice-arpeggios-Gm-Cm-F-Bb',
    )
  })

  test('keeps the bundled file basename and share id in sync', () => {
    expect(BUNDLED_EXERCISE.id).toBe(exerciseIdFromFile(BUNDLED_EXERCISE.file))
  })
})

describe('refreshedExercise', () => {
  const stored: ExerciseCatalogEntry = {
    id: 'merry-go-round-of-life',
    file: 'exercises/Merry-go-round_of_Life.ly',
    scoreIndex: 0,
    title: 'Merry-Go-Round of Life',
    category: 'Tunes',
    key: 'Bb',
    timeSig: '3/4',
    bars: 20,
    hasChords: true,
    bpm: 132,
    tags: [],
  }

  test('re-adopts an entry the catalog has since republished', () => {
    // A field added after the user last picked it — the whole reason the
    // stored snapshot must be reconciled rather than trusted.
    const fresh = { ...stored, backing: 'waltz' }
    expect(refreshedExercise(stored, [fresh])).toEqual(fresh)
  })

  test('returns null when the stored entry is already current', () => {
    expect(refreshedExercise(stored, [{ ...stored }])).toBeNull()
  })

  test('returns null for an entry the catalog no longer carries', () => {
    // Keeps a retired/offline selection playable instead of dropping it.
    expect(refreshedExercise(stored, [])).toBeNull()
  })
})
