// Hand-maintained type surface for the vendored `lilyjs` bundle
// (packages/lilyjs/lilyjs.esm.js, synced from ../lilyJS via scripts/sync-lilyjs.sh).
//
// This intentionally declares ONLY the API Giusto uses, with structural types.
// If you start using more of the bundle, extend this file — or better, publish
// lilyjs to npm with generated declarations and delete this file.

// ── music-model structural types (subset) ───────────────────────────────────

/** Exact rational number, `num/den`. Offsets are in quarter notes. */
export interface Rational {
  num: number
  den: number
}

export interface TimeSignatureLike {
  beats: number
  beatUnit: number
}

/** Chord symbol attached to a measure. `\chordmode` names have eventId === null. */
export interface ChordSymbolLike {
  text: string
  eventId: string | null
  placement?: 'above' | 'below'
  /** Offset from the measure start, as a fraction of a WHOLE note
   *  (beat 3 of 4/4 = 1/2) — same convention as `DurationLike.sounding`. */
  offset?: Rational
}

export interface TempoMarkLike {
  bpm?: number
  /** Note value of the tempo unit ('quarter', 'eighth', …). */
  beatUnit?: string
  /** Augmentation dots on the beat unit (\tempo 4. = 120 → 1). */
  beatUnitDots?: number
  text?: string
}

export interface DurationLike {
  /** Sounding length as a fraction of a whole note (dots/tuplets applied). */
  sounding: Rational
}

/** A Note, Chord, or Rest in a measure. `id` matches the rendered SVG's
 *  `data-lily-event-id` (single-staff scores render ids unprefixed). */
export interface MusicalEventLike {
  id: string
  duration: DurationLike
  isGrace?: boolean
  /** Present on Note. */
  pitch?: unknown
  /** Present on Chord. */
  pitches?: unknown[]
}

export interface MeasureLike {
  number: number
  timeSignature?: TimeSignatureLike | null
  chordSymbols: ChordSymbolLike[]
  tempoMarks?: TempoMarkLike[]
  events?: MusicalEventLike[]
  /** Expected measure length in quarter notes (from the time signature). */
  expectedDurationQN?: number
}

export interface PartLike {
  id: string
  name?: string
  measures: MeasureLike[]
}

export interface ScoreLike {
  title?: string
  parts: PartLike[]
}

export type MusicDocumentBlock =
  | { type: 'score'; score: ScoreLike }
  | { type: string; [key: string]: unknown }

export interface MusicDocumentLike {
  info?: Record<string, unknown>
  blocks: MusicDocumentBlock[]
}

// ── parse API ────────────────────────────────────────────────────────────────

export interface ParseSourceResultLike {
  format: string
  document: MusicDocumentLike | null
}

export function parseSource(source: string, options?: { format?: string }): ParseSourceResultLike

// ── render API ───────────────────────────────────────────────────────────────

export interface MusicRendererOptions {
  width?: number
  font?: 'Bravura' | 'Petaluma' | 'Leipzig' | 'Noto'
  theme?: 'auto' | 'light' | 'dark'
  measureRange?: { start: number; end: number }
}

/** Parse LilyPond source and render it into the container. Returns the SVG element. */
export function renderLily(
  container: string | HTMLElement,
  source: string,
  options?: MusicRendererOptions,
): SVGSVGElement | null

/** Render any supported notation source (auto format detection). */
export function renderMusic(
  container: string | HTMLElement,
  source: string,
  options?: MusicRendererOptions,
): SVGSVGElement | null

/** Render one already-parsed score (a single \score block from parseSource) —
 *  use this to show/play a specific score out of a multi-score document. */
export function renderScore(
  container: string | HTMLElement,
  score: ScoreLike,
  options?: MusicRendererOptions,
): SVGSVGElement | null

// ── playback highlight API ───────────────────────────────────────────────────

/** Marks rendered events active by stamping `data-lily-playback-active` /
 *  `data-lily-playback-primary`; the injected renderer stylesheet colors
 *  primary elements with `--lily-selected`. Element lookup is cached — create
 *  a fresh binding after every re-render of the score SVG. */
export interface SvgPlaybackBinding {
  setActiveEvents(events: Iterable<string | { eventId: string }>): void
  clear(): void
  destroy(): void
}

export function createSvgPlaybackBinding(root: ParentNode): SvgPlaybackBinding

