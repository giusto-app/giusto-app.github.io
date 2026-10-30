// Elapsed / total time for the Play-Along readout (PLAN_LOOP_RANGE.md, LR6).
//
// A take plays the whole score at the transport's tempo — the slider, or the
// trainer's current step — so a beat's time is just beats at that tempo. The
// score's own \tempo only seeds the slider; nothing plays a tempo change.

/** Quarter-note beats at `bpm` (quarter notes per minute) -> seconds. */
export function beatsToSeconds(beats: number, bpm: number): number {
  return bpm > 0 ? (Math.max(0, beats) * 60) / bpm : 0
}

/** `m:ss`, or `h:mm:ss` past an hour. Floors, so a clock never shows a second early. */
export function formatClock(seconds: number): string {
  const t = Math.floor(Math.max(0, seconds))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** `0:08 / 0:49`: where the transport is, against the whole tune, at `bpm`. */
export function transportTime(beat: number, totalBeats: number, bpm: number): string {
  return `${formatClock(beatsToSeconds(Math.min(beat, totalBeats), bpm))} / ${formatClock(beatsToSeconds(totalBeats, bpm))}`
}
