import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import {
  parseLy,
  parseDocument,
  stripComments,
  extractKey,
  extractTimeSig,
  extractTitle,
  parseDuration,
  parseChordMode,
} from '../src/parser.js'
import type { ParsedNote } from '../src/types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIVATE = '/Users/marc.mouries/projects/violin-music_private/tunes'

function readLy(genre: string, folder: string, filename?: string): string {
  const name = filename ?? `${folder}.ly`
  return readFileSync(`${PRIVATE}/${genre}/${folder}/${name}`, 'utf8')
}

function pitch(n: ParsedNote): string {
  return n.isRest ? 'R' : `${n.noteName}${n.octave}`
}

function pitches(notes: ParsedNote[], count?: number): string[] {
  const ns = count !== undefined ? notes.slice(0, count) : notes
  return ns.filter(n => !n.isRest).map(pitch)
}

// ── Unit: stripComments ───────────────────────────────────────────────────────

describe('stripComments', () => {
  it('removes line comments', () => {
    const result = stripComments('c4 % comment\nd4')
    expect(result).toContain('c4')
    expect(result).toContain('d4')
    expect(result).not.toContain('% comment')
  })

  it('removes block comments', () => {
    const result = stripComments('%{ block %}c4')
    expect(result).not.toContain('block')
    expect(result).toContain('c4')
  })

  it('handles nested block comments', () => {
    const result = stripComments('%{ outer %{ inner %} still %}d4')
    expect(result).toContain('d4')
    expect(result).not.toContain('outer')
    expect(result).not.toContain('inner')
  })

  it('leaves music notation intact', () => {
    const src = '\\key d \\major\ng8 e e b'
    const result = stripComments(src)
    expect(result).toBe(src)
  })
})

// ── Unit: extractKey ──────────────────────────────────────────────────────────

describe('extractKey', () => {
  it('extracts D major', () => {
    expect(extractKey('\\key d \\major')).toBe('D')
  })

  it('extracts E minor', () => {
    expect(extractKey('\\key e \\minor')).toBe('Em')
  })

  it('extracts D minor', () => {
    expect(extractKey('\\key d \\minor')).toBe('Dm')
  })

  it('extracts Bb major', () => {
    expect(extractKey('\\key bf \\major')).toBe('Bb')
  })

  it('extracts F# major', () => {
    expect(extractKey('\\key fs \\major')).toBe('F#')
  })

  it('extracts C major', () => {
    expect(extractKey('\\key c \\major')).toBe('C')
  })

  it('defaults to C when no key signature', () => {
    expect(extractKey('g8 e e b')).toBe('C')
  })
})

// ── Unit: extractTimeSig ──────────────────────────────────────────────────────

describe('extractTimeSig', () => {
  it('extracts 6/8', () => {
    expect(extractTimeSig('\\time 6/8')).toBe('6/8')
  })

  it('extracts 4/4', () => {
    expect(extractTimeSig('\\time 4/4')).toBe('4/4')
  })

  it('extracts 9/8', () => {
    expect(extractTimeSig('\\time 9/8')).toBe('9/8')
  })

  it('extracts 3/4', () => {
    expect(extractTimeSig('\\time 3/4')).toBe('3/4')
  })

  it('defaults to 4/4 when no time signature', () => {
    expect(extractTimeSig('g8 e e b')).toBe('4/4')
  })
})

// ── Unit: parseDuration ───────────────────────────────────────────────────────

describe('parseDuration', () => {
  it('whole note = 4 quarter units', () => {
    expect(parseDuration('1', 1)).toBe(4)
  })

  it('half note = 2', () => {
    expect(parseDuration('2', 1)).toBe(2)
  })

  it('quarter note = 1', () => {
    expect(parseDuration('4', 1)).toBe(1)
  })

  it('eighth note = 0.5', () => {
    expect(parseDuration('8', 1)).toBe(0.5)
  })

  it('sixteenth = 0.25', () => {
    expect(parseDuration('16', 1)).toBe(0.25)
  })

  it('dotted quarter = 1.5', () => {
    expect(parseDuration('4.', 1)).toBe(1.5)
  })

  it('dotted eighth = 0.75', () => {
    expect(parseDuration('8.', 1)).toBe(0.75)
  })

  it('double-dotted half = 3.5', () => {
    expect(parseDuration('2..', 1)).toBeCloseTo(3.5)
  })

  it('empty string returns previous duration', () => {
    expect(parseDuration('', 0.5)).toBe(0.5)
    expect(parseDuration('', 1)).toBe(1)
  })
})

// ── Unit: relative pitch resolution ──────────────────────────────────────────

