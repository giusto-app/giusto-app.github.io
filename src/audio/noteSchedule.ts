// Note-event timeline derived from a parsed score (pure data — no audio, no
// React, no DOM). Sibling of chordSchedule: same quarter-note-beat convention,
// but per note/rest instead of per chord symbol. Each event's `eventId`
// matches the rendered SVG's `data-lily-event-id`, so the playback UI can
// highlight the sounding note via the lilyjs SVG playback binding.

import type { Measure, MusicalEvent, Score } from 'lilyjs'

export interface NotePlaybackEvent {
  /** Matches `data-lily-event-id` on the rendered SVG elements. */
  eventId: string
  /** 0-based start position in quarter-note beats. */
  startBeat: number
  durationBeats: number
  isRest: boolean
}

function measureDurationQN(measure: Measure): number {
  if (typeof measure.expectedDurationQN === 'number' && measure.expectedDurationQN > 0) {
    return measure.expectedDurationQN
  }
  const ts = measure.timeSignature
  if (ts && ts.beatUnit > 0) return (ts.beats * 4) / ts.beatUnit
  return 4
}

function eventDurationBeats(event: MusicalEvent): number {
  const { num, den } = event.duration.sounding
  return den > 0 ? (num / den) * 4 : 0 // whole-note fraction → quarter-note beats
}

function isRestEvent(event: MusicalEvent): boolean {
  return event.pitch === undefined && event.pitches === undefined
}

/**
 * Walk the score's first part and lay its notes/chords/rests on the beat
 * grid. Grace notes take no musical time and are skipped. Measure starts are
 * anchored to the time signature (like chordSchedule), so a short measure
 * never shifts the ones after it.
 */
export function buildNoteSchedule(score: Score): NotePlaybackEvent[] {
  const measures = score.parts[0]?.measures ?? []
  const events: NotePlaybackEvent[] = []
  let measureStart = 0

  for (const measure of measures) {
    let cursor = measureStart
    for (const event of measure.events ?? []) {
      if (event.isGrace) continue
      const durationBeats = eventDurationBeats(event)
      events.push({
        eventId: event.id,
        startBeat: cursor,
        durationBeats,
        isRest: isRestEvent(event),
      })
      cursor += durationBeats
    }
    measureStart += measureDurationQN(measure)
  }
  return events
}

/** Event ids sounding at `beat` (normally one; empty between/after events). */
export function noteEventIdsAtBeat(events: NotePlaybackEvent[], beat: number): string[] {
  const ids: string[] = []
  for (const e of events) {
    if (beat >= e.startBeat - 1e-6 && beat < e.startBeat + e.durationBeats - 1e-6) {
      ids.push(e.eventId)
    }
  }
  return ids
}
