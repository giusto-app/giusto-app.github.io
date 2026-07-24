import { describe, expect, test } from 'bun:test'
import { parseSource, type ScoreLike } from 'lilyjs'
import {
  allBackingMidis,
  backingNotesInWindow,
  buildBackingArrangement,
  buildBackingSchedule,
  isStyleAvailable,
  prepareMidisByInstrument,
} from './backingStyles'

function witness(): ScoreLike {
  const src = `\\language "english"
    chordNames = \\chordmode { g1:m c1:m f1 bf1 }
    \\score {
      <<
        \\new ChordNames { \\chordNames }
        \\new Staff { \\relative c' { c1 c1 c1 c1 } }
      >>
    }`
  const doc = parseSource(src).document
  const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: ScoreLike } | undefined
  if (!block) throw new Error('no score block')
  return block.score
}

describe('buildBackingSchedule', () => {
  test('chords: every voiced tone held for the span', () => {
    const notes = buildBackingSchedule(witness(), 'chords')
    // 4 chords × 3 voiced tones.
    expect(notes).toHaveLength(12)
    // Gm block: G3 B♭3 D4, all starting at 0, lasting the whole bar.
    expect(notes.slice(0, 3)).toEqual([
      { startBeat: 0, durationBeats: 4, midi: 55, velocity: 64 },
      { startBeat: 0, durationBeats: 4, midi: 58, velocity: 64 },
      { startBeat: 0, durationBeats: 4, midi: 62, velocity: 64 },
    ])
  })

  test('pulse: whole chord struck on every beat', () => {
    const notes = buildBackingSchedule(witness(), 'pulse')
    // 4 chords × 4 beats × 3 tones.
    expect(notes).toHaveLength(48)
    // First beat of Gm: three tones at beat 0, ~0.9 beat long.
    expect(backingNotesInWindow(notes, 0, 1).map((n) => n.midi)).toEqual([55, 58, 62])
  })

  test('waltz: bass on the beat, upper tones on the off-beat', () => {
    const notes = buildBackingSchedule(witness(), 'waltz')
    const firstBeat = backingNotesInWindow(notes, 0, 1)
    // Beat 0.0 → bass (G3=55); beat 0.5 → upper tones (58, 62).
    expect(firstBeat.map((n) => [n.startBeat, n.midi])).toEqual([
      [0, 55],
      [0.5, 58],
      [0.5, 62],
    ])
  })

  test('arpeggio: sequential eighth-note tones', () => {
    const notes = buildBackingSchedule(witness(), 'arpeggio')
    expect(notes).toHaveLength(32) // 4 chords × 8 eighths
    expect(notes.slice(0, 3).map((n) => n.midi)).toEqual([55, 58, 62])
  })
})

describe('allBackingMidis', () => {
  test('covers the chord and arpeggio tones (deduped)', () => {
    const midis = allBackingMidis(witness())
    expect(midis).toContain(55) // G3
    expect(midis.length).toBe(new Set(midis).size)
  })
})

describe('gypsy jazz arrangement', () => {
  const layers = buildBackingArrangement(witness(), 'gypsy')

  test('two layers: double bass + guitar', () => {
    expect(layers.map((l) => l.instrument)).toEqual(['bass', 'guitar'])
  })

  test('bass walks root-on-beat, fifth-off, in the low register', () => {
    const bass = layers.find((l) => l.instrument === 'bass')!.notes
    expect(bass).toHaveLength(16) // 4 chords × 4 beats
    // Gm bar: root G1 (31) on beat 0, fifth D2 (38) on beat 1.
    expect(bass.slice(0, 2)).toEqual([
      { startBeat: 0, durationBeats: 0.9, midi: 31, velocity: 104 },
      { startBeat: 1, durationBeats: 0.9, midi: 38, velocity: 104 },
    ])
  })

  test('guitar chops the chord every beat, off-beats accented', () => {
    const guitar = layers.find((l) => l.instrument === 'guitar')!.notes
    expect(guitar).toHaveLength(48) // 4 chords × 4 beats × 3 tones
    // Beat 0 (on-beat): soft chop; beat 1 (off): strongly accented.
    expect(backingNotesInWindow(guitar, 0, 1).every((n) => n.velocity === 52)).toBe(true)
    expect(backingNotesInWindow(guitar, 1, 2).every((n) => n.velocity === 116)).toBe(true)
  })
})

describe('isStyleAvailable', () => {
  test('waltz only in 3/4; gypsy only in duple/quadruple', () => {
    expect(isStyleAvailable('waltz', 3)).toBe(true)
    expect(isStyleAvailable('waltz', 4)).toBe(false)
    expect(isStyleAvailable('gypsy', 4)).toBe(true)
    expect(isStyleAvailable('gypsy', 3)).toBe(false)
    // Meter-agnostic styles are always available.
    expect(isStyleAvailable('chords', 3)).toBe(true)
    expect(isStyleAvailable('arpeggio', 7)).toBe(true)
  })
})

describe('prepareMidisByInstrument', () => {
  test('provides preload notes for each instrument', () => {
    const midis = prepareMidisByInstrument(witness())
    expect(midis.strings.length).toBeGreaterThan(0)
    expect(midis.bass).toContain(31) // G1
    expect(midis.guitar.length).toBeGreaterThan(0)
  })
})