describe('relative pitch resolution (via parseLy)', () => {
  it('resolves upward skip correctly', () => {
    // \relative c' { c e g }  →  C4 E4 G4
    const src = `melody = \\relative c' { c e g } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(pitches(notes)).toEqual(['C4', 'E4', 'G4'])
  })

  it('resolves downward skip correctly', () => {
    // \relative c'' { c a f }  →  C5 A4 F4
    const src = `melody = \\relative c'' { c a f } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(pitches(notes)).toEqual(['C5', 'A4', 'F4'])
  })

  it("resolves b' (explicit octave up) inside \\relative", () => {
    // \relative c'' { g e e b' e, e }  →  G4 E4 E4 B4 E4 E4
    const src = `melody = \\relative c'' { g e e b' e, e } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(pitches(notes)).toEqual(['G4', 'E4', 'E4', 'B4', 'E4', 'E4'])
  })

  it('wraps from G to C above (nearest-neighbor)', () => {
    // c'' = C5; g relative to C5 → G4 (3 steps down); c relative to G4 → C5 (3 steps up)
    const src = `melody = \\relative c'' { g c } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(pitches(notes)).toEqual(['G4', 'C5'])
  })

  it('wraps from C to B below (nearest-neighbor)', () => {
    // prev=C5, next=b → B4 (1 semitone down) not B5 (11 up)
    const src = `melody = \\relative c'' { c b } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(pitches(notes)).toEqual(['C5', 'B4'])
  })
})

// ── Unit: enharmonic spelling ─────────────────────────────────────────────────

describe('enharmonic spelling', () => {
  it('spells fs as F#', () => {
    const src = `melody = \\relative c'' { fs } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes[0]?.noteName).toBe('F#')
  })

  it('spells bf as Bb', () => {
    const src = `melody = \\relative c' { bf } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes[0]?.noteName).toBe('Bb')
  })

  it('spells cs as C#', () => {
    const src = `melody = \\relative c'' { cs } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes[0]?.noteName).toBe('C#')
  })

  it('spells ef as Eb', () => {
    const src = `melody = \\relative c' { ef } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes[0]?.noteName).toBe('Eb')
  })
})

// ── Unit: structural constructs ───────────────────────────────────────────────

describe('\\repeat volta', () => {
  it('emits body once (viewer renders repeats via repeatRegions markers)', () => {
    // The parser uses a marker-based architecture: body is emitted once, bracketed by
    // \x00repeatStart / \x00repeatEnd markers. The viewer handles visual repeat brackets
    // and voltaBrackets. The notes array contains only real pitches (no duplicates).
    const src = `melody = \\relative c' { \\repeat volta 2 { c d } } \\score { \\new Staff { \\melody } }`
    const { notes, repeatRegions } = parseLy(src)
    expect(pitches(notes)).toEqual(['C4', 'D4'])
    // repeat region spans the body
    expect(repeatRegions).toBeDefined()
    expect(repeatRegions!.length).toBeGreaterThanOrEqual(1)
  })

  it('splices endings with \\alternative (body once + each ending once)', () => {
    // Parser emits: body, then volta1 ending, then volta2 ending — each once.
    // voltaRegions records which note indices belong to each ending.
    const src = `melody = \\relative c' {
      \\repeat volta 2 { c d }
      \\alternative { { e } { f } }
    } \\score { \\new Staff { \\melody } }`
    const { notes, voltaRegions } = parseLy(src)
    expect(pitches(notes)).toEqual(['C4', 'D4', 'E4', 'F4'])
    expect(voltaRegions).toBeDefined()
    expect(voltaRegions!.length).toBe(2)
  })
})

