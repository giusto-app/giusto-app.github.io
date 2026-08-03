// Backing styles — the same harmony rendered as different musical textures.
//
// Each style turns the score's chord voicings into a unified TimedNote[] the
// strings instrument plays. All are meter-agnostic (built from beats), so they
// work in any time signature. Pure data — no audio, no React.

import { type ScoreLike } from 'lilyjs'
import { buildArpeggioSchedule } from './arpeggioSchedule'
import { buildChordBackingSchedule, type ChordBlock } from './chordBacking'
import type { InstrumentId } from './sampledInstrument'

/** Figures rendered by the string ensemble alone (single instrument). */
export type StringsStyle = 'chords' | 'arpeggio' | 'pulse'

/**
 * What the user actually chooses: an ENSEMBLE — who is playing — rather than a
 * rhythmic pattern.
 *
 * "Waltz" sat in the same list as "Chords" and "Gypsy Jazz", which mixes two
 * different questions: a waltz is a RHYTHM (and only exists in 3), while
 * gypsy jazz is a BAND. Picking a sound and having the groove follow the
 * music's own meter is the choice a player wants to make; the pattern is then
 * derived, so an ensemble is never hidden just because the tune is in 3/4.
 */
export type BackingEnsemble = 'orchestra' | 'pizzicato' | 'piano' | 'gypsy'

export const BACKING_ENSEMBLE_LABELS: Record<BackingEnsemble, string> = {
  orchestra: 'Orchestra',
  pizzicato: 'Pizzicato',
  piano: 'Piano',
  gypsy: 'Gypsy Jazz',
}

export const BACKING_ENSEMBLE_HINTS: Record<BackingEnsemble, string> = {
  orchestra: 'Strings, double bass and pizzicato — a pit orchestra',
  pizzicato: 'Plucked strings over bass, In the Mood for Love',
  piano: 'Piano comp with a walking bass',
  gypsy: 'La pompe: archtop guitar and upright bass',
}

/**
 * Small deterministic per-note velocity shading, so repeated chords are not
 * mechanically identical. Keyed on the beat and pitch rather than random, so a
 * take is reproducible and tests stay stable.
 */
export function humanizeVelocity(velocity: number, startBeat: number, midi: number): number {
  const phase = Math.sin(startBeat * 12.9898 + midi * 78.233) * 43758.5453
  const jitter = (phase - Math.floor(phase) - 0.5) * 8 // +/- 4
  return Math.max(1, Math.min(127, Math.round(velocity + jitter)))
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
function gypsy(score: ScoreLike, meterNumerator = 4): BackingLayer[] {
  const bass: TimedNote[] = []
  const guitar: TimedNote[] = []
  const triple = meterNumerator === 3
  for (const b of buildChordBackingSchedule(score)) {
    if (b.midis.length === 0) continue
    const rootPc = ((b.midis[0]! % 12) + 12) % 12
    const bassRoot = placePc(rootPc, 31) // low register (G1 and up)
    const bassFifth = bassRoot + 7
    const end = b.startBeat + b.durationBeats
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      const beatInBar = triple
        ? ((Math.round(t - b.startBeat) % 3) + 3) % 3
        : Math.round(t) % 2
      // Valse musette: bass on beat 1 only, guitar chops on 2 and 3. La pompe:
      // bass every beat (root/fifth alternating), guitar chopping every beat
      // with the off-beats accented.
      const onBeat = triple ? beatInBar === 0 : beatInBar === 0
      if (!triple || onBeat) {
        bass.push({
          startBeat: t,
          durationBeats: Math.min(triple ? 1.6 : 0.9, end - t),
          midi: onBeat ? bassRoot : bassFifth,
          velocity: 104,
        })
      }
      if (triple && onBeat) continue // beat 1 is the bass alone
      const chopDur = Math.min(onBeat ? 0.3 : 0.25, end - t) // less staccato
      const velocity = triple ? (beatInBar === 1 ? 108 : 96) : onBeat ? 52 : 116
      for (const midi of b.midis) guitar.push({ startBeat: t, durationBeats: chopDur, midi, velocity })
    }
  }
  return [
    { instrument: 'bass', notes: bass },
    { instrument: 'guitarJazz', notes: guitar },
  ]
}

/**
 * Pizzicato ensemble — plucked upper strings over a walking-ish bass, the
 * "In the Mood for Love" texture. Same skeleton as the waltz but the pad is
 * dropped and the plucks carry the beat in any meter.
 */
