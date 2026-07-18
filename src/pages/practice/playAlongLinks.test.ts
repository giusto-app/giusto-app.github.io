import { describe, expect, test } from 'bun:test'
import { playAlongExerciseIdFromHash, playAlongHash, playAlongUrl } from './playAlongLinks'

describe('Play-Along deep links', () => {
  test('round-trips exercise ids through the hash', () => {
    const id = 'scales/B-flat warmup'
    expect(playAlongExerciseIdFromHash(playAlongHash(id))).toBe(id)
  })

  test('ignores unrelated and malformed hashes', () => {
    expect(playAlongExerciseIdFromHash('#practice')).toBeNull()
    expect(playAlongExerciseIdFromHash('#learn')).toBeNull()
    expect(playAlongExerciseIdFromHash('#practice/%E0%A4%A')).toBeNull()
  })

  test('keeps the deployment path and query string in a shared URL', () => {
    expect(playAlongUrl('exercise-42', 'https://example.com/giusto/?theme=dark#practice')).toBe(
      'https://example.com/giusto/?theme=dark#practice/exercise-42',
    )
  })
})
