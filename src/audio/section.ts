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
 * Fold a bar click into the selection (PLAN_LOOP_RANGE.md, LR12, Marc
 * 2026-10-30). `barStart`/`barEnd` are the clicked bar's own bounds —
 * `beatAtMeasure(n)` and `beatAtMeasure(n + 1)`.
 *
 * | Current            | Click                         | Result                          |
 * | ------------------ | ----------------------------- | ------------------------------- |
 * | none               | bar N                         | bar N alone (a one-bar section) |
 * | any                | a bar right before or after it| extended to include that bar    |
 * | several bars       | a bar inside it               | unchanged                       |
 * | one bar            | that bar                      | cleared                         |
 * | any                | any other bar                 | bar N alone: a fresh selection  |
 *
 * A click never leaves the selection waiting for a second one: it always
 * makes a complete section, and the range's handles stretch it. A section
 * armed by an earlier version (`endBeat` null) counts as its start bar.
 */
export function nextSection(current: Section | null, barStart: number, barEnd: number): Section | null {
  const only: Section = { startBeat: barStart, endBeat: barEnd }
  if (!current) return only
  const curEnd = current.endBeat ?? current.startBeat + (barEnd - barStart)
  if (barStart === current.startBeat && barEnd === curEnd) return null
  if (barStart >= current.startBeat && barEnd <= curEnd) return { startBeat: current.startBeat, endBeat: curEnd }
  if (barEnd === current.startBeat) return { startBeat: barStart, endBeat: curEnd }
  if (barStart === curEnd) return { startBeat: current.startBeat, endBeat: barEnd }
  return only
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
 * Clock beats -> tune beats for one take, one PASS at a time.
 *
 * Each pass of a looping take has its own window, read from `nextWindow` when
 * the pass is first reached: moving the range while playing changes the NEXT
 * pass and lets the current one finish (decision D2, PLAN_LOOP_RANGE.md). The
 * clock's beats keep counting up across passes; a pass starts where the
 * previous one ended.
 *
 * Passes are appended lazily by whoever reaches a new beat first. The audio
 * scheduler runs ahead of the visual callbacks, so by the time the cursor asks
 * about a beat, its pass already exists and both agree on the window.
 *
 * The first pass's clock beats ARE tune beats (`clock.start(resumeBeat)`), so a
 * take resumed at bar 7 inside a 5-12 loop still wraps back to 5.
 */
export class TakeTimeline {
  private readonly passes: { rawStart: number; window: TakeWindow }[]

  constructor(first: TakeWindow, private readonly looping: boolean, private readonly nextWindow: () => TakeWindow) {
    this.passes = [{ rawStart: first.startBeat, window: first }]
  }

  /** The tune beat a clock beat plays. Not looping: the clock beat itself. */
  tuneBeat(raw: number): number {
    if (!this.looping) return raw
    const first = this.passes[0]!
    if (raw < first.rawStart) {
      // Before the first pass's start: wrap into the first window, never
      // divide by an empty one.
      const len = first.window.lengthBeats
      if (len <= 0) return raw
      const rel = (raw - first.rawStart) % len
      return first.window.startBeat + (rel < 0 ? rel + len : rel)
    }
    const pass = this.passAt(raw)
    return pass.window.startBeat + (raw - pass.rawStart)
  }

  /**
   * Which pass a clock beat falls in, 0 for the first. Found by the pass's
   * span, never by an equality test on a boundary: a 9/8 bar is 4.5 quarter
   * notes, so the clock's whole beats rarely land on one.
   */
  passIndex(raw: number): number {
    if (!this.looping || raw < this.passes[0]!.rawStart) return 0
    this.passAt(raw)
    for (let i = this.passes.length - 1; i >= 0; i--) if (raw >= this.passes[i]!.rawStart) return i
    return 0
  }

  /** The window of the pass a clock beat falls in. */
  windowAt(raw: number): TakeWindow {
    return !this.looping || raw < this.passes[0]!.rawStart ? this.passes[0]!.window : this.passAt(raw).window
  }

  private passAt(raw: number) {
    let last = this.passes[this.passes.length - 1]!
    // An empty window never ends, so it cannot divide time into passes.
    while (last.window.lengthBeats > 0 && raw >= last.rawStart + last.window.lengthBeats) {
      last = { rawStart: last.rawStart + last.window.lengthBeats, window: this.nextWindow() }
      this.passes.push(last)
    }
    for (let i = this.passes.length - 1; i > 0; i--) if (raw >= this.passes[i]!.rawStart) return this.passes[i]!
    return this.passes[0]!
  }
}