describe('\\tempo', () => {
  it('\\tempo "Swing" stores text in tempoMarks', () => {
    const src = `melody = \\relative c' { \\tempo "Swing" c4 d } \\score { \\new Staff { \\melody } }`
    const { tempoMarks } = parseLy(src)
    expect(tempoMarks).toBeDefined()
    expect(tempoMarks![0]!.text).toBe('Swing')
    expect(tempoMarks![0]!.noteIndex).toBe(0)
  })

  it('\\tempo 4=120 stores bpm and beatDuration', () => {
    const src = `melody = \\relative c' { \\tempo 4=120 c4 d } \\score { \\new Staff { \\melody } }`
    const { tempoMarks } = parseLy(src)
    expect(tempoMarks).toBeDefined()
    expect(tempoMarks![0]!.bpm).toBe(120)
    expect(tempoMarks![0]!.beatDuration).toBe(4)
    expect(tempoMarks![0]!.text).toBeUndefined()
  })

  it('\\tempo "Allegro" 4=160 stores both text and bpm', () => {
    const src = `melody = \\relative c' { \\tempo "Allegro" 4=160 c4 d } \\score { \\new Staff { \\melody } }`
    const { tempoMarks } = parseLy(src)
    expect(tempoMarks![0]!.text).toBe('Allegro')
    expect(tempoMarks![0]!.bpm).toBe(160)
  })

  it('mid-piece \\tempo change records correct noteIndex', () => {
    const src = `melody = \\relative c' { \\tempo "Fast" c4 d e f \\tempo "Slow" g4 } \\score { \\new Staff { \\melody } }`
    const { tempoMarks } = parseLy(src)
    expect(tempoMarks).toHaveLength(2)
    expect(tempoMarks![0]!.text).toBe('Fast')
    expect(tempoMarks![0]!.noteIndex).toBe(0)
    expect(tempoMarks![1]!.text).toBe('Slow')
    expect(tempoMarks![1]!.noteIndex).toBe(4)
  })

  it('notes are not affected — real pitch count unchanged', () => {
    const src = `melody = \\relative c' { \\tempo "Andante" c4 d e f } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes.filter(n => !n.isRest)).toHaveLength(4)
  })
})

describe('\\tuplet', () => {
  it('scales durations: \\tuplet 3/2 { c8 d e } → duration 1/3 each', () => {
    const src = `melody = \\relative c' { \\tuplet 3/2 { c8 d e } } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes.filter(n => !n.isRest)).toHaveLength(3)
    // Each note: base 8th = 0.5; scaled by 2/3 ≈ 0.333
    notes.filter(n => !n.isRest).forEach(n => {
      expect(n.duration).toBeCloseTo(0.5 * (2 / 3))
    })
  })
})

describe('grace notes', () => {
  it('\\appoggiatura emits grace note with isGrace=true', () => {
    const src = `melody = \\relative c'' {
      c \\appoggiatura { d16 } c
    } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    // 3 notes total: C5, grace D5, C5
    expect(notes).toHaveLength(3)
    expect(notes[1]?.isGrace).toBe(true)
    expect(notes[1]?.duration).toBe(0)
    // Only 2 non-grace notes
    const real = notes.filter(n => !n.isGrace)
    expect(pitches(real)).toEqual(['C5', 'C5'])
  })

  it('grace notes do not shift relative pitch context', () => {
    // After g4, appoggiatura fs16 should not affect the context for the following e
    const src = `melody = \\relative c'' {
      g \\appoggiatura { fs16 } e
    } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    // e after g should be E4 (nearest), not shifted by the appoggiatura
    const real = notes.filter(n => !n.isGrace)
    expect(pitches(real)).toEqual(['G4', 'E4'])
  })
})

describe('chords', () => {
  it('picks the highest note from a chord', () => {
    // <e' g b> → B4 is highest
    const src = `melody = \\relative c' { <e g b> } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    const real = notes.filter(n => !n.isRest)
    expect(real).toHaveLength(1)
    expect(real[0]?.noteName).toBe('B')
  })
})

describe('rests', () => {
  it('emits rest notes with isRest=true', () => {
    const src = `melody = \\relative c' { c4 r4 d4 } \\score { \\new Staff { \\melody } }`
    const { notes } = parseLy(src)
    expect(notes).toHaveLength(3)
    expect(notes[1]?.isRest).toBe(true)
    expect(notes[0]?.isRest).toBe(false)
  })
})

// ── Integration: real .ly files ───────────────────────────────────────────────

describe('Integration: Swallowtail Jig', () => {
  const src = readLy('Folk_Ireland', 'Swallowtail-Jig')
  const { key, timeSig, notes } = parseLy(src)
  // Filter out marker notes (\x00...) but keep rests for accurate index counting
  const melody = notes.filter(n => !n.isRest && !n.noteName.startsWith('\x00'))

  it('extracts key = Em (\\key e \\minor in global variable)', () => expect(key).toBe('Em'))
  it('extracts timeSig = 6/8', () => expect(timeSig).toBe('6/8'))

  it('starts with pickup bar e4 fs8 then bar 1: g e e b e e', () => {
    // \partial 4. e4(\upbow fs8) → E4 F#4 (pickup)
    // Bar 1: g8 e e b' e, e → G4 E4 E4 B4 E4 E4
    expect(pitches(melody, 8)).toEqual([
      'E4', 'F#4',           // pickup bar
      'G4', 'E4', 'E4', 'B4', 'E4', 'E4',  // bar 1
    ])
  })

  it('contains F# (not Gb) — D major key context', () => {
    // Bar 3 starts at index 14: fs d d a' d, d → F#4 D4 D4 A4 D4 D4
    const bar3 = pitches(melody, 20).slice(14, 20)
    expect(bar3).toEqual(['F#4', 'D4', 'D4', 'A4', 'D4', 'D4'])
  })

  it('produces a reasonable total note count (≥ 60)', () => {
    expect(melody.length).toBeGreaterThanOrEqual(60)
  })
})

