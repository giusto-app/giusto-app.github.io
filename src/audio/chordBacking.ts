// Block-chord backing schedule derived from a parsed score (pure data — no
// audio, no React). Sibling to arpeggioSchedule.ts, but voices the whole chord
// as a sustained block per harmony span instead of arpeggiating it.
//
// Positions are quarter-note beats from score start, matching the PlaybackClock.

import { buildPlaybackTimelineFromScore, rationalToNumber, type ScoreLike } from 'lilyjs'

export interface ChordBlock {
  /** 0-based start position in quarter-note beats from score start. */
  startBeat: number
  durationBeats: number
  /** Voiced MIDI notes of the chord, ascending. */
  midis: number[]
  /** MIDI velocity 0–127. */
  velocity: number
}

/** Base register for the lowest chord tone (C3). */
const VOICING_BASE_MIDI = 48

/**
 * Voice pitch classes (0–11) as an ascending chord from `baseMidi`: the first
 * tone lands at/above the base, each later tone rises to stay above the last.
 */
export function voiceChord(pitchClasses: number[], baseMidi = VOICING_BASE_MIDI): number[] {
  const midis: number[] = []
  let prev = baseMidi - 1
  for (const pc of pitchClasses) {
    const norm = ((pc % 12) + 12) % 12
    let midi = baseMidi + (((norm - (baseMidi % 12)) % 12) + 12) % 12
    while (midi <= prev) midi += 12
    midis.push(midi)
    prev = midi
  }
  return midis
}

/**
 * Build the block-chord backing: one sustained voiced chord per harmony span.
 * No-chord / empty spans are skipped (silence). Empty when the score has no
 * chord track.
 */
export function buildChordBackingSchedule(score: ScoreLike): ChordBlock[] {
  const timeline = buildPlaybackTimelineFromScore(score)
  const blocks: ChordBlock[] = []
  for (const harmony of timeline.harmony) {
    if (harmony.isNoChord || !harmony.pitchClasses || harmony.pitchClasses.length === 0) continue
    blocks.push({
      startBeat: rationalToNumber(harmony.startQN),
      durationBeats: rationalToNumber(harmony.durationQN),
      midis: voiceChord(harmony.pitchClasses),
      velocity: 64,
    })
  }
  return blocks
}

/** Chord blocks starting in `[fromBeat, toBeat)` — scheduled per clock beat. */
export function chordBlocksInWindow(blocks: ChordBlock[], fromBeat: number, toBeat: number): ChordBlock[] {
  return blocks.filter((b) => b.startBeat >= fromBeat - 1e-6 && b.startBeat < toBeat - 1e-6)
}
