// A SECTION is the run of bars a take plays — "drill bars 5 to 12".
//
// All of it is beat arithmetic with no transport and no React, so the rules can
// be tested on their own (section.test.ts). The transport reads these; it does
// not reimplement them. Full rationale and the user stories these serve:
// PLAN_PLAYBACK_START_POINT.md.

export interface Section {
  startBeat: number
  /** Exclusive. null = armed with no end yet — play from `startBeat` to the end of the tune. */
  endBeat: number | null
}

/** The span one take covers: where it begins and how far it runs before looping or ending. */
export interface TakeWindow {
  startBeat: number
  lengthBeats: number
}

/**
 * Fold a bar click into the selection. `barStart`/`barEnd` are the clicked bar's
 * own bounds — `beatAtMeasure(n)` and `beatAtMeasure(n + 1)`.
 *
 * | Current      | Click            | Result                                    |
 * | ------------ | ---------------- | ----------------------------------------- |
 * | none         | bar N            | armed at N (plays N to the end of the tune)|
 * | any          | its start bar    | cleared                                   |
 * | armed at N   | bar M            | the span N–M, in either click order       |
 * | complete     | any other bar    | a fresh armed selection there             |
 *
 * The second click is order-independent because clicking 12 then 5 plainly means
 * 5–12; rejecting it would be a puzzle rather than a safeguard. A click on a
 * COMPLETE section never extends it — after mis-clicking an end you want a fresh
 * start, not a wider drill.
 */
export function nextSection(current: Section | null, barStart: number, barEnd: number): Section | null {
  if (!current) return { startBeat: barStart, endBeat: null }
  if (barStart === current.startBeat) return null
  if (current.endBeat !== null) return { startBeat: barStart, endBeat: null }

  // Armed: close the span. Bars are uniform, so the armed bar's own end is its
  // start plus one bar — the only way to close a BACKWARDS selection, where the
  // armed bar becomes the last one.
  if (barStart < current.startBeat) {
    return { startBeat: barStart, endBeat: current.startBeat + (barEnd - barStart) }
  }
  return { startBeat: current.startBeat, endBeat: barEnd }
}

/**
 * Where the next take begins. `undefined` means "from the top" — what
 * `PlaybackClock.start` expects for an unspecified position.
 *
 * A pause outranks the section start because it is the more recent, more
 * specific statement of where you are: you asked to continue. The take still
 * belongs to the section, so once it ends the pause is spent and the following
 * take is back at the section start.
 */
export function resolveStartBeat(pauseBeat: number | null, section: Section | null): number | undefined {
  return pauseBeat ?? section?.startBeat ?? undefined
}

/**
 * The window a take covers. With no section this is the whole tune, which is why
 * looping and bounding need no special case for the sectionless path.
 */
export function takeWindow(section: Section | null, totalBeats: number): TakeWindow {
  const startBeat = section?.startBeat ?? 0
  return { startBeat, lengthBeats: (section?.endBeat ?? totalBeats) - startBeat }
}

/**
 * Which pass of the take a beat falls in, counting from 0 at the take's start.
 *
 * Floor division rather than testing the boundary for equality: in compound
 * meters a bar is a fractional number of quarter notes (9/8 = 4.5), so a
 * `(beat - start) % length === 0` test lands on nothing and a per-loop tempo
 * ramp never steps at all.
 */
export function passIndex(beat: number, w: TakeWindow): number {
  if (w.lengthBeats <= 0) return 0
  return Math.floor((beat - w.startBeat) / w.lengthBeats)
}

/**
 * Raw clock beat -> tune beat, wrapping inside the window while looping.
 *
 * The window is fixed by the SECTION, not by where this take happened to start:
 * resuming at bar 7 inside a 5–12 loop still wraps back to 5.
 */
export function beatInTake(rawBeat: number, w: TakeWindow, looping: boolean): number {
  if (!looping || w.lengthBeats <= 0) return rawBeat
  const rel = (rawBeat - w.startBeat) % w.lengthBeats
  return w.startBeat + (rel < 0 ? rel + w.lengthBeats : rel)
}
