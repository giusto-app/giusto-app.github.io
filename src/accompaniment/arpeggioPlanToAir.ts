// ArpeggioPlan → AIR adapter (pure data — no React, DOM, SVG, or audio).
//
// lilyJS generates a notation-neutral `ArpeggioPlan` (exact-QN chord-tone
// events) from a `PlaybackTimeline`. This adapter lifts that plan plus the
// source timeline's harmony/conductor into Giusto's `AccompanimentIR` (air/1),
// which the arranger/renderer consume. The plan alone has no conductor/harmony,
// so the source timeline is required too.
//
// Supersedes the float-beat, chord-label-reparsing `src/audio/chordSchedule.ts`
// for accompaniment: harmony here is exact-QN and structured (pitch classes /
// spelling straight from lilyJS), never reparsed from a display string.

import {
  buildPlaybackTimelineFromScore,
  createArpeggioPlan,
  parseSource,
  type ArpeggiatorOptions,
  type ArpeggioPlan,
  type ConductorMap,
  type NormalizedHarmonyEvent,
  type PlaybackTimeline,
  type ScoreLike,
  type SpelledPitchClass,
} from 'lilyjs'
import {
  AIR_SCHEMA,
  type AccompanimentIR,
  type AirConductor,
  type AirHarmonyEvent,
  type AirPerformanceNote,
  type AirPitchClass,
} from './air'

export interface ArpeggioPlanToAirOptions {
  /** Score identity to stamp on the IR, when known. */
  scoreId?: string
  /** Part id for the generated arpeggio notes (default 'arpeggio'). */
  partId?: string
  /** Role hint the arranger uses to pick an instrument (default 'arpeggio'). */
  role?: string
  /** MIDI velocity for every generated note (default 72). */
  velocity?: number
}

const DEFAULT_PART_ID = 'arpeggio'
const DEFAULT_ROLE = 'arpeggio'
const DEFAULT_VELOCITY = 72

/** Printed spelling of a spelled pitch class, e.g. B♭ → "Bb", F♯ → "F#". */
function spell(pc: SpelledPitchClass): string {
  const accidental = pc.alteration > 0 ? '#'.repeat(pc.alteration) : 'b'.repeat(-pc.alteration)
  return `${pc.letter}${accidental}`
}

function toAirPitchClass(pc: SpelledPitchClass): AirPitchClass {
  return { midiClass: pc.pitchClass, spelling: spell(pc) }
}

function mapConductor(conductor: ConductorMap): AirConductor {
  return {
    tempo: conductor.tempo.map((t) => ({
      id: t.id,
      startQN: t.startQN,
      endQN: t.endQN,
      bpm: t.bpm,
      beatUnitQN: t.beatUnit,
      ...(t.text !== undefined ? { text: t.text } : {}),
    })),
    meter: conductor.meter.map((m) => ({
      id: m.id,
      startQN: m.startQN,
      numerator: m.numerator,
      denominator: m.denominator,
    })),
    key: conductor.key.map((k) => ({ id: k.id, startQN: k.startQN, fifths: k.fifths })),
    barlines: conductor.bars.map((b) => ({
      measureId: b.measureId,
      number: b.number,
      startQN: b.startQN,
      endQN: b.endQN,
      ...(b.isPickup ? { isPickup: true } : {}),
    })),
    ...(conductor.pickupQN ? { pickupQN: conductor.pickupQN } : {}),
  }
}

function mapHarmony(h: NormalizedHarmonyEvent): AirHarmonyEvent {
  return {
    id: h.id,
    startQN: h.startQN,
    durationQN: h.durationQN,
    root: h.chord ? toAirPitchClass(h.chord.root) : null,
    ...(h.chord?.bass ? { bass: toAirPitchClass(h.chord.bass.pitch) } : {}),
    quality: h.chord ? h.chord.quality : null,
    pitchClasses: h.pitchClasses ?? [],
    isNoChord: h.isNoChord,
  }
}

/**
 * Map a generated `ArpeggioPlan` (and the `PlaybackTimeline` it came from) into
 * an `AccompanimentIR`. Pure: neither input is mutated, and identical inputs
 * produce identical output. No-chord / skip harmony contributes a harmony span
 * but no notes (the plan already omits them), i.e. silence.
 */
export function arpeggioPlanToAir(
  plan: ArpeggioPlan,
  timeline: Pick<PlaybackTimeline, 'harmony' | 'conductor'>,
  options: ArpeggioPlanToAirOptions = {},
): AccompanimentIR {
  const partId = options.partId ?? DEFAULT_PART_ID
  const role = options.role ?? DEFAULT_ROLE
  const velocity = options.velocity ?? DEFAULT_VELOCITY

  const notes: AirPerformanceNote[] = plan.events.map((event) => ({
    id: event.id,
    partId,
    pitch: event.midiNote,
    onsetQN: event.startQN,
    durationQN: event.durationQN,
    velocity,
    timingOffsetMs: 0,
    harmonyId: event.sourceHarmonyId,
  }))

  return {
    schema: AIR_SCHEMA,
    ...(options.scoreId !== undefined ? { scoreId: options.scoreId } : {}),
    durationQN: plan.durationQN,
    conductor: mapConductor(timeline.conductor),
    harmony: timeline.harmony.map(mapHarmony),
    parts: [{ id: partId, role, notes }],
  }
}

export interface BuildArpeggioAirOptions extends ArpeggioPlanToAirOptions {
  /** Notation format (default auto-detected by lilyJS). */
  format?: string
}

/**
 * Convenience end-to-end builder: parse notation → build the playback timeline
 * → generate an arpeggio plan → adapt to AIR. Throws if the source has no
 * `\score` block. This is the smallest path from a `.ly` string to a
 * schedulable arpeggio backing track.
 */
export function buildArpeggioAir(
  source: string,
  arpeggiator: ArpeggiatorOptions,
  options: BuildArpeggioAirOptions = {},
): AccompanimentIR {
  const parsed = parseSource(source, options.format ? { format: options.format } : undefined)
  const scoreBlock = parsed.document?.blocks.find((block) => block.type === 'score') as
    | { type: 'score'; score: ScoreLike }
    | undefined
  if (!scoreBlock) throw new Error('buildArpeggioAir: source has no \\score block')

  return arpeggioAirFromScore(scoreBlock.score, arpeggiator, options)
}

/**
 * Build AIR from an already-parsed score (no re-parse). Use this when the caller
 * already holds a `ScoreLike` — e.g. a UI that parsed the source to render it —
 * so the timeline is built once.
 */
export function arpeggioAirFromScore(
  score: ScoreLike,
  arpeggiator: ArpeggiatorOptions,
  options: ArpeggioPlanToAirOptions = {},
): AccompanimentIR {
  const timeline = buildPlaybackTimelineFromScore(score)
  const plan = createArpeggioPlan(timeline, arpeggiator)
  return arpeggioPlanToAir(plan, timeline, options)
}
