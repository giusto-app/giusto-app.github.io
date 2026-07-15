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
  /** Offset from the measure start, in quarter notes. */
  offset?: Rational
}

export interface TempoMarkLike {
  bpm?: number
  text?: string
}

export interface MeasureLike {
  number: number
  timeSignature?: TimeSignatureLike | null
  chordSymbols: ChordSymbolLike[]
  tempoMarks?: TempoMarkLike[]
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
