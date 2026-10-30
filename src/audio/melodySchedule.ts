// The violin line as notes to sound (PLAN_LOOP_RANGE.md, LR9): a guide voice
// for part focus. Read from lilyjs's playback timeline, which already merges
// tied notes into one sounding note and flags rests and grace notes. Pure data
// on the backing's beat grid (TimedNote), so the transport schedules it the
// same way. Grace notes take no musical time here, as in noteSchedule.

import { buildPlaybackTimelineFromScore, type Score } from 'lilyjs'
import type { TimedNote } from './backingStyles'

/** A guide, not a performance: quieter than the backing's accents. */
const MELODY_VELOCITY = 0.7

export function melodyNotes(score: Score, partIndex = 0): TimedNote[] {
  const notes: TimedNote[] = []
  for (const e of buildPlaybackTimelineFromScore(score).events) {
    if (e.partIndex !== partIndex || e.isRest || e.isGrace) continue
    const startBeat = e.startQN.num / e.startQN.den
    const durationBeats = e.durationQN.num / e.durationQN.den
    for (const p of e.pitches) notes.push({ midi: p.midi, startBeat, durationBeats, velocity: MELODY_VELOCITY })
  }
  return notes
}

/** What a take lets you hear: the backing as today, the violin line with it, or the violin line alone. */
export type PartFocus = 'backing' | 'both' | 'violin'

export const PART_FOCUS_OPTIONS: Array<[PartFocus, string]> = [
  ['backing', 'Backing'],
  ['both', 'Violin + backing'],
  ['violin', 'Violin only'],
]

/** Whether the guide voice and the backing sound under a focus. */
export function partGains(focus: PartFocus): { melody: boolean; backing: boolean } {
  return { melody: focus !== 'backing', backing: focus !== 'violin' }
}
