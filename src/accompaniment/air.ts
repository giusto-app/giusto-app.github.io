// Accompaniment IR (AIR), schema `air/1`.
//
// AIR is Giusto's canonical, notation-neutral, exact-QN contract for
// accompaniment — the boundary between lilyJS (which interprets notation into a
// PlaybackTimeline + arpeggio plan) and Giusto's arranger/renderer. It is owned
// by Giusto, holds exact rational quarter-note (QN) time, and never carries
// seconds, ticks, React, DOM, SVG, or audio concerns (seconds are a projection
// derived from `conductor` at a scheduling boundary).
//
// This is the MINIMAL first cut needed to represent an arpeggio backing track.
// Deliberately out of scope for now (see docs/SMART-ACCOMPANIMENT-ARCHITECTURE.md):
// structure graph, revisionHash, expression curves, and multi-part arranging.
// `Rational` is reused from the vendored lilyjs surface ({num, den}) rather than
// the doc's bigint sketch, matching the shipped PlaybackTimeline.

import type { Rational } from 'lilyjs'

export const AIR_SCHEMA = 'air/1' as const

/** A pitch class kept both as a chromatic number and its printed spelling. */
export interface AirPitchClass {
  /** Chromatic pitch class 0–11 (C = 0). */
  midiClass: number
  /** Spelling as printed, e.g. "Bb", "F#", "G". */
  spelling: string
}

export interface AirTempoSegment {
  id: string
  startQN: Rational
  endQN: Rational
  /** Written beats per minute (`\tempo 4. = 60` → 60). */
  bpm: number
  /** Written beat unit in quarter notes (dotted quarter = 3/2). */
  beatUnitQN: Rational
  text?: string
}

export interface AirMeterEvent {
  id: string
  startQN: Rational
  numerator: number
  denominator: number
}

export interface AirKeyEvent {
  id: string
  startQN: Rational
  /** Signed circle-of-fifths count: sharps positive, flats negative. */
  fifths: number
}

export interface AirBarBoundary {
  measureId: string
  /** Printed measure number. */
  number: number
  startQN: Rational
  endQN: Rational
  isPickup?: boolean
}

/** Tempo / meter / key / bar map — everything needed to project QN → seconds. */
export interface AirConductor {
  tempo: AirTempoSegment[]
  meter: AirMeterEvent[]
  key: AirKeyEvent[]
  barlines: AirBarBoundary[]
  pickupQN?: Rational
}

/** One normalized harmony span. `root`/`quality` are null for no-chord / skip. */
export interface AirHarmonyEvent {
  id: string
  startQN: Rational
  durationQN: Rational
  root: AirPitchClass | null
  bass?: AirPitchClass
  /** Canonical quality (lilyJS vocabulary: 'minor', 'dominant', …); null for no-chord/skip. */
  quality: string | null
  /** Chromatic pitch classes 0–11; empty for no-chord / skip / unresolved. */
  pitchClasses: number[]
  isNoChord: boolean
}

/** A generated accompaniment note in exact QN + MIDI. */
export interface AirPerformanceNote {
  id: string
  partId: string
  /** MIDI note number (60 = middle C). */
  pitch: number
  onsetQN: Rational
  durationQN: Rational
  velocity: number
  /** Expressive timing offset in ms; 0 keeps exact score time. */
  timingOffsetMs: number
  /** The harmony event this note was generated from (provenance). */
  harmonyId: string
}

/** A performed part. The arranger later assigns an instrument to each `role`. */
export interface AirPart {
  id: string
  /** Role hint, e.g. 'arpeggio'. */
  role: string
  notes: AirPerformanceNote[]
}

/** Giusto's Accompaniment IR (air/1). */
export interface AccompanimentIR {
  schema: typeof AIR_SCHEMA
  /** Caller-supplied score identity, when known. */
  scoreId?: string
  durationQN: Rational
  conductor: AirConductor
  harmony: AirHarmonyEvent[]
  parts: AirPart[]
}