describe("Integration: Paddy Fahey's Jig", () => {
  const src = readLy('Folk_Ireland', "Paddy-Fahey's-Jig")
  const { key, timeSig, notes } = parseLy(src)
  const melody = notes.filter(n => !n.isRest)

  it('extracts key = Dm', () => expect(key).toBe('Dm'))
  it('extracts timeSig = 6/8', () => expect(timeSig).toBe('6/8'))

  it('first 8 notes contain Bb (not A#)', () => {
    // d g a bf c c bf c
    expect(pitches(melody, 8)).toEqual(['D4', 'G4', 'A4', 'Bb4', 'C5', 'C5', 'Bb4', 'C5'])
  })
})

describe('Integration: The Butterfly', () => {
  const src = readLy('Folk_Ireland', 'The-Butterfly')
  const { key, timeSig, notes } = parseLy(src)
  const melody = notes.filter(n => !n.isRest)

  it('extracts key = Em', () => expect(key).toBe('Em'))
  it('extracts timeSig = 9/8', () => expect(timeSig).toBe('9/8'))

  it('first 4 notes are B4 E4 G4 E4 (appoggiatura skipped)', () => {
    // b4 e,8 (g4-) e8 (\appoggiatura {fs16 g} fs4.-)
    // relative c'': b=B4, e,=E4, g=G4, e=E4
    expect(pitches(melody, 4)).toEqual(['B4', 'E4', 'G4', 'E4'])
  })

  it('produces a reasonable total note count (≥ 40)', () => {
    expect(melody.length).toBeGreaterThanOrEqual(40)
  })
})

describe('Integration: Auld Lang Syne', () => {
  const src = readLy('Folk_Scotland', 'Auld-Lang-Syne', 'Auld-Lang-Syne_(in-D).ly')
  const { key, timeSig, notes } = parseLy(src)
  const melody = notes.filter(n => !n.isRest)

  it('extracts key = D', () => expect(key).toBe('D'))
  it('extracts timeSig = 4/4', () => expect(timeSig).toBe('4/4'))

  it('first non-rest note is A4', () => {
    // r2. a4  →  first real note is A4
    expect(melody[0]?.noteName).toBe('A')
    expect(melody[0]?.octave).toBe(4)
  })

  it('second note is D5', () => {
    // d4. d8  →  D5 (relative from A4: D is above A)
    expect(melody[1]?.noteName).toBe('D')
    expect(melody[1]?.octave).toBe(5)
  })
})

// ── Ties ─────────────────────────────────────────────────────────────────────
describe('Ties', () => {
  function parseTies(ly: string) {
    const src = `\\version "2.24.0" \\language "english"
\\header { title = "T" }
melody = \\relative c'' { \\time 4/4 \\key c \\major ${ly} }
\\score { \\new Staff { \\melody } }`
    return parseLy(src).notes.filter(n => !n.isRest)
  }

  it('tieStart is set on first note of c2 ~ c2', () => {
    const notes = parseTies('c2 ~ c2')
    expect(notes[0]?.tieStart).toBe(true)
    expect(notes[0]?.tieEnd).toBeUndefined()
  })

  it('tieEnd is set on second note of c2 ~ c2', () => {
    const notes = parseTies('c2 ~ c2')
    expect(notes[1]?.tieEnd).toBe(true)
    expect(notes[1]?.tieStart).toBeUndefined()
  })

  it('chain of three tied notes sets tieStart and tieEnd correctly', () => {
    const notes = parseTies('f2 ~ f4 ~ f4')
    expect(notes[0]?.tieStart).toBe(true)
    expect(notes[0]?.tieEnd).toBeUndefined()
    expect(notes[1]?.tieEnd).toBe(true)
    expect(notes[1]?.tieStart).toBe(true)
    expect(notes[2]?.tieEnd).toBe(true)
    expect(notes[2]?.tieStart).toBeUndefined()
  })

  it('untied notes have no tieStart or tieEnd', () => {
    const notes = parseTies('c4 d4 e4 f4')
    for (const n of notes) {
      expect(n.tieStart).toBeUndefined()
      expect(n.tieEnd).toBeUndefined()
    }
  })

  it('tie across barline: all of me pattern e4 ~ e2 ~ e1', () => {
    const notes = parseTies('e4 ~ e2 ~ | e1')
    expect(notes[0]?.tieStart).toBe(true)
    expect(notes[1]?.tieEnd).toBe(true)
    expect(notes[1]?.tieStart).toBe(true)
    expect(notes[2]?.tieEnd).toBe(true)
  })
})

// ── parseDocument ─────────────────────────────────────────────────────────────

