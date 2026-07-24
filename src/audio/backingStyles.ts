// Backing styles — the same harmony rendered as different musical textures.
//
// Each style turns the score's chord voicings into a unified TimedNote[] the
// strings instrument plays. All are meter-agnostic (built from beats), so they
// work in any time signature. Pure data — no audio, no React.

import { type ScoreLike } from 'lilyjs'
import { buildArpeggioSchedule } from './arpeggioSchedule'
import { buildChordBackingSchedule, type ChordBlock } from './chordBacking'
import type { InstrumentId } from './sampledInstrument'

/** Styles rendered by the string ensemble alone (single instrument). */
export type StringsStyle = 'chords' | 'arpeggio' | 'pulse' | 'waltz'
/** All backing styles, including the multi-instrument gypsy-jazz arrangement. */
export type BackingStyle = StringsStyle | 'gypsy'

export const BACKING_STYLE_LABELS: Record<BackingStyle, string> = {
  chords: 'Chords',
  arpeggio: 'Arpeggio',
  pulse: 'Pulse',
  waltz: 'Waltz',
  gypsy: 'Gypsy Jazz',
}

export interface TimedNote {
  /** 0-based start in quarter-note beats from score start. */
  startBeat: number
  durationBeats: number
  midi: number
  velocity: number
}

const ARP_CONFIG = { pattern: 'up', rhythm: 'eighth', octaves: 1 } as const

/** Held chords — every voiced tone sustains for the whole harmony span. */
function sustained(blocks: ChordBlock[]): TimedNote[] {
  return blocks.flatMap((b) =>
    b.midis.map((midi) => ({ startBeat: b.startBeat, durationBeats: b.durationBeats, midi, velocity: b.velocity })),
  )
}

/** Steady comp — the whole chord struck on every beat. */
function pulse(blocks: ChordBlock[]): TimedNote[] {
  const out: TimedNote[] = []
  for (const b of blocks) {
    const end = b.startBeat + b.durationBeats
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      const dur = Math.min(0.9, end - t)
      for (const midi of b.midis) out.push({ startBeat: t, durationBeats: dur, midi, velocity: b.velocity })
    }
  }
  return out
}

/** Broken chord — bass on the beat, upper tones on the off-beat (oom-pah feel). */
function waltz(blocks: ChordBlock[]): TimedNote[] {
  const out: TimedNote[] = []
  for (const b of blocks) {
    if (b.midis.length === 0) continue
    const end = b.startBeat + b.durationBeats
    const bass = b.midis[0]!
    const upper = b.midis.slice(1)
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      out.push({ startBeat: t, durationBeats: Math.min(0.5, end - t), midi: bass, velocity: b.velocity })
      const off = t + 0.5
      if (off < end - 1e-6) {
        for (const midi of upper) {
          out.push({ startBeat: off, durationBeats: Math.min(0.5, end - off), midi, velocity: Math.round(b.velocity * 0.85) })
        }
      }
    }
  }
  return out
}

/** Build the note schedule for a single-instrument (strings) style. */
export function buildBackingSchedule(score: ScoreLike, style: StringsStyle): TimedNote[] {
  if (style === 'arpeggio') {
    return buildArpeggioSchedule(score, ARP_CONFIG).map((n) => ({
      startBeat: n.startBeat,
      durationBeats: n.durationBeats,
      midi: n.midi,
      velocity: n.velocity,
    }))
  }
  const blocks = buildChordBackingSchedule(score)
  if (style === 'chords') return sustained(blocks)
  if (style === 'pulse') return pulse(blocks)
  return waltz(blocks)
}

/** Notes starting in `[fromBeat, toBeat)` — scheduled per clock beat. */
export function backingNotesInWindow(notes: TimedNote[], fromBeat: number, toBeat: number): TimedNote[] {
  return notes.filter((n) => n.startBeat >= fromBeat - 1e-6 && n.startBeat < toBeat - 1e-6)
}

/**
 * All MIDI notes any style could play — used to preload the string samples once
 * so switching styles mid-playback never falls back to the synth.
 */
export function allBackingMidis(score: ScoreLike): number[] {
  const midis = new Set<number>()
  for (const b of buildChordBackingSchedule(score)) for (const m of b.midis) midis.add(m)
  for (const n of buildArpeggioSchedule(score, ARP_CONFIG)) midis.add(n.midi)
  return [...midis]
}

// ── multi-instrument arrangements ────────────────────────────────────────────

/** One instrument's part within a backing arrangement. */
export interface BackingLayer {
  instrument: InstrumentId
  notes: TimedNote[]
}

/** Lowest MIDI at or above `floorMidi` with the given pitch class. */
function placePc(pc: number, floorMidi: number): number {
  return floorMidi + ((((pc % 12) - floorMidi) % 12) + 12) % 12
}

/**
 * Gypsy jazz "la pompe": a 4-to-the-bar double bass (root on the beat, fifth on
 * the off) under two rhythm guitars chopping the chord — beats 2 & 4 accented
 * and short. The two guitars come from the guitar instrument's ensemble voices.
 */
function gypsy(score: ScoreLike): BackingLayer[] {
  const bass: TimedNote[] = []
  const guitar: TimedNote[] = []
  for (const b of buildChordBackingSchedule(score)) {
    if (b.midis.length === 0) continue
    const rootPc = ((b.midis[0]! % 12) + 12) % 12
    const bassRoot = placePc(rootPc, 31) // low register (G1 and up)
    const bassFifth = bassRoot + 7
    const end = b.startBeat + b.durationBeats
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      const onBeat = Math.round(t) % 2 === 0 // beats 1 & 3 of a 4/4 bar
      bass.push({ startBeat: t, durationBeats: Math.min(0.9, end - t), midi: onBeat ? bassRoot : bassFifth, velocity: 104 })
      const chopDur = Math.min(onBeat ? 0.3 : 0.25, end - t) // less staccato
      const velocity = onBeat ? 52 : 116 // strongly accent the off-beats (the "chick")
      for (const midi of b.midis) guitar.push({ startBeat: t, durationBeats: chopDur, midi, velocity })
    }
  }
  return [
    { instrument: 'bass', notes: bass },
    { instrument: 'guitar', notes: guitar },
  ]
}

/** Build the full arrangement (one or more instrument layers) for a style. */
export function buildBackingArrangement(score: ScoreLike, style: BackingStyle): BackingLayer[] {
  if (style === 'gypsy') return gypsy(score)
  return [{ instrument: 'strings', notes: buildBackingSchedule(score, style) }]
}

/** Whether a style suits the meter — Waltz needs 3/4, Gypsy Jazz a duple/quadruple meter. */
export function isStyleAvailable(style: BackingStyle, meterNumerator: number): boolean {
  if (style === 'waltz') return meterNumerator === 3
  if (style === 'gypsy') return meterNumerator === 4 || meterNumerator === 2
  return true
}

/** MIDI notes to preload per instrument so any style plays gaplessly. */
export function prepareMidisByInstrument(score: ScoreLike): Record<InstrumentId, number[]> {
  const gyp = buildBackingArrangement(score, 'gypsy')
  const midisOf = (id: InstrumentId) =>
    gyp.filter((l) => l.instrument === id).flatMap((l) => l.notes.map((n) => n.midi))
  return {
    strings: allBackingMidis(score),
    bass: midisOf('bass'),
    guitar: midisOf('guitar'),
  }
}
