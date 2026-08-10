import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import { arpNotesInWindow, buildArpeggioSchedule } from './arpeggioSchedule'

const WITNESS = `\\language "english"
  chordNames = \\chordmode { g1:m c1:m f1 bf1 }
  \\score {
    <<
      \\new ChordNames { \\chordNames }
      \\new Staff { \\relative c' { c1 c1 c1 c1 } }
    >>
  }`

function witnessScore(): Score {
  const doc = parseSource(WITNESS).document
  const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as
    | { score: Score }
    | undefined
  if (!block) throw new Error('no score block')
  return block.score
}

describe('buildArpeggioSchedule', () => {
  test('up / eighths / 1 octave over Gm–Cm–F–B♭', () => {
    const notes = buildArpeggioSchedule(witnessScore(), { pattern: 'up', rhythm: 'eighth', octaves: 1 })
    // Four whole-note chords × eight eighth-note attacks = 32.
    expect(notes).toHaveLength(32)
    // First note: G3 (MIDI 55) at beat 0, half a beat long, default velocity.
    expect(notes[0]).toEqual({ startBeat: 0, durationBeats: 0.5, midi: 55, velocity: 72 })
    // G minor tones cycle G3 B♭3 D4: 55, 58, 62, then wrap.
    expect(notes.slice(0, 4).map((n) => n.midi)).toEqual([55, 58, 62, 55])
    // Attacks land on the eighth-note grid.
    expect(notes.slice(0, 4).map((n) => n.startBeat)).toEqual([0, 0.5, 1, 1.5])
  })

  test('pattern reverses the traversal', () => {
    const down = buildArpeggioSchedule(witnessScore(), { pattern: 'down', rhythm: 'eighth', octaves: 1 })
    // Gm 'down' starts on the highest tone D4 = 62.
    expect(down[0]!.midi).toBe(62)
  })

  test('rhythm sets the attack count per chord', () => {
    const quarters = buildArpeggioSchedule(witnessScore(), { pattern: 'up', rhythm: 'quarter', octaves: 1 })
    const sixteenths = buildArpeggioSchedule(witnessScore(), { pattern: 'up', rhythm: 'sixteenth', octaves: 1 })
    expect(quarters).toHaveLength(16) // 4 chords × 4 quarters
    expect(sixteenths).toHaveLength(64) // 4 chords × 16 sixteenths
  })

  test('octave span widens the register', () => {
    const oneOct = buildArpeggioSchedule(witnessScore(), { pattern: 'up', rhythm: 'eighth', octaves: 1 })
    const twoOct = buildArpeggioSchedule(witnessScore(), { pattern: 'up', rhythm: 'eighth', octaves: 2 })
    expect(Math.max(...twoOct.map((n) => n.midi))).toBeGreaterThan(Math.max(...oneOct.map((n) => n.midi)))
  })

  test('no chord track → empty schedule', () => {
    const doc = parseSource('\\score { \\relative c\' { c4 d e f } }').document
    const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: Score }
    expect(buildArpeggioSchedule(block.score, { pattern: 'up', rhythm: 'eighth', octaves: 1 })).toEqual([])
  })
})

describe('arpNotesInWindow', () => {
  const notes = buildArpeggioSchedule(
    (() => witnessScore())(),
    { pattern: 'up', rhythm: 'eighth', octaves: 1 },
  )

  test('returns the attacks starting inside one quarter-note beat', () => {
    // Beat [0,1) holds the eighth-note attacks at 0 and 0.5.
    const first = arpNotesInWindow(notes, 0, 1)
    expect(first.map((n) => n.startBeat)).toEqual([0, 0.5])
  })

  test('is half-open: a note exactly at toBeat belongs to the next window', () => {
    expect(arpNotesInWindow(notes, 0, 0.5).map((n) => n.startBeat)).toEqual([0])
  })
})
