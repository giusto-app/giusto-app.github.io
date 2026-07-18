import { describe, expect, test } from 'bun:test'
import { parseSource } from 'lilyjs'
import { buildChordSchedule, chordStartingAtBeat, parseChordLabel } from './chordSchedule'
import type { ScoreLike } from 'lilyjs'

const WITNESS = `\\version "2.26.0"
\\language "english"
chordNames = \\chordmode {
  g1:m | g1:m | c1:m | c1:m |
  f1   | f1   | bf1  | bf1  |
}

\\header { title = "Practice Arpeggios" }

simple_Arpeggios = \\relative c'' {
 | g 4  bf  d  g  bf   g  d  bf
 | c 4  ef  g  c  ef   c  g  ef
 \\break
 | f,4  a   c  f  a    f  c  a
 | bf4  d   f  bf  d    bf  f  d
}

\\score {
  <<
    \\new ChordNames { \\chordNames }
    \\new Staff { \\simple_Arpeggios }
  >>
  \\layout { }
  \\midi { }
}
`

function parseWitness(src: string): ScoreLike {
  const result = parseSource(src)
  const block = result.document?.blocks.find((b: { type: string }) => b.type === 'score') as
    | { score: ScoreLike }
    | undefined
  if (!block) throw new Error('witness did not parse to a score')
  return block.score
}

function witnessScore(): ScoreLike {
  return parseWitness(WITNESS)
}

describe('parseChordLabel', () => {
  test('minor', () => expect(parseChordLabel('Gm')).toEqual({ rootPc: 7, quality: 'min' }))
  test('flat major', () => expect(parseChordLabel('Bb')).toEqual({ rootPc: 10, quality: 'maj' }))
  test('plain major', () => expect(parseChordLabel('F')).toEqual({ rootPc: 5, quality: 'maj' }))
  test('sharp minor', () => expect(parseChordLabel('C#m')).toEqual({ rootPc: 1, quality: 'min' }))
  test('dominant 7', () => expect(parseChordLabel('G7')).toEqual({ rootPc: 7, quality: 'dom7' }))
  test('maj7 keeps major root', () =>
    expect(parseChordLabel('Cmaj7')).toEqual({ rootPc: 0, quality: 'maj' }))
  test('unicode flat', () => expect(parseChordLabel('B♭')).toEqual({ rootPc: 10, quality: 'maj' }))
  test('garbage returns null', () => expect(parseChordLabel('?!')).toBeNull())
})

describe('buildChordSchedule (Practice Arpeggios witness)', () => {
  test('merges repeated chords into 4 events at beats 0, 8, 16, 24', () => {
    const { events, totalBeats, beatsPerBar, bpm } = buildChordSchedule(witnessScore())
    expect(events).toHaveLength(4)
    expect(events.map(e => e.label)).toEqual(['Gm', 'Cm', 'F', 'Bb'])
    expect(events.map(e => e.startBeat)).toEqual([0, 8, 16, 24])
    expect(events.map(e => e.durationBeats)).toEqual([8, 8, 8, 8])
    expect(events.map(e => e.rootPc)).toEqual([7, 0, 5, 10])
    expect(events.map(e => e.quality)).toEqual(['min', 'min', 'maj', 'maj'])
    expect(totalBeats).toBe(32)
    expect(beatsPerBar).toBe(4)
    expect(bpm).toBeUndefined() // witness has no \tempo — UI default applies
  })

  test('chordStartingAtBeat fires only on change beats', () => {
    const { events } = buildChordSchedule(witnessScore())
    expect(chordStartingAtBeat(events, 0)?.label).toBe('Gm')
    expect(chordStartingAtBeat(events, 4)).toBeUndefined() // bar 2: same Gm, no re-articulation
    expect(chordStartingAtBeat(events, 8)?.label).toBe('Cm')
    expect(chordStartingAtBeat(events, 24)?.label).toBe('Bb')
  })
})

describe('buildChordSchedule (synthetic edge cases)', () => {
  const measure = (
    chords: Array<{ text: string; offsetQN?: number }>,
    beats = 4,
  ) => ({
    number: 1,
    timeSignature: { beats, beatUnit: 4 },
    expectedDurationQN: beats,
    chordSymbols: chords.map(c => ({
      text: c.text,
      eventId: null,
      // Parser convention: offset is a fraction of a WHOLE note (2 QN = 1/2).
      offset: { num: (c.offsetQN ?? 0) * 64, den: 256 },
    })),
  })

  test('mid-measure chord change uses the offset', () => {
    const score: ScoreLike = {
      parts: [{ id: 'p', measures: [measure([{ text: 'C' }, { text: 'G7', offsetQN: 2 }])] }],
    }
    const { events } = buildChordSchedule(score)
    expect(events.map(e => [e.label, e.startBeat, e.durationBeats])).toEqual([
      ['C', 0, 2],
      ['G7', 2, 2],
    ])
  })

  test('compound meter: 6/8 pulses on the dotted quarter and converts eighth-note tempo', () => {
    // Jig-style witness: \tempo 8 = 120 means QN bpm 60, and the metronome
    // pulse is the dotted quarter (1.5 QN), not three quarter clicks per bar.
    const src = `\\version "2.26.0"
\\score { <<
  \\new ChordNames { \\chordmode { d2. | d2. } }
  \\new Staff { \\time 6/8 \\tempo 8 = 120 \\relative c'' { d8 e f g a b | d, e f g a b } }
>> }
`
    const schedule = buildChordSchedule(parseWitness(src))
    expect(schedule.beatsPerBar).toBe(3)
    expect(schedule.pulseBeats).toBe(1.5)
    expect(schedule.bpm).toBe(60) // 120 eighths/min = 60 quarters/min
    expect(schedule.totalBeats).toBe(6)
  })

  test('dotted tempo units: \\tempo 4. = 84 (standard jig marking) → ♩ = 126', () => {
    const src = `\\version "2.26.0"
\\score {
  \\new Staff { \\time 6/8 \\tempo 4. = 84 \\relative c'' { d8 e f g a b } }
}
`
    expect(buildChordSchedule(parseWitness(src)).bpm).toBe(126)
  })

  test('REGRESSION: parser-produced mid-bar offsets are whole-note fractions', () => {
    // Real \chordmode source (not a synthetic fixture): d1 then a2 d2 must put
    // the final D on beat 6 (bar 2, beat 3), not beat 4.5.
    const src = `\\version "2.26.0"
\\score { <<
  \\new ChordNames { \\chordmode { d1 a2 d2 } }
  \\new Staff { \\relative c'' { d4 d d d | d d d d } }
>> }
`
    const { events } = buildChordSchedule(parseWitness(src))
    expect(events.map(e => [e.label, e.startBeat])).toEqual([
      ['D', 0],
      ['A', 4],
      ['D', 6],
    ])
  })

  test('note-attached chord symbols (eventId set) are ignored', () => {
    const score: ScoreLike = {
      parts: [
        {
          id: 'p',
          measures: [
            {
              number: 1,
              timeSignature: { beats: 4, beatUnit: 4 },
              expectedDurationQN: 4,
              chordSymbols: [{ text: 'Am', eventId: 'ev-1', offset: { num: 0, den: 1 } }],
            },
          ],
        },
      ],
    }
    expect(buildChordSchedule(score).events).toHaveLength(0)
  })
})
