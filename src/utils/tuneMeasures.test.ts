import { describe, expect, test } from 'bun:test'
import { beatsPerBarFromTimeSig, measureCount, notesInMeasureRange } from './tuneMeasures'

/** n quarter notes, tagged so tests can identify which came back. */
const q = (count: number, tag = '') =>
  Array.from({ length: count }, (_, i) => ({ d: 1, id: `${tag}${i}` }))

describe('beatsPerBarFromTimeSig', () => {
  test('simple meters are their own beat count', () => {
    expect(beatsPerBarFromTimeSig('4/4')).toBe(4)
    expect(beatsPerBarFromTimeSig('3/4')).toBe(3)
  })

  test('compound and cut meters convert to quarter notes', () => {
    expect(beatsPerBarFromTimeSig('6/8')).toBe(3)   // a jig bar is 3 QN
    expect(beatsPerBarFromTimeSig('9/8')).toBe(4.5)
    expect(beatsPerBarFromTimeSig('2/2')).toBe(4)
  })

  test('whitespace is tolerated', () => {
    expect(beatsPerBarFromTimeSig(' 6 / 8 ')).toBe(3)
  })

  test('junk falls back to 4/4 rather than throwing', () => {
    // The caller has no better answer, and a crash helps nobody mid-practice.
    expect(beatsPerBarFromTimeSig('')).toBe(4)
    expect(beatsPerBarFromTimeSig(undefined)).toBe(4)
    expect(beatsPerBarFromTimeSig('common')).toBe(4)
    expect(beatsPerBarFromTimeSig('4/0')).toBe(4)
  })
})

describe('measureCount', () => {
  test('counts full bars', () => {
    expect(measureCount(q(16), 4)).toBe(4)
    expect(measureCount(q(12), 3)).toBe(4)
  })

  test('a partly filled last bar still counts — you have to play it', () => {
    expect(measureCount(q(14), 4)).toBe(4)
  })

  test('an empty tune has no bars', () => {
    expect(measureCount([], 4)).toBe(0)
  })

  test('a pickup does not add a bar of its own', () => {
    // One quarter of pickup then 16 quarters = 4 full bars, not 5.
    expect(measureCount(q(17), 4, 1)).toBe(4)
  })
})

describe('notesInMeasureRange', () => {
  test('takes the notes that start inside the range', () => {
    const notes = q(16, 'n')
    const bars1to2 = notesInMeasureRange(notes, 1, 2, 4)
    expect(bars1to2.map(n => n.id)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'])
  })

  test('a range in the middle of the tune', () => {
    const notes = q(16, 'n')
    expect(notesInMeasureRange(notes, 3, 3, 4).map(n => n.id)).toEqual(['n8', 'n9', 'n10', 'n11'])
  })

  test('a note held across the closing barline stays with the bar it began in', () => {
    // Bar 1: quarter + half. Bar 2 opens with a whole note tied past its end.
    const notes = [{ d: 1, id: 'a' }, { d: 2, id: 'b' }, { d: 1, id: 'c' }, { d: 8, id: 'long' }]
    expect(notesInMeasureRange(notes, 2, 2, 4).map(n => n.id)).toEqual(['long'])
  })

  test('uneven note lengths land in the right bars', () => {
    // 8 eighths = 1 bar of 4/4, then a quarter opens bar 2.
    const notes = [...Array.from({ length: 8 }, (_, i) => ({ d: 0.5, id: `e${i}` })), { d: 1, id: 'q' }]
    expect(notesInMeasureRange(notes, 1, 1, 4).map(n => n.id)).toEqual(
      ['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'],
    )
    expect(notesInMeasureRange(notes, 2, 2, 4).map(n => n.id)).toEqual(['q'])
  })

  test('a jig bar is three quarter notes, not six', () => {
    const notes = Array.from({ length: 12 }, (_, i) => ({ d: 0.5, id: `e${i}` }))
    // 6/8 -> 3 QN per bar -> 6 eighths per bar -> 2 bars.
    expect(measureCount(notes, beatsPerBarFromTimeSig('6/8'))).toBe(2)
    expect(notesInMeasureRange(notes, 2, 2, beatsPerBarFromTimeSig('6/8')).map(n => n.id))
      .toEqual(['e6', 'e7', 'e8', 'e9', 'e10', 'e11'])
  })

  test('pickup notes belong to the opening phrase', () => {
    const notes = [{ d: 1, id: 'pickup' }, ...q(8, 'n')]
    expect(notesInMeasureRange(notes, 1, 1, 4, 1).map(n => n.id))
      .toEqual(['pickup', 'n0', 'n1', 'n2', 'n3'])
  })

  test('THE FAILURE MODE: guessing pickupBeats=0 on a pickup tune shifts every bar', () => {
    // This is why pickupBeats is a parameter rather than an assumption. The same
    // tune, read with and without knowledge of its pickup, disagrees about what
    // "bar 2" contains — so a card labelled "bars 5-8" would drill bars 4-7.
    const notes = [{ d: 1, id: 'pickup' }, ...q(8, 'n')]
    const knowing = notesInMeasureRange(notes, 2, 2, 4, 1).map(n => n.id)
    const guessing = notesInMeasureRange(notes, 2, 2, 4, 0).map(n => n.id)
    expect(knowing).toEqual(['n4', 'n5', 'n6', 'n7'])
    expect(guessing).toEqual(['n3', 'n4', 'n5', 'n6'])
    expect(guessing).not.toEqual(knowing)
  })

  test('an inverted or empty range returns nothing rather than everything', () => {
    expect(notesInMeasureRange(q(8), 3, 1, 4)).toEqual([])
    expect(notesInMeasureRange([], 1, 4, 4)).toEqual([])
    expect(notesInMeasureRange(q(8), 1, 4, 0)).toEqual([])
  })
})