describe('parseDocument', () => {
  const singleScore = `
\\version "2.24.0"
\\language "english"
\\header { title = "Test" }
melody = \\relative c' {
  \\time 4/4 \\key g \\major
  g4 a b c
}
\\score { \\new Staff { \\melody } }
`

  const multiScore = `
\\version "2.24.0"
\\language "english"
\\header { title = "Multi" }
\\paper { ragged-last = ##t  indent = 0 }

first = \\relative c' { \\time 4/4 \\key c \\major  c4 d e f }
second = \\relative c'' { \\time 3/4 \\key g \\major  g4 a b }

\\markup \\bold "Section A"
\\score { \\new Staff { \\first } }

\\markup \\bold "Section B"
\\score { \\new Staff { \\second } }
`

  it('returns one score block for a single-score file', () => {
    const blocks = parseDocument(singleScore)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe('score')
  })

  it('single-score block has correct key and timeSig', () => {
    const blocks = parseDocument(singleScore)
    const score = blocks[0]
    expect(score?.type).toBe('score')
    if (score?.type !== 'score') return
    expect(score.tune.key).toBe('G')
    expect(score.tune.timeSig).toBe('4/4')
  })

  it('single-score block carries title from \\header', () => {
    const blocks = parseDocument(singleScore)
    const score = blocks[0]
    if (score?.type !== 'score') return
    expect(score.tune.title).toBe('Test')
  })

  it('returns markup + score + markup + score for multi-score file', () => {
    const blocks = parseDocument(multiScore)
    expect(blocks).toHaveLength(4)
    expect(blocks[0]?.type).toBe('markup')
    expect(blocks[1]?.type).toBe('score')
    expect(blocks[2]?.type).toBe('markup')
    expect(blocks[3]?.type).toBe('score')
  })

  it('markup block captures text and bold flag', () => {
    const blocks = parseDocument(multiScore)
    const m = blocks[0]
    expect(m?.type).toBe('markup')
    if (m?.type !== 'markup') return
    expect(m.text).toBe('Section A')
    expect(m.bold).toBe(true)
  })

  it('second score does not carry title', () => {
    const blocks = parseDocument(multiScore)
    const second = blocks[3]
    if (second?.type !== 'score') return
    expect(second.tune.title).toBeUndefined()
  })

  it('each score has its own key and timeSig', () => {
    const blocks = parseDocument(multiScore)
    const s1 = blocks[1]
    const s2 = blocks[3]
    if (s1?.type !== 'score' || s2?.type !== 'score') return
    expect(s1.tune.timeSig).toBe('4/4')
    expect(s1.tune.key).toBe('C')
    expect(s2.tune.timeSig).toBe('3/4')
    expect(s2.tune.key).toBe('G')
  })

  it('falls back to parseLy for files without explicit \\score block', () => {
    const noScore = `
\\version "2.24.0"
\\language "english"
melody = \\relative c' { \\time 4/4 c4 d e f }
`
    const blocks = parseDocument(noScore)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    expect(blocks[0]?.type).toBe('score')
  })
})

// ── \\transpose ────────────────────────────────────────────────────────────────

describe('\\transpose', () => {
  const src = `
melody = \\relative c'' { g4 g4 }
\\score { \\new Staff { \\melody } }
\\score { \\new Staff { \\transpose c c' \\melody } }
`

  it('first score: G4 (stems up, octave 4)', () => {
    const blocks = parseDocument(src)
    const score1 = blocks.find(b => b.type === 'score')
    expect(score1?.type).toBe('score')
    const notes = (score1 as any).tune.notes as ParsedNote[]
    expect(notes.every((n: ParsedNote) => n.octave === 4)).toBe(true)
    expect(notes.every((n: ParsedNote) => n.noteName === 'G')).toBe(true)
  })

  it('second score with transpose c c-prime: notes are G5 (octave 5, one octave higher)', () => {
    const blocks = parseDocument(src)
    const scores = blocks.filter(b => b.type === 'score')
    expect(scores.length).toBe(2)
    const notes = (scores[1] as any).tune.notes as ParsedNote[]
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.every((n: ParsedNote) => n.octave === 5)).toBe(true)
    expect(notes.every((n: ParsedNote) => n.noteName === 'G')).toBe(true)
  })

  it('transpose c to c-prime raises all notes by exactly one octave', () => {
    const blocks = parseDocument(src)
    const scores = blocks.filter(b => b.type === 'score')
    const notes1 = (scores[0] as any).tune.notes as ParsedNote[]
    const notes2 = (scores[1] as any).tune.notes as ParsedNote[]
    expect(notes1.length).toBe(notes2.length)
    for (let i = 0; i < notes1.length; i++) {
      expect(notes2[i]!.octave).toBe(notes1[i]!.octave + 1)
      expect(notes2[i]!.noteName).toBe(notes1[i]!.noteName)
    }
  })
})

