import { describe, expect, test } from 'bun:test'
import { BUNDLED_EXERCISE, exerciseIdFromFile } from './useExerciseCatalog'

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
