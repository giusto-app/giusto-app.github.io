import { describe, expect, test } from 'bun:test'
import { PlaybackClock } from './playbackClock'

/**
 * Resuming after a pause must land on the INTEGRAL beat grid.
 *
 * `pausePlayback` stores the SOUNDING beat, which is deliberately fractional
 * (`anchor.beat + frac` in PracticePlayback) so the highlight shows exactly
 * where the user stopped. `scheduleAhead` advances by whole beats, so feeding
 * that fraction straight into `nextBeat` shifted every following beat — and
 * every downbeat — by the same fraction for the rest of the take. That is why
 * chord highlighting lagged after stop/restart.
 */
globalThis.requestAnimationFrame ??= (() => 0) as typeof requestAnimationFrame
globalThis.cancelAnimationFrame ??= (() => {}) as typeof cancelAnimationFrame

/** Beats the transport actually schedules when started from `fromBeat`. */
function scheduledBeats(fromBeat: number | undefined, options?: { countIn?: boolean }): number[] {
  const ctx = { currentTime: 0 } as unknown as AudioContext
  const clock = new PlaybackClock(ctx, {
    bpm: 120,
    beatsPerMeasure: 4,
    countInBeats: 4,
    totalBeats: 64,
    // Schedule several beats at once, so a count-in and what follows it are seen.
    lookaheadS: 4,
  })
  const beats: number[] = []
  clock.onBeat(e => beats.push(e.beat))
  clock.start(fromBeat, options)
  clock.stop()
  return beats
}

describe('PlaybackClock resume snaps to the beat grid', () => {
  test('a fractional resume point floors to the beat it was inside', () => {
    // Paused 0.7 through beat 12 -> replay beat 12 from its start. Never 12.7,
    // which would offset every following beat; never 13, which would skip the
    // rest of a beat the user had not finished hearing.
    expect(scheduledBeats(12.7)[0]).toBe(12)
    expect(scheduledBeats(12.001)[0]).toBe(12)
  })

  test('every scheduled beat stays a whole number after a fractional resume', () => {
    for (const beat of scheduledBeats(12.7)) {
      expect(Number.isInteger(beat)).toBe(true)
    }
  })

  test('an exact beat resumes unchanged', () => {
    expect(scheduledBeats(16)[0]).toBe(16)
  })

  test('omitting the resume point still starts at the count-in', () => {
    expect(scheduledBeats(undefined)[0]).toBe(-4)
  })
})

describe('PlaybackClock counts in a take that starts at a section', () => {
  test('a section start is counted in with negative beats, then plays from the section', () => {
    // Bars 4-7 of a 4/4 tune: the take starts at beat 12. The count-in must
    // stay negative, or the cursor and the timeline read it as bars 3 (USER
    // 2026-10-30: "the measure tracker started moving while only the count-in
    // was playing").
    expect(scheduledBeats(12, { countIn: true }).slice(0, 6)).toEqual([-4, -3, -2, -1, 12, 13])
  })

  test('a section at bar 1 is counted in too', () => {
    expect(scheduledBeats(0, { countIn: true }).slice(0, 5)).toEqual([-4, -3, -2, -1, 0])
  })

  test('a resume is not counted in', () => {
    expect(scheduledBeats(12).slice(0, 2)).toEqual([12, 13])
  })
})
