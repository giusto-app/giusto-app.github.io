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
