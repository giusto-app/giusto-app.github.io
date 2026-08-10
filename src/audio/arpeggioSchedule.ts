// Arpeggio backing schedule derived from a parsed score (pure data — no audio,
// no React). Bridges the lilyJS accompaniment IR into the same numeric,
// quarter-note-beat shape the playback clock schedules against, exactly like
// `chordSchedule.ts` does for the drone.
//
// All positions are in quarter-note beats ("QN beats") from score start, so the
// PlaybackClock (whose beats are quarter notes) can schedule each note directly.

import { rationalToNumber, type Score } from 'lilyjs'
import { arpeggioAirFromScore } from '../accompaniment/arpeggioPlanToAir'

/** UI-exposed arpeggio patterns (a subset of the lilyJS arpeggiator's). */
export type ArpeggioPattern = 'up' | 'down' | 'up-down' | 'down-up'

/** UI-exposed rhythmic grid for the arpeggio. */
export type ArpeggioRhythm = 'quarter' | 'eighth' | 'triplet' | 'sixteenth'

export interface ArpeggioConfig {
  pattern: ArpeggioPattern
  rhythm: ArpeggioRhythm
  /** Octave span of the arpeggio (1 or 2). */
  octaves: number
}

export interface ArpNote {
  /** 0-based start position in quarter-note beats from score start. */
  startBeat: number
  durationBeats: number
  /** MIDI note number (60 = middle C). */
  midi: number
  /** MIDI velocity 0–127. */
  velocity: number
}

/** Subdivision grid in quarter notes: how far apart successive attacks are. */
const RHYTHM_SUBDIVISION_QN: Record<ArpeggioRhythm, { num: number; den: number }> = {
  quarter: { num: 1, den: 1 },
  eighth: { num: 1, den: 2 },
  triplet: { num: 1, den: 3 }, // triplet eighths — three attacks per quarter
  sixteenth: { num: 1, den: 4 },
}

/**
 * Build the arpeggio backing as a sorted numeric schedule. Empty when the score
 * has no chord track (the arpeggiator generates nothing from no harmony).
 */
export function buildArpeggioSchedule(score: Score, config: ArpeggioConfig): ArpNote[] {
  const air = arpeggioAirFromScore(score, {
    pattern: config.pattern,
    subdivisionQN: RHYTHM_SUBDIVISION_QN[config.rhythm],
    octaveSpan: config.octaves,
  })

  const notes: ArpNote[] = []
  for (const part of air.parts) {
    for (const note of part.notes) {
      notes.push({
        startBeat: rationalToNumber(note.onsetQN),
        durationBeats: rationalToNumber(note.durationQN),
        midi: note.pitch,
        velocity: note.velocity,
      })
    }
  }
  notes.sort((a, b) => a.startBeat - b.startBeat)
  return notes
}

/**
 * Notes starting in `[fromBeat, toBeat)` — the scheduler calls this once per
 * clock beat so sub-beat attacks land at their exact fractional position.
 */
export function arpNotesInWindow(notes: ArpNote[], fromBeat: number, toBeat: number): ArpNote[] {
  return notes.filter((n) => n.startBeat >= fromBeat - 1e-6 && n.startBeat < toBeat - 1e-6)
}
