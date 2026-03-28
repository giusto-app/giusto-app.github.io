export type ScaleType = 'major' | 'minor' | 'pentatonic-major' | 'pentatonic-minor' | 'gypsy'

export type ScaleKey =
  | 'free'
  // Sharp side (0 → 7 sharps) — major
  | 'c-major' | 'g-major' | 'd-major' | 'a-major' | 'e-major'
  | 'b-major' | 'fsharp-major' | 'csharp-major'
  // Sharp side — relative minor
  | 'a-minor' | 'e-minor' | 'b-minor' | 'fsharp-minor' | 'csharp-minor'
  | 'gsharp-minor' | 'dsharp-minor' | 'asharp-minor'
  // Flat side (1 → 7 flats) — major
  | 'f-major' | 'bb-major' | 'eb-major' | 'ab-major'
  | 'db-major' | 'gb-major' | 'cb-major'
  // Flat side — relative minor
  | 'd-minor' | 'g-minor' | 'c-minor' | 'f-minor'
  | 'bb-minor' | 'eb-minor' | 'ab-minor'
  // Pentatonic
  | 'g-major-pent' | 'd-major-pent' | 'a-major-pent'
  | 'a-minor-pent' | 'd-minor-pent' | 'e-minor-pent'
  // Gypsy / Hungarian
  | 'a-hungarian-minor' | 'c-hungarian-minor'
  | 'd-gypsy-major' | 'c-gypsy-major'

export interface ScaleDefinition {
  key: ScaleKey
  label: string
  shortLabel: string
  description: string
  midiNotes: readonly number[]
  scaleType: ScaleType
}

