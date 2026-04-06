export interface ParsedNote {
  noteName: string        // 'G', 'F#', 'Bb' — exact LilyPond spelling
  octave: number          // absolute octave (C4 = middle C)
  pitchClass: number      // 0–11
  duration: number        // quarter-note units (0.5=eighth, 1=quarter, 2=half)
  isRest: boolean
  isGrace?: boolean       // grace note (acciaccatura/grace) — render small, zero duration
  graceType?: 'grace' | 'acciaccatura' | 'appoggiatura' | 'slashedGrace'
  graceDuration?: number  // original note duration before zeroing, for flag rendering
  slurStart?: boolean     // ( — this note begins a slur
  slurEnd?: boolean       // ) — this note ends a slur
  tieStart?: boolean      // ~ — this note is tied forward to the next note
  tieEnd?: boolean        // ~ — this note is the continuation of a tied note
  articulations?: string[] // e.g. ['downbow', 'upbow', 'staccato']
  fingering?: number      // fingering number from -N or _N suffix (e.g. a8-3 → 3)
  fingeringBelow?: boolean // true when _N suffix — fingering must always be below notehead
  tuplet?: { n: number; denom: number; total: number; idx: number }  // tuplet group info; denom = M in \tuplet N/M
  chordSymbol?: string    // ^"Am" or _"text" — chord symbol / markup placed above (^) or below (_) the note
  chordSymbolBelow?: boolean  // true when _"..." prefix → place below staff
  chordNotes?: Array<{ noteName: string; octave: number; pitchClass: number }> // additional noteheads in <c e g> chord (top note is the main entry)
}

export type DocumentBlock =
  | { type: 'score'; tune: ParsedTune }
  | { type: 'markup'; text: string; bold?: boolean; italic?: boolean; large?: boolean; color?: string; code?: boolean }
  | { type: 'error'; message: string }

/** A chord name symbol from \chordmode, e.g. { name: "Cmaj7", duration: 4 } */
export interface ChordName {
  name: string          // display string, e.g. "C", "Am", "G7", "Dmaj7"
  duration: number      // quarter-note units (same scale as ParsedNote.duration)
}

export interface ParsedTune {
  title?: string
  composer?: string
  key: string           // 'D', 'Em', 'Bb', 'Dm'
  timeSig: string       // '6/8', '4/4', '9/8'
  notes: ParsedNote[]
  chordNames?: ChordName[]  // from \new ChordNames \chordmode { ... }
  systemBreaks?: number[]  // note indices after which a system break (\break) was declared
  repeatRegions?: Array<{ start: number; end: number }>  // note index ranges for \repeat volta
  voltaRegions?: Array<{ start: number; end: number; volta: number }>  // 1st/2nd ending ranges
  partialDuration?: number // pickup bar duration in QN (e.g. 1.5 for \partial 4.)
  rehearsalMarks?: Array<{ noteIndex: number; text: string }> // \mark \markup \box "A" etc.
  tempoMarks?: Array<{ noteIndex: number; text?: string; bpm?: number; beatDuration?: number }> // \tempo "Swing" or \tempo 4=120
  // \paper settings
  raggedLast?: boolean  // ragged-last: true (##t) = last system natural width; false (##f) = stretched; default true
  firstIndent?: number  // indent: extra left-margin on first system in SVG user units; 0 = no indent (default)
  paperFont?: string    // font = "Petaluma" — SMuFL font name; overrides the viewer's font dropdown when set
}
