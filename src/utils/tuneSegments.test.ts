import { describe, expect, test } from 'bun:test'
import { planSegments } from './tuneSegments'

const ranges = (total: number, phrase?: number) =>
  planSegments(total, phrase).map(s => [s.startMeasure, s.endMeasure])

describe('planSegments', () => {
  test('a 12-bar tune matches the rule in the plan: phrases, then seams, then the whole', () => {
    // PLAN_PRACTICE_FEATURES.md gives 1-4, 5-8, 1-8, 5-12 as the shape.
    expect(ranges(12)).toEqual([
      [1, 4], [5, 8], [9, 12],   // phrases
      [1, 8], [5, 12],           // seams
      [1, 12],                   // whole tune
    ])
  })

  test('phrases come before seams — a new tune starts with the easiest cards', () => {
    const spans = planSegments(16).map(s => s.endMeasure - s.startMeasure + 1)
    const firstSeam = spans.indexOf(8)
    expect(spans.slice(0, firstSeam).every(n => n === 4)).toBe(true)
  })

  test('the trailing seam is dropped where it would just repeat the last phrase', () => {
    // 9-16 is a real seam; 13-16 would only restate the final phrase.
    expect(ranges(16)).toEqual([
      [1, 4], [5, 8], [9, 12], [13, 16],
      [1, 8], [5, 12], [9, 16],
      [1, 16],
    ])
  })

  test('a tune shorter than one phrase is a single full-tune card', () => {
    expect(planSegments(3)).toEqual([{ startMeasure: 1, endMeasure: 3, label: 'Full tune' }])
    expect(planSegments(1)).toEqual([{ startMeasure: 1, endMeasure: 1, label: 'Full tune' }])
  })

  test('exactly one phrase is also a single card, not a phrase plus a duplicate whole', () => {
    expect(ranges(4)).toEqual([[1, 4]])
  })

  test('an uneven tune clips the last phrase instead of running past the end', () => {
    expect(ranges(10)).toEqual([
      [1, 4], [5, 8], [9, 10],
      [1, 8], [5, 10],
      [1, 10],
    ])
    expect(ranges(10).every(([, end]) => end <= 10)).toBe(true)
  })

  test('two phrases: the seam IS the whole tune, emitted once', () => {
    expect(ranges(8)).toEqual([[1, 4], [5, 8], [1, 8]])
  })

  test('every range is emitted at most once', () => {
    for (const total of [1, 4, 5, 8, 9, 12, 13, 16, 31]) {
      const keys = ranges(total).map(r => r.join('-'))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  test('every bar of the tune is covered by at least one phrase card', () => {
    // The point of the whole exercise: no bar goes unlearned.
    for (const total of [3, 7, 12, 13, 30]) {
      const covered = new Set<number>()
      for (const s of planSegments(total)) {
        for (let m = s.startMeasure; m <= s.endMeasure; m++) covered.add(m)
      }
      expect(covered.size).toBe(total)
    }
  })

  test('labels read like a practice instruction', () => {
    const labels = planSegments(10).map(s => s.label)
    expect(labels).toContain('Bars 1–4')
    expect(labels).toContain('Bars 1–8')
    expect(labels).toContain('Full tune')
    // A one-bar tail is "Bar 9", never "Bars 9–9".
    expect(planSegments(9).map(s => s.label)).toContain('Bar 9')
  })

  test('"Full tune" is reserved for a segment that really covers the tune', () => {
    // Matches the label existing un-segmented cards already carry.
    const full = planSegments(12).filter(s => s.label === 'Full tune')
    expect(full).toHaveLength(1)
    expect(full[0]).toMatchObject({ startMeasure: 1, endMeasure: 12 })
  })

  test('a nonsense measure count yields no cards rather than throwing', () => {
    expect(planSegments(0)).toEqual([])
    expect(planSegments(-4)).toEqual([])
    expect(planSegments(Number.NaN)).toEqual([])
  })

  test('phrase length is adjustable for tunes that phrase in 8s', () => {
    expect(ranges(16, 8)).toEqual([[1, 8], [9, 16], [1, 16]])
  })
})