describe('\\transpose — interval transposition (d → e, major 2nd up)', () => {
  // d'4 fs4 a4 d4 transposed d→e: each note up a major 2nd (+2 semitones)
  // d→e, fs(F#)→gs(G#), a→b, d→e
  const src = `
\\score {
  \\new Staff {
    \\transpose d e {
      \\relative {
        d'4 fs4 a4 d4
      }
    }
  }
}
`
  it('transposes D-major scale up a major 2nd to E-major pitches', () => {
    const blocks = parseDocument(src)
    const score = blocks.find(b => b.type === 'score') as any
    const notes: ParsedNote[] = score.tune.notes
    const names = notes.map((n: ParsedNote) => n.noteName)
    // d+2=E, fs+2=G#, a+2=B, d+2=E
    expect(names).toEqual(['E', 'G#', 'B', 'E'])
  })
})

describe('\\transpose — inline \\relative (no variable)', () => {
  // Inline music with \relative inside \transpose, no pre-declared variable
  const src = `
\\score {
  \\new Staff {
    \\transpose a c' {
      \\relative {
        c'4 d4 e4 g4
      }
    }
  }
}
`
  it('transposes c d e g up a minor third (a→c = +3 semitones)', () => {
    const blocks = parseDocument(src)
    const score = blocks.find(b => b.type === 'score') as any
    const notes: ParsedNote[] = score.tune.notes
    const names = notes.map((n: ParsedNote) => n.noteName)
    // c+3=eb, d+3=f, e+3=g, g+3=bb
    expect(names).toEqual(['Eb', 'F', 'G', 'Bb'])
  })
})

// ── \relative default reference ──────────────────────────────────────────────
// When \relative has no explicit start note, the first note is treated as absolute.
// LilyPond docs: "equivalent to choosing f as the reference pitch" (F3, diatonic=24).
//   \relative { g'4 }  → nearest G to F3 = G3, +1 tick → G4
//   \relative { d''4 } → nearest D to F3 = D3, +2 ticks → D5

function relNotes(body: string): ParsedNote[] {
  const src = `m = \\relative { ${body} }\n\\score { \\new Staff { \\m } }`
  const blocks = parseDocument(src)
  return (blocks.find(b => b.type === 'score') as any).tune.notes as ParsedNote[]
}

function relNotesWithStart(start: string, body: string): ParsedNote[] {
  const src = `m = \\relative ${start} { ${body} }\n\\score { \\new Staff { \\m } }`
  const blocks = parseDocument(src)
  return (blocks.find(b => b.type === 'score') as any).tune.notes as ParsedNote[]
}

describe('\\relative without explicit start note (reference = F3, first note is absolute)', () => {
  it("g'4 → G4 (nearest G to F3 = G3, +1 tick → G4) — ties demo first note", () => {
    const notes = relNotes("g'4")
    expect(notes[0]!.noteName).toBe('G')
    expect(notes[0]!.octave).toBe(4)
  })

  it("d''4 → D5 (nearest D to F3 = D3, +2 ticks → D5) — slurs demo first note", () => {
    const notes = relNotes("d''4")
    expect(notes[0]!.noteName).toBe('D')
    expect(notes[0]!.octave).toBe(5)
  })

  it("c'4 → C4 (nearest C to F3 = C4, no extra tick, stays C4)", () => {
    const notes = relNotes("c'4")
    expect(notes[0]!.noteName).toBe('C')
    expect(notes[0]!.octave).toBe(4)
  })

  it("c4 → C3 (nearest C to F3 = C3, dist=3 < C4 dist=4)", () => {
    const notes = relNotes("c4")
    expect(notes[0]!.noteName).toBe('C')
    expect(notes[0]!.octave).toBe(3)
  })
})

describe("\\relative with explicit start note", () => {
  it("\\relative c' { c4 } → C4", () => {
    const notes = relNotesWithStart("c'", 'c4')
    expect(notes[0]!.noteName).toBe('C')
    expect(notes[0]!.octave).toBe(4)
  })

  it("\\relative c'' { c4 } → C5", () => {
    const notes = relNotesWithStart("c''", 'c4')
    expect(notes[0]!.noteName).toBe('C')
    expect(notes[0]!.octave).toBe(5)
  })

  it("\\relative c' { d4 } → D4 (nearest D to C4, no ticks)", () => {
    const notes = relNotesWithStart("c'", 'd4')
    expect(notes[0]!.noteName).toBe('D')
    expect(notes[0]!.octave).toBe(4)
  })
})

describe('\\transpose — nested (B-flat trumpet → French horn)', () => {
  // \transpose f c' { \transpose c bf, { e'4 } }
  // inner: e'+semitone(c→bf,) = e' - 2 = d'
  // outer: d'+semitone(f→c') = d' + 7 = a'
  const src = `
musicInBflat = { e'4 }
\\score {
  \\new Staff {
    \\transpose f c' { \\transpose c bf, \\musicInBflat }
  }
}
`
  it('nested transpose produces the correct concert pitch', () => {
    const blocks = parseDocument(src)
    const score = blocks.find(b => b.type === 'score') as any
    const notes: ParsedNote[] = score.tune.notes
    expect(notes.length).toBeGreaterThan(0)
    // e' (octave 4) → after c→bf, (−2 semitones) = d' → after f→c' (+7 semitones) = a'
    expect(notes[0]!.noteName).toBe('A')
    expect(notes[0]!.octave).toBe(4)
  })
})