function pizzicatoEnsemble(score: ScoreLike, meterNumerator: number): BackingLayer[] {
  const bass: TimedNote[] = []
  const pizz: TimedNote[] = []
  for (const b of buildChordBackingSchedule(score)) {
    if (b.midis.length === 0) continue
    const rootPc = ((b.midis[0]! % 12) + 12) % 12
    const bassRoot = placePc(rootPc, 36)
    const upper = b.midis.slice(1)
    const end = b.startBeat + b.durationBeats
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      const beatInBar = ((Math.round(t - b.startBeat) % meterNumerator) + meterNumerator) % meterNumerator
      if (beatInBar === 0) {
        bass.push({ startBeat: t, durationBeats: Math.min(1.8, end - t), midi: bassRoot, velocity: 96 })
      }
      for (const midi of (upper.length ? upper : b.midis)) {
        pizz.push({
          startBeat: t,
          durationBeats: Math.min(0.7, end - t),
          midi,
          velocity: beatInBar === 0 ? 78 : 66,
        })
      }
    }
  }
  return [
    { instrument: 'bass', notes: bass },
    { instrument: 'pizzicato', notes: pizz },
  ]
}

/** Piano comp — chord on the downbeat, lighter answers on the other beats. */
function pianoEnsemble(score: ScoreLike, meterNumerator: number): BackingLayer[] {
  const bass: TimedNote[] = []
  const piano: TimedNote[] = []
  for (const b of buildChordBackingSchedule(score)) {
    if (b.midis.length === 0) continue
    const rootPc = ((b.midis[0]! % 12) + 12) % 12
    const bassRoot = placePc(rootPc, 36)
    const upper = b.midis.slice(1)
    const end = b.startBeat + b.durationBeats
    for (let t = b.startBeat; t < end - 1e-6; t += 1) {
      const beatInBar = ((Math.round(t - b.startBeat) % meterNumerator) + meterNumerator) % meterNumerator
      if (beatInBar === 0) {
        bass.push({ startBeat: t, durationBeats: Math.min(1.6, end - t), midi: bassRoot, velocity: 92 })
        for (const midi of b.midis) {
          piano.push({ startBeat: t, durationBeats: Math.min(1.2, end - t), midi, velocity: 74 })
        }
      } else {
        for (const midi of (upper.length ? upper : b.midis)) {
          piano.push({ startBeat: t, durationBeats: Math.min(0.8, end - t), midi, velocity: 58 })
        }
      }
    }
  }
  return [
    { instrument: 'bass', notes: bass },
    { instrument: 'piano', notes: piano },
  ]
}

/**
 * The arrangement for an ENSEMBLE, with the groove derived from the meter:
 * triple metre gets the waltz/musette figure, duple the straight one. This is
 * what the UI selects — see BackingEnsemble.
 */
export function buildEnsembleArrangement(
  score: ScoreLike,
  ensemble: BackingEnsemble,
  meterNumerator = 4,
): BackingLayer[] {
  const layers =
    ensemble === 'gypsy' ? gypsy(score, meterNumerator)
    : ensemble === 'piano' ? pianoEnsemble(score, meterNumerator)
    : ensemble === 'pizzicato' ? pizzicatoEnsemble(score, meterNumerator)
    : meterNumerator === 3 ? waltz(score)
    : [{ instrument: 'strings' as InstrumentId, notes: buildBackingSchedule(score, 'chords') }]
  return layers.map((layer) => ({
    ...layer,
    notes: layer.notes.map((n) => ({ ...n, velocity: humanizeVelocity(n.velocity, n.startBeat, n.midi) })),
  }))
}

/** MIDI notes to preload per instrument so any ensemble plays gaplessly. */
export function prepareMidisByInstrument(score: ScoreLike): Record<InstrumentId, number[]> {
  // Both meters for every ensemble: the user can switch mid-piece, and the
  // groove (and so the register) differs between triple and duple.
  const layers: BackingLayer[] = (['orchestra', 'pizzicato', 'piano', 'gypsy'] as BackingEnsemble[])
    .flatMap((e) => [...buildEnsembleArrangement(score, e, 4), ...buildEnsembleArrangement(score, e, 3)])
  const midisOf = (id: InstrumentId) =>
    layers.filter((l) => l.instrument === id).flatMap((l) => l.notes.map((n) => n.midi))
  const set = (id: InstrumentId, extra: number[] = []) => [...new Set([...extra, ...midisOf(id)])]
  return {
    strings: set('strings', allBackingMidis(score)),
    bass: set('bass'),
    guitar: set('guitar'),
    guitarJazz: set('guitarJazz'),
    pizzicato: set('pizzicato'),
    piano: set('piano'),
  }
}
