// Where the barlines fall in a tune's notes.json.
//
// Phase 3 wants segment cards measured in BARS ("bars 5–8"), but notes.json
// carries no barlines — only a duration per note (`d`, in quarter-note units).
// So bars have to be derived by accumulating durations against the meter.
//
// This is a stopgap, and an honest one: the plan's first Phase 3 item is to
// publish each tune's `.ly`, which states the barlines outright. Until that
// lands, everything here rests on the assumption below.
//
// ASSUMPTION — the tune starts on a downbeat. A pickup (anacrusis) shifts every
// barline by its length, so "bars 5–8" would silently name the wrong bars. That
// assumption is a PARAMETER here (`pickupBeats`), not a hidden default, so a
// caller that learns the truth from the `.ly` can pass it, and a caller that is
// guessing has to guess out loud.

/** Structural minimum: any TuneNote satisfies this. Keeps utils free of the catalog hook. */
export interface TimedNote {
  /** Duration in quarter-note units (0.5 = eighth). */
  d: number
}

/**
 * Quarter-note beats in one bar of `timeSig` ("6/8" -> 3, "4/4" -> 4, "2/2" -> 4).
 * Returns 4 for anything unparseable — a wrong bar length beats a crash, and the
 * caller has no better answer to offer.
 */
export function beatsPerBarFromTimeSig(timeSig: string | undefined): number {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(timeSig ?? '')
  if (!match) return 4
  const beats = Number(match[1])
  const unit = Number(match[2])
  if (!beats || !unit) return 4
  return (beats * 4) / unit
}

/** Cumulative start beat of each note, in quarter notes from the top of the tune. */
function startBeats(notes: TimedNote[], pickupBeats: number): number[] {
  const starts: number[] = []
  let cursor = -pickupBeats // a pickup sits BEFORE bar 1
  for (const note of notes) {
    starts.push(cursor)
    cursor += Math.max(0, note.d)
  }
  return starts
}

/** 1-based bar a beat falls in. Beats before bar 1 (the pickup) report bar 0. */
function measureOfBeat(beat: number, beatsPerBar: number): number {
  if (beat < 0) return 0
  return Math.floor(beat / beatsPerBar) + 1
}

/**
 * How many bars the tune occupies. A final bar that is only partly filled still
 * counts — it is a bar you have to play.
 */
export function measureCount(notes: TimedNote[], beatsPerBar: number, pickupBeats = 0): number {
  if (notes.length === 0 || beatsPerBar <= 0) return 0
  const total = notes.reduce((sum, n) => sum + Math.max(0, n.d), 0) - pickupBeats
  if (total <= 0) return 0
  return Math.ceil(total / beatsPerBar)
}

/**
 * The notes sounding in bars `startMeasure`..`endMeasure` (1-based, inclusive).
 *
 * A note is included when it STARTS inside the range. A note tied across the
 * closing barline belongs to the bar it began in — which is how a player reads
 * a phrase: you finish the note you started.
 */
export function notesInMeasureRange<T extends TimedNote>(
  notes: T[],
  startMeasure: number,
  endMeasure: number,
  beatsPerBar: number,
  pickupBeats = 0,
): T[] {
  if (beatsPerBar <= 0 || endMeasure < startMeasure) return []
  const starts = startBeats(notes, pickupBeats)
  return notes.filter((_, i) => {
    const measure = measureOfBeat(starts[i], beatsPerBar)
    // Pickup notes (bar 0) belong to the phrase that opens the tune.
    const effective = measure === 0 ? 1 : measure
    return effective >= startMeasure && effective <= endMeasure
  })
}
