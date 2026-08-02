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
export type StringsStyle = 'chords' | 'arpeggio' | 'pulse'
/** All backing styles, including the multi-instrument waltz/gypsy arrangements. */
export type BackingStyle = StringsStyle | 'waltz' | 'gypsy'

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
  return pulse(blocks)
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
 * Orchestral waltz — the classic 3/4 boom-chick-chick, scored like a pit
 * orchestra:
 *
 *   bass       "boom":  root on beat 1 of each bar (fifth on a long chord's
 *                       alternate bars), ringing under the chicks
 *   pizzicato  "chick": the upper chord tones plucked on beats 2 and 3
 *   strings    pad:     the same tones sustained very softly across the
 *                       harmony span, the section body under the pulse
 *
 * Beat 1 of the bar is `(t − blockStart) % 3` relative to the harmony block —
 * chords in a waltz change on downbeats, so a block's first beat IS a bar
 * start (same bar convention the gypsy pompe uses for 4/4).
 */
function waltz(score: ScoreLike): BackingLayer[] {
  const bass: TimedNote[] = []
  const pizzicato: TimedNote[] = []
  const pad: TimedNote[] = []
  for (const b of buildChordBackingSchedule(score)) {
    if (b.midis.length === 0) continue
    const rootPc = ((b.midis[0]! % 12) + 12) % 12
    const bassRoot = placePc(rootPc, 36) // orchestral double-bass register (C2 floor)
    const bassFifth = bassRoot + 7
    const upper = b.midis.slice(1)
    const end = b.startBeat + b.durationBeats
    for (const midi of (upper.length ? upper : b.midis)) {
      pad.push({ startBeat: b.startBeat, durationBeats: b.durationBeats, midi, velocity: 34 })
    }
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      const beatInBlock = Math.round(t - b.startBeat)
      const beatInBar = ((beatInBlock % 3) + 3) % 3
      if (beatInBar === 0) {
        // Root on the chord's first bar, alternating with the fifth when one
        // harmony spans several bars.
        const midi = Math.floor(beatInBlock / 3) % 2 === 0 ? bassRoot : bassFifth
        bass.push({ startBeat: t, durationBeats: Math.min(1.9, end - t), midi, velocity: 106 })
      } else {
        const dur = Math.min(0.45, end - t)
        const velocity = beatInBar === 1 ? 78 : 68 // beat 2 slightly leads beat 3
        for (const midi of (upper.length ? upper : b.midis)) {
          pizzicato.push({ startBeat: t, durationBeats: dur, midi, velocity })
        }
      }
    }
  }
  return [
    { instrument: 'bass', notes: bass },
    { instrument: 'pizzicato', notes: pizzicato },
    { instrument: 'strings', notes: pad },
  ]
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
  if (style === 'waltz') return waltz(score)
  return [{ instrument: 'strings', notes: buildBackingSchedule(score, style) }]
}

/**
 * Meters a style requires; absent = fits any meter. The waltz pattern is
 * three beats long and the gypsy pompe alternates on a duple bar, so those
 * two are the only meter-gated styles.
 */
const STYLE_METERS: Partial<Record<BackingStyle, readonly number[]>> = {
  waltz: [3],
  gypsy: [2, 4],
}

/** Whether a style suits the meter — Waltz needs 3/4, Gypsy Jazz a duple/quadruple meter. */
export function isStyleAvailable(style: BackingStyle, meterNumerator: number): boolean {
  const meters = STYLE_METERS[style]
  return !meters || meters.includes(meterNumerator)
}

/** Silence, the tuning drone, or a musical style. */
export type BackingSelection = 'off' | 'drone' | BackingStyle

const BACKING_SELECTIONS: readonly BackingSelection[] = [
  'off', 'drone', 'chords', 'arpeggio', 'pulse', 'waltz', 'gypsy',
]

export const isStyle = (s: BackingSelection): s is BackingStyle => s !== 'off' && s !== 'drone'

/**
 * The backing an opening exercise should switch to for its declared catalog
 * `backing`, or null to leave the current selection alone.
 *
 * A METER-GATED style (Waltz 3/4, Gypsy 2|4/4) is adopted only once the meter
 * is known to match — never optimistically. `meterNumerator` is null while the
 * score is still being fetched and parsed, and also when a parse FAILS, so
 * adopting first and evicting later could strand a 4/4 piece on a three-beat
 * pattern. Meter-agnostic styles need no such wait.
 */
export function declaredBackingSelection(
  declared: string | undefined,
  meterNumerator: number | null,
): BackingSelection | null {
  if (!declared) return null
  const selection = BACKING_SELECTIONS.find((value) => value === declared)
  if (!selection) return null
  if (!isStyle(selection) || !STYLE_METERS[selection]) return selection
  return meterNumerator != null && isStyleAvailable(selection, meterNumerator) ? selection : null
}

/** MIDI notes to preload per instrument so any style plays gaplessly. */
export function prepareMidisByInstrument(score: ScoreLike): Record<InstrumentId, number[]> {
  const gyp = buildBackingArrangement(score, 'gypsy')
  const wal = buildBackingArrangement(score, 'waltz')
  const midisOf = (layers: BackingLayer[], id: InstrumentId) =>
    layers.filter((l) => l.instrument === id).flatMap((l) => l.notes.map((n) => n.midi))
  return {
    strings: [...new Set([...allBackingMidis(score), ...midisOf(wal, 'strings')])],
    bass: [...new Set([...midisOf(gyp, 'bass'), ...midisOf(wal, 'bass')])],
    guitar: midisOf(gyp, 'guitar'),
    pizzicato: midisOf(wal, 'pizzicato'),
  }
}
