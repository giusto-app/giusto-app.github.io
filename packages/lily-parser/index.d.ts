// Curated type surface for the vendored `lily-parser` package
// (copied verbatim to dist/lily-parser/index.d.ts by build-lily-parser.ts).
//
// This is deliberately a compact, hand-maintained subset of the legacy
// ParsedTune API — NOT a tsc-emitted mirror of the lilyJS source tree.
// Consumers (Giusto's StaffViewLilyPond and the frozen lily-viewer build,
// which resolves `ParsedTune` through this same file) only rely on the
// fields declared here. Extend it when a consumer starts using more of the
// runtime surface; the runtime bundle always exports the full objects.

export interface ChordName {
  name: string
  /** Duration in quarter-note beats (whole note = 4). */
  duration: number
}

export interface ParsedNote {
  noteName: string
  octave: number
  pitchClass: number
  /** Duration in quarter-note beats; 0 for grace notes. */
  duration: number
  isRest: boolean
  isGrace?: boolean
  graceType?: 'grace' | 'acciaccatura' | 'appoggiatura' | 'slashedGrace'
  graceDuration?: number
  slurStart?: boolean
  slurEnd?: boolean
  tieStart?: boolean
  tieEnd?: boolean
  articulations?: string[]
  fingering?: number
  fingeringBelow?: boolean
  tuplet?: { n: number; denom: number; total: number; idx: number; hideNumber?: boolean }
  chordSymbol?: string
  chordSymbolBelow?: boolean
  chordNotes?: Array<{ noteName: string; octave: number; pitchClass: number }>
  dynamic?: string
  stemDirection?: 'up' | 'down'
}

export interface ParsedTune {
  lilypondVersion?: string
  title?: string
  composer?: string
  info?: Record<string, unknown>
  key: string
  timeSig: string
  clef?: 'treble' | 'bass' | 'alto'
  notes: ParsedNote[]
  chordNames?: ChordName[]
  systemBreaks?: number[]
  repeatRegions?: Array<{ start: number; end: number }>
  voltaRegions?: Array<{ start: number; end: number; volta: number }>
  partialDuration?: number
  rehearsalMarks?: Array<{ noteIndex: number; text: string }>
  tempoMarks?: Array<{
    noteIndex: number
    text?: string
    bpm?: number
    beatUnitDenominator?: number
    isExpression?: boolean
  }>
  midiInstrument?: string
  raggedLast?: boolean
  raggedRight?: boolean
  firstIndent?: number
  paperFont?: string
  globalStaffSize?: number
}

export type DocumentBlock =
  | { type: 'score'; tune: ParsedTune }
  | { type: 'pianoScore'; groupType: string; staves: Array<{ name: string; tune: ParsedTune }>; meta?: Partial<ParsedTune> }
  | { type: 'markup'; text: string; [key: string]: unknown }
  | { type: 'fillLine'; [key: string]: unknown }
  | { type: 'error'; message: string }
  | { type: 'warning'; message: string }

export interface ParsedDocument {
  blocks: DocumentBlock[]
  [key: string]: unknown
}

export declare function parseLy(source: string): ParsedTune
export declare function parseDocument(source: string): DocumentBlock[]
export declare function stripComments(source: string): string
export declare function extractKey(source: string): string
export declare function extractTimeSig(source: string): string
export declare function extractPaper(source: string): Record<string, unknown>
export declare function parseDuration(token: string, defaultDuration?: number): number
export declare function parseChordMode(body: string, vars: Map<string, unknown>, defaultDuration?: number): ChordName[]
export declare class Scanner {
  constructor(source: string)
  tokenize(): Array<{ kind: string; value: string;[key: string]: unknown }>
}
