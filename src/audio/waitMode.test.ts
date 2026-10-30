import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import { WaitTracker, waitNotes, waitNotesInWindow, type WaitNote } from './waitMode'

const score = (body: string): Score => {
  const doc = parseSource(`\\version "2.24.0"\n\\language "english"\n\\score { \\new Staff { \\time 4/4 ${body} } }`).document!
  return (doc.blocks.find((b) => b.type === 'score') as { score: Score }).score
}
const note = (midis: number[], startBeat: number): WaitNote => ({ eventId: `e${startBeat}`, midis, startBeat })

describe('waitNotes', () => {
  test('lists the violin line in order, a chord as its pitches, without rests', () => {
    const notes = waitNotes(score("g4 r4 <d' b'>2 | a'1"))
    expect(notes.map((n) => [n.midis, n.startBeat])).toEqual([[[55], 0], [[71, 62], 2], [[69], 4]])
    expect(waitNotesInWindow(notes, 2, 4).map((n) => n.startBeat)).toEqual([2])
    expect(waitNotesInWindow(notes, 2, null).map((n) => n.startBeat)).toEqual([2, 4])
  })
})

describe('WaitTracker', () => {
  test('waits for the right pitch, in tune, held long enough', () => {
    const t = new WaitTracker([note([67], 0), note([69], 1)], { holdMs: 200, toleranceCents: 25 })
    expect(t.hear(65, 0, 0)).toBe('waiting')        // wrong note
    expect(t.hear(67, 40, 10)).toBe('waiting')      // right note, out of tune
    expect(t.hear(67, 10, 20)).toBe('holding')
    expect(t.hear(67, 5, 150)).toBe('holding')
    expect(t.hear(67, 5, 220)).toBe('advanced')
    expect(t.current?.midis).toEqual([69])
  })

  test('a slip resets the hold', () => {
    const t = new WaitTracker([note([67], 0)], { holdMs: 200 })
    t.hear(67, 0, 0)
    t.hear(null, 0, 100)
    expect(t.hear(67, 0, 250)).toBe('holding')
    expect(t.hear(67, 0, 450)).toBe('done')
  })

  test('a repeated pitch needs a fresh attack, so one long note cannot pass two', () => {
    const t = new WaitTracker([note([67], 0), note([67], 1)], { holdMs: 100 })
    t.hear(67, 0, 0)
    expect(t.hear(67, 0, 100)).toBe('advanced')
    expect(t.hear(67, 0, 300)).toBe('waiting')       // still the same bow stroke
    t.hear(null, 0, 350)                             // the gap
    t.hear(67, 0, 400)
    expect(t.hear(67, 0, 500)).toBe('done')
  })

  test('a double stop is satisfied by either of its pitches', () => {
    const t = new WaitTracker([note([62, 74], 0)], { holdMs: 0 })
    expect(t.hear(74, 0, 0)).toBe('done')
  })

  test('with loop it starts over after the last note', () => {
    const t = new WaitTracker([note([67], 0), note([69], 1)], { holdMs: 0, loop: true })
    t.hear(67, 0, 0)
    expect(t.hear(69, 0, 10)).toBe('advanced')
    expect(t.current?.startBeat).toBe(0)
  })
})