// ── exact-time (Rational) helpers ────────────────────────────────────────────
// All playback/harmony/arpeggio positions and durations are exact quarter-note
// (QN) Rationals. Convert to number only at scheduler/renderer boundaries.

export const RATIONAL_ZERO: Rational
export function addRational(a: Rational, b: Rational): Rational
export function subtractRational(a: Rational, b: Rational): Rational
export function multiplyRational(a: Rational, b: Rational): Rational
export function divideRational(a: Rational, b: Rational): Rational
export function compareRational(a: Rational, b: Rational): -1 | 0 | 1
export function rationalToNumber(r: Rational): number

// ── diagnostics ──────────────────────────────────────────────────────────────

/** Structured report for an unsupported/ambiguous construct — never a silent guess. */
export interface Diagnostic {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  /** Source span `[start, end)` in the original input, when known. */
  source?: { start: number; end: number }
  eventId?: string
  recoverable: boolean
}

// ── structured harmony ───────────────────────────────────────────────────────

export type PitchLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

/** A spelled pitch class: written letter + chromatic alteration, kept separate
 *  from the enharmonic-neutral chromatic `pitchClass` (0–11, C = 0). */
export interface SpelledPitchClass {
  letter: PitchLetter
  alteration: number
  pitchClass: number
}

export type ChordQuality =
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'dominant' | 'major-seventh' | 'minor-seventh' | 'minor-major-seventh'
  | 'diminished-seventh' | 'half-diminished' | 'augmented-seventh'
  | 'suspended-second' | 'suspended-fourth' | 'power' | 'other'

export interface ChordStep { degree: number; alteration: number }
export interface ChordBass { pitch: SpelledPitchClass; added: boolean }

/** Harmonic identity of a chord, independent of any notation. */
export interface ChordDescriptor {
  root: SpelledPitchClass
  quality: ChordQuality
  extension?: 7 | 9 | 11 | 13
  additions: ChordStep[]
  alterations: ChordStep[]
  omissions: number[]
  bass?: ChordBass
}

export type HarmonyKind = 'explicit' | 'continuation' | 'skip' | 'no-chord'

/** One normalized harmony slot on the playback timeline, in exact QN. `chord`,
 *  `intervals`, and `pitchClasses` are null for skip / no-chord / unresolved. */
export interface NormalizedHarmonyEvent {
  id: string
  startQN: Rational
  durationQN: Rational
  kind: HarmonyKind
  originalText: string
  isNoChord: boolean
  chord: ChordDescriptor | null
  /** Semitone intervals above the root, ascending, root = 0. */
  intervals: number[] | null
  /** Chromatic pitch classes 0–11. */
  pitchClasses: number[] | null
  source?: { start: number; end: number }
}

export function spelledPitchClass(letter: PitchLetter, alteration: number): SpelledPitchClass
export function chordDescriptorIntervals(chord: ChordDescriptor): number[] | null
export function chordDescriptorPitchClasses(chord: ChordDescriptor): number[] | null

// ── conductor map (tempo / meter / key / bars) ───────────────────────────────

export interface TempoSegment {
  id: string
  startQN: Rational
  endQN: Rational
  /** Written beats per minute (`\tempo 4. = 60` → 60). */
  bpm: number
  /** Written beat unit in quarter notes (dotted quarter = 3/2). */
  beatUnit: Rational
  text?: string
}
export interface MeterEvent { id: string; startQN: Rational; numerator: number; denominator: number }
export interface KeyEvent { id: string; startQN: Rational; fifths: number }
export interface BarBoundary {
  measureId: string
  sourceMeasureId: string
  number: number
  passIndex: number
  startQN: Rational
  endQN: Rational
  expectedDurationQN: Rational
  actualDurationQN: Rational
  isPickup?: boolean
}
export interface ConductorMap {
  tempo: TempoSegment[]
  meter: MeterEvent[]
  key: KeyEvent[]
  bars: BarBoundary[]
  pickupQN?: Rational
}
export function quarterNoteToSeconds(map: ConductorMap, at: Rational): number
export function secondsToQuarterNote(map: ConductorMap, seconds: number): Rational

// ── playback timeline ────────────────────────────────────────────────────────

export interface WrittenPitch { step: string; alter: number; octave: number }
export interface PlaybackPitch { midi: number; spelling: WrittenPitch }
export interface TieSegment { eventId: string; durationQN: Rational }