// ── \transpose — enharmonic spelling ─────────────────────────────────────────
// The diatonic interval from→to determines which enharmonic spelling to use.
// Augmented unison (c→cs, same letter class) → sharps.
// Diminished second (c→df, next letter class) → flats.

describe('\\transpose enharmonic spelling', () => {
  it('\\transpose c cs: augmented unison uses sharps (C→C#, D→D#, E→E#, F→F#)', () => {
    const src = `\\score { \\new Staff { \\transpose c cs { \\relative c' { c4 d e f } } } }`
    const blocks = parseDocument(src)
    const notes: ParsedNote[] = (blocks[0] as any).tune.notes
    expect(notes.map((n: ParsedNote) => n.noteName)).toEqual(['C#', 'D#', 'E#', 'F#'])
  })

  it('\\transpose c df: diminished second uses flats (C→Db, D→Eb, E→F, F→Gb)', () => {
    const src = `\\score { \\new Staff { \\transpose c df { \\relative c' { c4 d e f } } } }`
    const blocks = parseDocument(src)
    const notes: ParsedNote[] = (blocks[0] as any).tune.notes
    expect(notes.map((n: ParsedNote) => n.noteName)).toEqual(['Db', 'Eb', 'F', 'Gb'])
  })

  it('\\transpose a c: minor third uses flats (C→Eb, D→F, E→G, G→Bb)', () => {
    const src = `\\score { \\new Staff { \\transpose a c' { \\relative c' { c4 d e g } } } }`
    const blocks = parseDocument(src)
    const notes: ParsedNote[] = (blocks[0] as any).tune.notes
    expect(notes.map((n: ParsedNote) => n.noteName)).toEqual(['Eb', 'F', 'G', 'Bb'])
  })

  it('\\transpose c bf: major 7th down — C→Bb, D→C, E→D, G→F', () => {
    // minor 7th up = c→bf (+10 semitones, diatonic shift 6)
    const src = `\\score { \\new Staff { \\transpose c bf { \\relative c' { c4 d e g } } } }`
    const blocks = parseDocument(src)
    const notes: ParsedNote[] = (blocks[0] as any).tune.notes
    expect(notes.map((n: ParsedNote) => n.noteName)).toEqual(['Bb', 'C', 'D', 'F'])
  })
})

// ── Chord symbols (^"text" / _"text") ────────────────────────────────────────

function scoreTune(body: string): ParsedNote[] {
  const src = `melody = \\relative c' { ${body} }\n\\score { \\new Staff { \\melody } }`
  const blocks = parseDocument(src)
  const score = blocks.find(b => b.type === 'score') as any
  return score.tune.notes as ParsedNote[]
}

describe('chord symbols', () => {
  it('^"Am" attaches chordSymbol to the preceding note', () => {
    const notes = scoreTune('c4^"Am" d4')
    expect(notes[0]!.chordSymbol).toBe('Am')
    expect(notes[0]!.chordSymbolBelow).toBeFalsy()
  })

  it('_"text" sets chordSymbolBelow=true', () => {
    const notes = scoreTune('c4_"legato" d4')
    expect(notes[0]!.chordSymbol).toBe('legato')
    expect(notes[0]!.chordSymbolBelow).toBe(true)
  })

  it('note without chord symbol has no chordSymbol field', () => {
    const notes = scoreTune('c4 d4')
    expect(notes[0]!.chordSymbol).toBeUndefined()
  })

  it('chord symbol on last note of measure', () => {
    const notes = scoreTune('c4 d e f^"C" | g a b c')
    const fNote = notes.find(n => n.noteName === 'F')
    expect(fNote?.chordSymbol).toBe('C')
  })
})

// ── Chords <c e g> — multiple noteheads ──────────────────────────────────────

