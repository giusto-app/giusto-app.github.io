import { describe, expect, test } from 'bun:test'
import {
  buildPlaybackTimelineFromScore,
  createArpeggioPlan,
  parseSource,
  type ArpeggiatorOptions,
  type PlaybackTimeline,
  type Score,
} from 'lilyjs'
import { arpeggioPlanToAir, buildArpeggioAir } from './arpeggioPlanToAir'

const qn = (num: number, den = 1) => ({ num, den })

function scoreWith(chordmode: string, staff = 'c1 c1 c1 c1'): string {
  return `\\language "english"
    chordNames = \\chordmode { ${chordmode} }
    \\score {
      <<
        \\new ChordNames { \\chordNames }
        \\new Staff { \\relative c' { ${staff} } }
      >>
    }`
}

const UP_QUARTERS: ArpeggiatorOptions = {
  pattern: 'up',
  subdivisionQN: qn(1),
  octaveSpan: 1,
}

function timelineFor(chordmode: string, staff?: string): PlaybackTimeline {
  const parsed = parseSource(scoreWith(chordmode, staff))
  const block = parsed.document?.blocks.find((b: { type: string }) => b.type === 'score') as
    | { score: Score }
    | undefined
  if (!block) throw new Error('no score block')
  return buildPlaybackTimelineFromScore(block.score)
}

describe('arpeggioPlanToAir — Gm–Cm–F–B♭ backing track', () => {
  const air = buildArpeggioAir(scoreWith('g1:m c1:m f1 bf1'), UP_QUARTERS)

  test('is an air/1 IR with exact total duration', () => {
    expect(air.schema).toBe('air/1')
    expect(air.durationQN).toEqual(qn(16))
  })

  test('carries structured harmony with spelling and pitch classes (no reparsed labels)', () => {
    expect(air.harmony).toHaveLength(4)
    expect(air.harmony.map((h) => h.root?.spelling)).toEqual(['G', 'C', 'F', 'Bb'])
    expect(air.harmony.map((h) => h.quality)).toEqual(['minor', 'minor', 'major', 'major'])
    expect(air.harmony.map((h) => h.pitchClasses)).toEqual([
      [7, 10, 2],
      [0, 3, 7],
      [5, 9, 0],
      [10, 2, 5],
    ])
    // B-flat keeps flat spelling while its chromatic class is 10.
    expect(air.harmony[3]!.root).toEqual({ midiClass: 10, spelling: 'Bb' })
    expect(air.harmony.every((h) => !h.isNoChord)).toBe(true)
  })

  test('emits one arpeggio part of exact-QN MIDI notes with harmony provenance', () => {
    expect(air.parts).toHaveLength(1)
    const part = air.parts[0]!
    expect(part.id).toBe('arpeggio')
    expect(part.role).toBe('arpeggio')
    expect(part.notes).toHaveLength(16)

    const firstBar = part.notes.slice(0, 4)
    // G minor 'up' from C3-anchored register: G3 B♭3 D4, wrapping to G3.
    expect(firstBar.map((n) => n.pitch)).toEqual([55, 58, 62, 55])
    expect(firstBar.map((n) => n.onsetQN)).toEqual([qn(0), qn(1), qn(2), qn(3)])
    expect(firstBar.every((n) => n.harmonyId === 'harmony-0')).toBe(true)
    expect(firstBar.every((n) => n.velocity === 72 && n.timingOffsetMs === 0)).toBe(true)
  })

  test('provides a conductor map for QN → seconds projection', () => {
    expect(air.conductor.barlines).toHaveLength(4)
    expect(air.conductor.barlines[0]!.startQN).toEqual(qn(0))
    expect(air.conductor.barlines[3]!.endQN).toEqual(qn(16))
    // Default tempo (no \tempo mark) is present as a segment.
    expect(air.conductor.tempo.length).toBeGreaterThanOrEqual(1)
  })
})

describe('arpeggioPlanToAir — contract', () => {
  test('no-chord spans produce a harmony span but no notes', () => {
    const air = buildArpeggioAir(scoreWith('c1:m r1 f1', 'c1 c1 c1'), UP_QUARTERS)
    expect(air.harmony.map((h) => h.isNoChord)).toEqual([false, true, false])
    expect(air.harmony[1]!.root).toBeNull()
    expect(air.harmony[1]!.quality).toBeNull()
    // Nothing is generated over the no-chord bar (silence).
    expect(air.parts[0]!.notes.some((n) => n.harmonyId === 'harmony-1')).toBe(false)
  })

  test('honors partId / role / velocity / scoreId options', () => {
    const air = buildArpeggioAir(scoreWith('c1'), UP_QUARTERS, {
      partId: 'bass',
      role: 'bassline',
      velocity: 96,
      scoreId: 'exercise-42',
    })
    expect(air.scoreId).toBe('exercise-42')
    expect(air.parts[0]!.id).toBe('bass')
    expect(air.parts[0]!.role).toBe('bassline')
    expect(air.parts[0]!.notes.every((n) => n.partId === 'bass' && n.velocity === 96)).toBe(true)
  })

  test('is deterministic: identical inputs → byte-identical IR', () => {
    const a = buildArpeggioAir(scoreWith('g1:m c1:m f1 bf1'), UP_QUARTERS)
    const b = buildArpeggioAir(scoreWith('g1:m c1:m f1 bf1'), UP_QUARTERS)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  test('does not mutate the source timeline', () => {
    const timeline = timelineFor('g1:m c1:m f1 bf1')
    const before = JSON.stringify(timeline)
    const plan = createArpeggioPlan(timeline, UP_QUARTERS)
    arpeggioPlanToAir(plan, timeline)
    expect(JSON.stringify(timeline)).toBe(before)
  })

  test('note count and duration scale with subdivision', () => {
    const air = buildArpeggioAir(scoreWith('c1', 'c1'), { pattern: 'up', subdivisionQN: qn(1, 2), octaveSpan: 1 })
    // One 4-QN bar at eighth-note subdivision = 8 attacks.
    expect(air.parts[0]!.notes).toHaveLength(8)
    expect(air.durationQN).toEqual(qn(4))
  })
})