export const SCALES: Record<ScaleKey, ScaleDefinition> = {
  'free': {
    key: 'free', label: 'Free Play', shortLabel: 'Free', scaleType: 'major',
    description: 'No scale — play anything and check your intonation.',
    midiNotes: [],
  },

  // ── Sharp side — major (0 → 7 sharps) ────────────────────────────────────
  'c-major': {
    key: 'c-major', label: 'C Major', shortLabel: 'C Maj', scaleType: 'major',
    description: 'C D E F G A B C  ·  0 sharps — the foundational scale',
    midiNotes: [60, 62, 64, 65, 67, 69, 71, 72],
  },
  'g-major': {
    key: 'g-major', label: 'G Major', shortLabel: 'G Maj', scaleType: 'major',
    description: 'G A B C D E F# G  ·  1 sharp — warm open-string resonance',
    midiNotes: [55, 57, 59, 60, 62, 64, 66, 67],
  },
  'd-major': {
    key: 'd-major', label: 'D Major', shortLabel: 'D Maj', scaleType: 'major',
    description: 'D E F# G A B C# D  ·  2 sharps — common first scale for violin',
    midiNotes: [62, 64, 66, 67, 69, 71, 73, 74],
  },
  'a-major': {
    key: 'a-major', label: 'A Major', shortLabel: 'A Maj', scaleType: 'major',
    description: 'A B C# D E F# G# A  ·  3 sharps — resonates with open A string',
    midiNotes: [57, 59, 61, 62, 64, 66, 68, 69],
  },
  'e-major': {
    key: 'e-major', label: 'E Major', shortLabel: 'E Maj', scaleType: 'major',
    description: 'E F# G# A B C# D# E  ·  4 sharps — idiomatic for violin',
    midiNotes: [64, 66, 68, 69, 71, 73, 75, 76],
  },
  'b-major': {
    key: 'b-major', label: 'B Major', shortLabel: 'B Maj', scaleType: 'major',
    description: 'B C# D# E F# G# A# B  ·  5 sharps — brilliant upper register',
    midiNotes: [59, 61, 63, 64, 66, 68, 70, 71],
  },
  'fsharp-major': {
    key: 'fsharp-major', label: 'F# Major', shortLabel: 'F# Maj', scaleType: 'major',
    description: 'F# G# A# B C# D# E# F#  ·  6 sharps — enharmonic to Gb major',
    midiNotes: [66, 68, 70, 71, 73, 75, 77, 78],
  },
  'csharp-major': {
    key: 'csharp-major', label: 'C# Major', shortLabel: 'C# Maj', scaleType: 'major',
    description: 'C# D# E# F# G# A# B# C#  ·  7 sharps — enharmonic to Db major',
    midiNotes: [61, 63, 65, 66, 68, 70, 72, 73],
  },

  // ── Sharp side — relative minor (0 → 7 sharps) ───────────────────────────
  'a-minor': {
    key: 'a-minor', label: 'A Minor', shortLabel: 'A Min', scaleType: 'minor',
    description: 'A B C D E F G A  ·  0 sharps — relative of C major',
    midiNotes: [57, 59, 60, 62, 64, 65, 67, 69],
  },
  'e-minor': {
    key: 'e-minor', label: 'E Minor', shortLabel: 'E Min', scaleType: 'minor',
    description: 'E F# G A B C D E  ·  1 sharp — relative of G major',
    midiNotes: [64, 66, 67, 69, 71, 72, 74, 76],
  },
  'b-minor': {
    key: 'b-minor', label: 'B Minor', shortLabel: 'B Min', scaleType: 'minor',
    description: 'B C# D E F# G A B  ·  2 sharps — relative of D major',
    midiNotes: [59, 61, 62, 64, 66, 67, 69, 71],
  },
  'fsharp-minor': {
    key: 'fsharp-minor', label: 'F# Minor', shortLabel: 'F# Min', scaleType: 'minor',
    description: 'F# G# A B C# D E F#  ·  3 sharps — relative of A major',
    midiNotes: [66, 68, 69, 71, 73, 74, 76, 78],
  },
  'csharp-minor': {
    key: 'csharp-minor', label: 'C# Minor', shortLabel: 'C# Min', scaleType: 'minor',
    description: 'C# D# E F# G# A B C#  ·  4 sharps — relative of E major',
    midiNotes: [61, 63, 64, 66, 68, 69, 71, 73],
  },
  'gsharp-minor': {
    key: 'gsharp-minor', label: 'G# Minor', shortLabel: 'G# Min', scaleType: 'minor',
    description: 'G# A# B C# D# E F# G#  ·  5 sharps — relative of B major',
    midiNotes: [56, 58, 59, 61, 63, 64, 66, 68],
  },
  'dsharp-minor': {
    key: 'dsharp-minor', label: 'D# Minor', shortLabel: 'D# Min', scaleType: 'minor',
    description: 'D# E# F# G# A# B C# D#  ·  6 sharps — relative of F# major',
    midiNotes: [63, 65, 66, 68, 70, 71, 73, 75],
  },
  'asharp-minor': {
    key: 'asharp-minor', label: 'A# Minor', shortLabel: 'A# Min', scaleType: 'minor',
    description: 'A# B# C# D# E# F# G# A#  ·  7 sharps — relative of C# major',
    midiNotes: [58, 60, 61, 63, 65, 66, 68, 70],
  },

  // ── Flat side — major (1 → 7 flats) ──────────────────────────────────────
  'f-major': {
    key: 'f-major', label: 'F Major', shortLabel: 'F Maj', scaleType: 'major',
    description: 'F G A Bb C D E F  ·  1 flat — bright, singing character',
    midiNotes: [65, 67, 69, 70, 72, 74, 76, 77],
  },
  'bb-major': {
    key: 'bb-major', label: 'Bb Major', shortLabel: 'Bb Maj', scaleType: 'major',
    description: 'Bb C D Eb F G A Bb  ·  2 flats — warm, round tone',
    midiNotes: [58, 60, 62, 63, 65, 67, 69, 70],
  },
  'eb-major': {
    key: 'eb-major', label: 'Eb Major', shortLabel: 'Eb Maj', scaleType: 'major',
    description: 'Eb F G Ab Bb C D Eb  ·  3 flats — heroic, full sonority',
    midiNotes: [63, 65, 67, 68, 70, 72, 74, 75],
  },
  'ab-major': {
    key: 'ab-major', label: 'Ab Major', shortLabel: 'Ab Maj', scaleType: 'major',
    description: 'Ab Bb C Db Eb F G Ab  ·  4 flats — lush, Romantic character',
    midiNotes: [56, 58, 60, 61, 63, 65, 67, 68],
  },
  'db-major': {
    key: 'db-major', label: 'Db Major', shortLabel: 'Db Maj', scaleType: 'major',
    description: 'Db Eb F Gb Ab Bb C Db  ·  5 flats — enharmonic to C# major',
    midiNotes: [61, 63, 65, 66, 68, 70, 72, 73],
  },
  'gb-major': {
    key: 'gb-major', label: 'Gb Major', shortLabel: 'Gb Maj', scaleType: 'major',
    description: 'Gb Ab Bb Cb Db Eb F Gb  ·  6 flats — enharmonic to F# major',
    midiNotes: [66, 68, 70, 71, 73, 75, 77, 78],
  },
  'cb-major': {
    key: 'cb-major', label: 'Cb Major', shortLabel: 'Cb Maj', scaleType: 'major',
    description: 'Cb Db Eb Fb Gb Ab Bb Cb  ·  7 flats — enharmonic to B major',
    midiNotes: [59, 61, 63, 64, 66, 68, 70, 71],
  },

  // ── Flat side — relative minor (1 → 7 flats) ─────────────────────────────
  'd-minor': {
    key: 'd-minor', label: 'D Minor', shortLabel: 'D Min', scaleType: 'minor',
    description: 'D E F G A Bb C D  ·  1 flat — expressive and lyrical',
    midiNotes: [62, 64, 65, 67, 69, 70, 72, 74],
  },
  'g-minor': {
    key: 'g-minor', label: 'G Minor', shortLabel: 'G Min', scaleType: 'minor',
    description: 'G A Bb C D Eb F G  ·  2 flats — dark, dramatic character',
    midiNotes: [55, 57, 58, 60, 62, 63, 65, 67],
  },
  'c-minor': {
    key: 'c-minor', label: 'C Minor', shortLabel: 'C Min', scaleType: 'minor',
    description: 'C D Eb F G Ab Bb C  ·  3 flats — stormy, passionate',
    midiNotes: [60, 62, 63, 65, 67, 68, 70, 72],
  },
  'f-minor': {
    key: 'f-minor', label: 'F Minor', shortLabel: 'F Min', scaleType: 'minor',
    description: 'F G Ab Bb C Db Eb F  ·  4 flats — deep, brooding',
    midiNotes: [65, 67, 68, 70, 72, 73, 75, 77],
  },
  'bb-minor': {
    key: 'bb-minor', label: 'Bb Minor', shortLabel: 'Bb Min', scaleType: 'minor',
    description: 'Bb C Db Eb F Gb Ab Bb  ·  5 flats — somber, intense',
    midiNotes: [58, 60, 61, 63, 65, 66, 68, 70],
  },
  'eb-minor': {
    key: 'eb-minor', label: 'Eb Minor', shortLabel: 'Eb Min', scaleType: 'minor',
    description: 'Eb F Gb Ab Bb Cb Db Eb  ·  6 flats — enharmonic to D# minor',
    midiNotes: [63, 65, 66, 68, 70, 71, 73, 75],
  },
  'ab-minor': {
    key: 'ab-minor', label: 'Ab Minor', shortLabel: 'Ab Min', scaleType: 'minor',
    description: 'Ab Bb Cb Db Eb Fb Gb Ab  ·  7 flats — enharmonic to G# minor',
    midiNotes: [56, 58, 59, 61, 63, 64, 66, 68],
  },

  // ── Pentatonic scales ─────────────────────────────────────────────────────
  'g-major-pent': {
    key: 'g-major-pent', label: 'G Major Pentatonic', shortLabel: 'G♩', scaleType: 'pentatonic-major',
    description: 'G A B D E G  ·  5 notes, no semitones — ideal for ear training, open G string',
    midiNotes: [55, 57, 59, 62, 64, 67],
  },
  'd-major-pent': {
    key: 'd-major-pent', label: 'D Major Pentatonic', shortLabel: 'D♩', scaleType: 'pentatonic-major',
    description: 'D E F# A B D  ·  5 notes — resonates with open D string',
    midiNotes: [62, 64, 66, 69, 71, 74],
  },
  'a-major-pent': {
    key: 'a-major-pent', label: 'A Major Pentatonic', shortLabel: 'A♩', scaleType: 'pentatonic-major',
    description: 'A B C# E F# A  ·  5 notes — resonates with open A string',
    midiNotes: [57, 59, 61, 64, 66, 69],
  },
  'a-minor-pent': {
    key: 'a-minor-pent', label: 'A Minor Pentatonic', shortLabel: 'Am♩', scaleType: 'pentatonic-minor',
    description: 'A C D E G A  ·  5 notes — bluesy minor on open A string',
    midiNotes: [57, 60, 62, 64, 67, 69],
  },
  'd-minor-pent': {
    key: 'd-minor-pent', label: 'D Minor Pentatonic', shortLabel: 'Dm♩', scaleType: 'pentatonic-minor',
    description: 'D F G A C D  ·  5 notes — warm, expressive minor pentatonic',
    midiNotes: [62, 65, 67, 69, 72, 74],
  },
  'e-minor-pent': {
    key: 'e-minor-pent', label: 'E Minor Pentatonic', shortLabel: 'Em♩', scaleType: 'pentatonic-minor',
    description: 'E G A B D E  ·  5 notes — open E string resonance',
    midiNotes: [64, 67, 69, 71, 74, 76],
  },

  // ── Gypsy / Hungarian scales ──────────────────────────────────────────────
  'a-hungarian-minor': {
    key: 'a-hungarian-minor', label: 'A Hungarian Minor', shortLabel: 'A Hung', scaleType: 'gypsy',
    description: 'A B C D# E F G# A  ·  Hungarian minor — aug 2nd on 4th degree, Romani violin & klezmer',
    midiNotes: [57, 59, 60, 63, 64, 65, 68, 69],
  },
  'c-hungarian-minor': {
    key: 'c-hungarian-minor', label: 'C Hungarian Minor', shortLabel: 'C Hung', scaleType: 'gypsy',
    description: 'C D Eb F# G Ab B C  ·  Hungarian minor from C — Eastern European folk music',
    midiNotes: [60, 62, 63, 66, 67, 68, 71, 72],
  },
  'd-gypsy-major': {
    key: 'd-gypsy-major', label: 'D Gypsy Major', shortLabel: 'D Gyp', scaleType: 'gypsy',
    description: 'D Eb F# G A Bb C# D  ·  Double harmonic major — aug 2nd on 2nd degree, Middle Eastern',
    midiNotes: [62, 63, 66, 67, 69, 70, 73, 74],
  },
  'c-gypsy-major': {
    key: 'c-gypsy-major', label: 'C Gypsy Major', shortLabel: 'C Gyp', scaleType: 'gypsy',
    description: 'C Db E F G Ab B C  ·  Double harmonic major from C — exotic, flamenco character',
    midiNotes: [60, 61, 64, 65, 67, 68, 71, 72],
  },
}