describe('chords <c e g>', () => {
  it('top note becomes the primary entry', () => {
    const notes = scoreTune('<c e g>4')
    expect(notes).toHaveLength(1)
    expect(notes[0]!.noteName).toBe('G')  // highest pitch is primary
  })

  it('other notes preserved in chordNotes', () => {
    const notes = scoreTune('<c e g>4')
    const cn = notes[0]!.chordNotes
    expect(cn).toBeDefined()
    expect(cn!.length).toBe(2)
    const names = cn!.map(n => n.noteName).sort()
    expect(names).toEqual(['C', 'E'])
  })

  it('single-note chord has no chordNotes', () => {
    const notes = scoreTune('<c>4')
    expect(notes[0]!.chordNotes).toBeUndefined()
  })

  it('chord duration is attached to the primary note', () => {
    const notes = scoreTune('<c e g>2')
    expect(notes[0]!.duration).toBe(2)
  })

  it('two consecutive chords parse independently', () => {
    const notes = scoreTune('<c e>4 <d f>4')
    expect(notes).toHaveLength(2)
    expect(notes[0]!.chordNotes).toHaveLength(1)
    expect(notes[1]!.chordNotes).toHaveLength(1)
  })

  it('repeated identical chord stays in same octave (LilyPond relative rule)', () => {
    // In \relative c', <c e g>1 <c e g>4 must stay in octave 4 for both chords.
    // Reference for the second chord is the FIRST note of the first chord (c4), not
    // the topmost note (g4). If we wrongly used g4 as reference, the next c would
    // resolve to c5 (nearest c above g4).
    const notes = scoreTune('<c e g>1 <c e g>4')
    expect(notes).toHaveLength(2)
    // Primary note (top) of both chords: G4
    expect(notes[0]!.noteName).toBe('G')
    expect(notes[0]!.octave).toBe(4)
    expect(notes[1]!.noteName).toBe('G')
    expect(notes[1]!.octave).toBe(4)  // must NOT jump to G5
    // First note (C) of both chords: C4
    const cn0 = notes[0]!.chordNotes!.find(n => n.noteName === 'C')
    const cn1 = notes[1]!.chordNotes!.find(n => n.noteName === 'C')
    expect(cn0?.octave).toBe(4)
    expect(cn1?.octave).toBe(4)  // must NOT jump to C5
  })

  it('note after chord uses first chord note as reference', () => {
    // \relative c' { <c e g>4 e4 } — the e after the chord is relative to c4 (first
    // note of chord), so it resolves to e4 (the nearest e above c4).
    const notes = scoreTune('<c e g>4 e4')
    expect(notes).toHaveLength(2)
    expect(notes[1]!.noteName).toBe('E')
    expect(notes[1]!.octave).toBe(4)
  })
})

// ── parseChordMode ────────────────────────────────────────────────────────────

describe('parseChordMode', () => {
  const noVars = new Map()

  it('parses c1:maj as C with duration 4', () => {
    const chords = parseChordMode('c1:maj', noVars)
    expect(chords).toHaveLength(1)
    expect(chords[0]!.name).toBe('Cmaj')
    expect(chords[0]!.duration).toBe(4)
  })

  it('parses e:7 as E7 (inherits previous duration)', () => {
    const chords = parseChordMode('c1:maj e:7', noVars)
    expect(chords[1]!.name).toBe('E7')
    expect(chords[1]!.duration).toBe(4)
  })

  it('parses a:m7 as Am7', () => {
    const chords = parseChordMode('a1:m7', noVars)
    expect(chords[0]!.name).toBe('Am7')
  })

  it('parses d:maj7 as Dmaj7', () => {
    const chords = parseChordMode('d1:maj7', noVars)
    expect(chords[0]!.name).toBe('Dmaj7')
  })

  it('parses g:dim as G°', () => {
    const chords = parseChordMode('g1:dim', noVars)
    expect(chords[0]!.name).toBe('G°')
  })

  it('parses f:aug as F+', () => {
    const chords = parseChordMode('f1:aug', noVars)
    expect(chords[0]!.name).toBe('F+')
  })

  it('parses bf:7 as Bb7', () => {
    const chords = parseChordMode('bf1:7', noVars)
    expect(chords[0]!.name).toBe('Bb7')
  })

  it('parses multiple chords in sequence', () => {
    const chords = parseChordMode('c1 f1 g1 c1', noVars)
    expect(chords.map(c => c.name)).toEqual(['C', 'F', 'G', 'C'])
  })

  it('empty modifier is plain major (no suffix)', () => {
    const chords = parseChordMode('c1', noVars)
    expect(chords[0]!.name).toBe('C')
  })

  it('parseChordMode via parseDocument attaches to tune.chordNames', () => {
    const src = `
      chord_seq = \\chordmode { c1:maj f1 g1:7 c1 }
      melody = \\relative c' { c4 d e f | f4 e d c | g4 f e d | c1 }
      \\score {
        <<
          \\new ChordNames \\chord_seq
          \\new Staff { \\melody }
        >>
      }
    `
    const blocks = parseDocument(src)
    const score = blocks.find(b => b.type === 'score') as any
    const chords = score.tune.chordNames
    expect(chords).toBeDefined()
    expect(chords).toHaveLength(4)
    expect(chords[0].name).toBe('Cmaj')
    expect(chords[1].name).toBe('F')
    expect(chords[2].name).toBe('G7')
    expect(chords[3].name).toBe('C')
  })
})
