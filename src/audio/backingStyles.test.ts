import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import {
  allBackingMidis,
  backingNotesInWindow,
  buildEnsembleArrangement,
  buildBackingSchedule,
  prepareMidisByInstrument,
} from './backingStyles'

function witness(): Score {
  const src = `\\language "english"
    chordNames = \\chordmode { g1:m c1:m f1 bf1 }
    \\score {
      <<
        \\new ChordNames { \\chordNames }
        \\new Staff { \\relative c' { c1 c1 c1 c1 } }
      >>
    }`
  const doc = parseSource(src).document
  const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: Score } | undefined
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

  test('waltz: orchestral boom-chick-chick arrangement in 3/4', () => {
    // Gm held for TWO bars (g1. = 6 beats in 3/4), then Cm for one.
    const src = `\\language "english"
      chordNames = \\chordmode { g1.:m c2.:m }
      \\score {
        <<
          \\new ChordNames { \\chordNames }
          \\new Staff { \\time 3/4 \\relative c' { c2. c2. c2. } }
        >>
      }`
    const doc = parseSource(src).document
    const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: Score } | undefined
    const layers = buildEnsembleArrangement(block!.score, 'orchestra', 3)
    expect(layers.map((l) => l.instrument)).toEqual(['bass', 'pizzicato', 'strings'])

    const [bass, pizzicato, pad] = layers.map((l) => l.notes)
    // "Boom": double bass on beat 1 of every bar — root (G2=43) on the chord's
    // first bar, the fifth (D3=50) on its second, root (C2=36) at the change.
    expect(bass!.map((n) => [n.startBeat, n.midi])).toEqual([
      [0, 43],
      [3, 50],
      [6, 36],
    ])
    // "Chick-chick": pizzicato upper tones on beats 2 and 3 only.
    expect([...new Set(pizzicato!.map((n) => n.startBeat))]).toEqual([1, 2, 4, 5, 7, 8])
    expect(backingNotesInWindow(pizzicato!, 1, 2).map((n) => n.midi)).toEqual([58, 62])
    // Section pad: the same tones sustained softly across the harmony span.
    expect(pad!.every((n) => n.velocity < 40)).toBe(true)
    expect(backingNotesInWindow(pad!, 0, 1).map((n) => n.durationBeats)).toEqual([6, 6])
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
  const layers = buildEnsembleArrangement(witness(), 'gypsy', 4)

  test('two layers: double bass + guitar', () => {
    expect(layers.map((l) => l.instrument)).toEqual(['bass', 'guitarJazz'])
  })

  test('bass walks root-on-beat, fifth-off, in the low register', () => {
    const bass = layers.find((l) => l.instrument === 'bass')!.notes
    expect(bass).toHaveLength(16) // 4 chords × 4 beats
    // Gm bar: root G1 (31) on beat 0, fifth D2 (38) on beat 1. Velocity is
    // shaded per note (humanizeVelocity), so assert the band, not the digit.
    expect(bass.slice(0, 2).map((n) => [n.startBeat, n.durationBeats, n.midi]))
      .toEqual([[0, 0.9, 31], [1, 0.9, 38]])
    expect(bass.slice(0, 2).every((n) => Math.abs(n.velocity - 104) <= 4)).toBe(true)
  })

  test('guitar chops the chord every beat, off-beats accented', () => {
    const guitar = layers.find((l) => l.instrument === 'guitarJazz')!.notes
    expect(guitar).toHaveLength(48) // 4 chords × 4 beats × 3 tones
    // Beat 0 (on-beat): soft chop; beat 1 (off): strongly accented. What must
    // hold is the ACCENT, which the per-note shading (+/-4) must never invert.
    const onBeat = backingNotesInWindow(guitar, 0, 1)
    const offBeat = backingNotesInWindow(guitar, 1, 2)
    expect(onBeat.every((n) => Math.abs(n.velocity - 52) <= 4)).toBe(true)
    expect(offBeat.every((n) => Math.abs(n.velocity - 116) <= 4)).toBe(true)
    expect(Math.max(...onBeat.map((n) => n.velocity)))
      .toBeLessThan(Math.min(...offBeat.map((n) => n.velocity)))
  })
})

describe('every ensemble plays in every meter', () => {
  test('the groove follows the bar instead of hiding the ensemble', () => {
    // Gypsy jazz used to vanish on a 3/4 tune, and Waltz on a 4/4 one. An
    // ensemble is WHO PLAYS; the figure adapts, so none of them may be empty.
    for (const ensemble of ['orchestra', 'pizzicato', 'piano', 'gypsy'] as const) {
      for (const meter of [3, 4]) {
        const layers = buildEnsembleArrangement(witness(), ensemble, meter)
        expect(layers.length).toBeGreaterThan(0)
        expect(layers.every((l) => l.notes.length > 0)).toBe(true)
      }
    }
  })

  test('triple metre changes the figure, not the players', () => {
    const duple = buildEnsembleArrangement(witness(), 'gypsy', 4)
    const triple = buildEnsembleArrangement(witness(), 'gypsy', 3)
    expect(triple.map((l) => l.instrument)).toEqual(duple.map((l) => l.instrument))
    // The musette bass takes beat 1 alone; the duple pompe walks root-and-fifth
    // across the bar, so the same music yields more bass onsets in 4/4.
    const bassOnsets = (ls: ReturnType<typeof buildEnsembleArrangement>) =>
      ls.find((l) => l.instrument === 'bass')!.notes.length
    expect(bassOnsets(triple)).toBeLessThan(bassOnsets(duple))
  })
})

describe('prepareMidisByInstrument', () => {
  test('provides preload notes for each instrument', () => {
    const midis = prepareMidisByInstrument(witness())
    expect(midis.strings.length).toBeGreaterThan(0)
    expect(midis.bass).toContain(31) // G1 (gypsy pompe register)
    expect(midis.bass).toContain(43) // G2 (waltz boom register)
    expect(midis.guitarJazz.length).toBeGreaterThan(0)
    expect(midis.pizzicato.length).toBeGreaterThan(0)
    expect(midis.piano.length).toBeGreaterThan(0)
  })
})

describe('gypsy in 3/4 (valse musette)', () => {
  test('bass takes beat 1 alone; guitar chops beats 2 and 3', () => {
    const src = `\\language "english"
      chordNames = \\chordmode { g2.:m c2.:m }
      \\score {
        <<
          \\new ChordNames { \\chordNames }
          \\new Staff { \\time 3/4 \\relative c' { c2. c2. } }
        >>
      }`
    const doc = parseSource(src).document
    const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: Score } | undefined
    const layers = buildEnsembleArrangement(block!.score, 'gypsy', 3)
    const bass = layers.find((l) => l.instrument === 'bass')!.notes
    const guitar = layers.find((l) => l.instrument === 'guitarJazz')!.notes
    expect(bass.map((n) => n.startBeat)).toEqual([0, 3])
    expect([...new Set(guitar.map((n) => n.startBeat))]).toEqual([1, 2, 4, 5])
  })
})