// ── Curated sets for the selector UI ──────────────────────────────────────────

// Common violin keys — open-string resonance + most common orchestral keys
export const COMMON_VIOLIN_MAJOR_KEYS: readonly ScaleKey[] = [
  'g-major', 'd-major', 'a-major', 'e-major',  // open string resonance
  'c-major', 'f-major', 'bb-major',             // orchestral
]
export const COMMON_VIOLIN_MINOR_KEYS: readonly ScaleKey[] = [
  'g-minor', 'd-minor', 'a-minor', 'e-minor',  // parallel to major open strings
  'c-minor', 'b-minor', 'f-minor',              // orchestral
]

export const PENTATONIC_SCALES: readonly ScaleKey[] = [
  'g-major-pent', 'd-major-pent', 'a-major-pent',
  'a-minor-pent', 'd-minor-pent', 'e-minor-pent',
]

export const GYPSY_SCALES: readonly ScaleKey[] = [
  'a-hungarian-minor', 'c-hungarian-minor',
  'd-gypsy-major', 'c-gypsy-major',
]

// Full Circle of Fifths — clockwise (sharp side) + counter-clockwise (flat side)
export const CIRCLE_OF_FIFTHS: Array<Array<{ major: ScaleKey; minor: ScaleKey }>> = [
  // Row 1 — sharp side (0 → 7 sharps)
  [
    { major: 'c-major',      minor: 'a-minor' },
    { major: 'g-major',      minor: 'e-minor' },
    { major: 'd-major',      minor: 'b-minor' },
    { major: 'a-major',      minor: 'fsharp-minor' },
    { major: 'e-major',      minor: 'csharp-minor' },
    { major: 'b-major',      minor: 'gsharp-minor' },
    { major: 'fsharp-major', minor: 'dsharp-minor' },
    { major: 'csharp-major', minor: 'asharp-minor' },
  ],
  // Row 2 — flat side (1 → 7 flats)
  [
    { major: 'f-major',  minor: 'd-minor' },
    { major: 'bb-major', minor: 'g-minor' },
    { major: 'eb-major', minor: 'c-minor' },
    { major: 'ab-major', minor: 'f-minor' },
    { major: 'db-major', minor: 'bb-minor' },
    { major: 'gb-major', minor: 'eb-minor' },
    { major: 'cb-major', minor: 'ab-minor' },
  ],
]
