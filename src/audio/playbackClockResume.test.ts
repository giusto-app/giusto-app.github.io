import { describe, expect, test } from 'bun:test'
import { PlaybackClock } from './PlaybackClock'

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
function scheduledBeats(fromBeat: number | undefined): number[] {
  const ctx = { currentTime: 0 } as unknown as AudioContext
  const clock = new PlaybackClock(ctx, {
    bpm: 120,
    beatsPerMeasure: 4,
    countInBeats: 4,
    totalBeats: 64,
  })
  const beats: number[] = []
  clock.onBeat(e => beats.push(e.beat))
  clock.start(fromBeat)
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
