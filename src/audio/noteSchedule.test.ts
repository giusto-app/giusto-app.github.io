import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parseSource } from 'lilyjs'
import { buildNoteSchedule, noteEventIdsAtBeat } from './noteSchedule'
import type { ScoreLike } from 'lilyjs'

// Mixed rhythm: quarter, two eighths (sub-beat starts), rest, quarter | whole.
const WITNESS = `\\version "2.26.0"
\\score {
  \\new Staff { \\relative c'' { c4 d8 e8 r4 g4 | a1 } }
}
`

function parseScore(source: string): ScoreLike {
  const result = parseSource(source)
  const block = result.document?.blocks.find((b: { type: string }) => b.type === 'score') as
    | { score: ScoreLike }
    | undefined
  if (!block) throw new Error('source did not parse to a score')
  return block.score
}

describe('buildNoteSchedule', () => {
  const events = buildNoteSchedule(parseScore(WITNESS))

  test('lays notes and rests on the quarter-note beat grid', () => {
    expect(events.map(e => ({ start: e.startBeat, dur: e.durationBeats, rest: e.isRest }))).toEqual([
      { start: 0, dur: 1, rest: false },
      { start: 1, dur: 0.5, rest: false },
      { start: 1.5, dur: 0.5, rest: false },
      { start: 2, dur: 1, rest: true },
      { start: 3, dur: 1, rest: false },
      { start: 4, dur: 4, rest: false },
    ])
  })

  test('every event carries a rendered-SVG-compatible event id', () => {
    for (const e of events) {
      expect(e.eventId).toMatch(/^event-\d+$/)
    }
    expect(new Set(events.map(e => e.eventId)).size).toBe(events.length)
  })

  test('noteEventIdsAtBeat resolves sub-beat positions', () => {
    expect(noteEventIdsAtBeat(events, 0)).toEqual([events[0].eventId])
    expect(noteEventIdsAtBeat(events, 1.25)).toEqual([events[1].eventId])
    expect(noteEventIdsAtBeat(events, 1.5)).toEqual([events[2].eventId])
    expect(noteEventIdsAtBeat(events, 2.5)).toEqual([events[3].eventId]) // the rest
    expect(noteEventIdsAtBeat(events, 7.9)).toEqual([events[5].eventId])
    expect(noteEventIdsAtBeat(events, 8)).toEqual([]) // past the end
  })
})

describe('shipped Play-Along exercise', () => {
  test('yields 32 sounding notes covering all 8 bars', () => {
    const exercise = readFileSync(
      new URL('../../public/exercises/practice-arpeggios.ly', import.meta.url),
      'utf8',
    )
    const events = buildNoteSchedule(parseScore(exercise))
    expect(events).toHaveLength(32)
    expect(events.every(e => !e.isRest)).toBe(true)
    expect(events[0].startBeat).toBe(0)
    const last = events[events.length - 1]
    expect(last.startBeat + last.durationBeats).toBe(32) // 8 bars of 4/4
  })
})