export interface PlaybackEvent {
  eventId: string
  occurrenceIndex: number
  partIndex: number
  measureIndex: number
  voiceIndex: number
  noteIndex: number
  startQN: Rational
  durationQN: Rational
  /** Derived from the conductor map. */
  startSec: number
  durationSec: number
  pitches: PlaybackPitch[]
  isRest: boolean
  isGrace: boolean
  partId: string
  voiceId?: string
  staffId?: string
  articulations: string[]
  tieSegments?: TieSegment[]
  graceAnchorEventId?: string
}

export interface TimelinePartInfo {
  id: string
  name?: string
  index: number
  voices: Array<{ id: string; staffId?: string }>
}

/** Notation-meaning expression data at exact performed positions (structural —
 *  extend the element shapes here if you start consuming them). */
export interface TimelineExpression {
  dynamics: unknown[]
  hairpins: unknown[]
  slurs: unknown[]
  ottavas: unknown[]
  rehearsalMarks: unknown[]
}

/** The canonical, DOM-neutral playback view of a score. */
export interface PlaybackTimeline {
  events: PlaybackEvent[]
  pedalEvents?: unknown[]
  harmony: NormalizedHarmonyEvent[]
  diagnostics: Diagnostic[]
  conductor: ConductorMap
  parts: TimelinePartInfo[]
  expression: TimelineExpression
  sourceMap: Record<string, { start: number; end: number }>
  durationQN: Rational
  durationSec: number
}

export interface PlaybackOptions {
  /** Tempo (quarter notes per minute) when the score has no tempo mark (default 120). */
  defaultQuarterBpm?: number
}

/** Build the canonical playback timeline from a parsed score. */
export function buildPlaybackTimelineFromScore(
  score: ScoreLike,
  options?: PlaybackOptions,
): PlaybackTimeline

export function normalizeHarmonyTrack(score: ScoreLike): {
  harmony: NormalizedHarmonyEvent[]
  diagnostics: Diagnostic[]
}

// ── generic arpeggiator ──────────────────────────────────────────────────────

export type ArpeggioPattern = 'up' | 'down' | 'up-down' | 'down-up' | 'as-written'

export interface ArpeggiatorOptions {
  pattern: ArpeggioPattern
  /** Exact grid step between successive attacks, in quarter notes (> 0). */
  subdivisionQN: Rational
  /** Number of octaves the arpeggio spans (clamped to >= 1). */
  octaveSpan: number
  /** Optional inclusive MIDI register clamp; tones outside it are dropped. */
  range?: { lowMidi: number; highMidi: number }
  /** Absolute QN where generation begins (default 0). */
  startOffsetQN?: Rational
  /** Absolute QN where generation ends (default timeline.durationQN). */
  endOffsetQN?: Rational
}

export interface ArpeggioEvent {
  /** Stable id: `arp:<sourceHarmonyId>:<indexWithinChord>`. */
  id: string
  sourceHarmonyId: string
  startQN: Rational
  durationQN: Rational
  midiNote: number
  pitchClass: number
  patternIndex: number
  cycleIndex: number
}

export interface ArpeggioPlan {
  schemaVersion: 1
  /** End of the generation window in absolute QN. */
  durationQN: Rational
  events: ArpeggioEvent[]
  diagnostics: Diagnostic[]
}

/** Deterministically generate an exact-QN arpeggio plan from a timeline's
 *  normalized harmony. Identical inputs/options → byte-identical events + ids. */
export function createArpeggioPlan(
  timeline: Pick<PlaybackTimeline, 'harmony' | 'conductor' | 'durationQN'>,
  options: ArpeggiatorOptions,
): ArpeggioPlan

// ── score transforms (transpose) ─────────────────────────────────────────────

export type MeasureIndex = number | 'start' | 'end'

export interface Selection {
  fromMeasure: number
  toMeasure: number
  includesPickup: boolean
}

export interface TransformResult {
  score: ScoreLike
  warnings: string[]
}

export function measureRange(from: MeasureIndex, to: MeasureIndex): { from: MeasureIndex; to: MeasureIndex }

export function resolveSelection(score: ScoreLike, range: { from: MeasureIndex; to: MeasureIndex }): Selection

/** Transpose notes, key signature, chord symbols, and the harmony track together
 *  by `semitones` over the selected measures (harmony is transposed in full).
 *  Returns a new score; the input is not mutated. */
export function transpose(score: ScoreLike, selection: Selection, semitones: number): TransformResult
