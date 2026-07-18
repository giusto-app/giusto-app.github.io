import { afterEach, describe, expect, test } from 'bun:test'
import { PlaybackClock, beatIsDownbeat, secondsPerBeat } from './playbackClock'
import type { BeatEvent } from './playbackClock'

// bun's test environment has no requestAnimationFrame — the visual loop needs
// a polyfill (timing precision is irrelevant for these assertions).
const g = globalThis as unknown as {
  requestAnimationFrame?: (cb: (t: number) => void) => number
  cancelAnimationFrame?: (id: number) => void
}
g.requestAnimationFrame ??= cb => setTimeout(() => cb(performance.now()), 16) as unknown as number
g.cancelAnimationFrame ??= id => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)

/** Fake context whose audio clock follows real time (needed by the lookahead loop). */
function realtimeCtx(): AudioContext {
  const t0 = performance.now()
  return {
    get currentTime() {
      return (performance.now() - t0) / 1000
    },
  } as unknown as AudioContext
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let activeClock: PlaybackClock | null = null
afterEach(() => {
  activeClock?.stop()
  activeClock = null
})

describe('beat math', () => {
  test('secondsPerBeat', () => {
    expect(secondsPerBeat(60)).toBe(1)
    expect(secondsPerBeat(120)).toBe(0.5)
  })

  test('beatIsDownbeat accents bar starts, including negative count-in beats', () => {
    expect(beatIsDownbeat(0, 4)).toBe(true)
    expect(beatIsDownbeat(1, 4)).toBe(false)
    expect(beatIsDownbeat(4, 4)).toBe(true)
    expect(beatIsDownbeat(-4, 4)).toBe(true) // count-in bar start
    expect(beatIsDownbeat(-3, 4)).toBe(false)
    expect(beatIsDownbeat(0, 3)).toBe(true)
    expect(beatIsDownbeat(3, 3)).toBe(true)
  })
})

describe('PlaybackClock scheduling', () => {
  test('emits beats with exact 60/bpm spacing, future timestamps, count-in first', async () => {
    const ctx = realtimeCtx()
    const clock = new PlaybackClock(ctx, { bpm: 300, beatsPerMeasure: 4, countInBeats: 2 })
    activeClock = clock

    const events: BeatEvent[] = []
    const scheduledAt: number[] = []
    clock.onBeat(e => {
      events.push(e)
      scheduledAt.push(ctx.currentTime)
    })

    clock.start()
    expect(clock.isPlaying).toBe(true)
    await sleep(500)
    clock.stop()

    expect(events.length).toBeGreaterThanOrEqual(3)
    // Count-in beats come first: -2, -1, then 0, 1, …
    expect(events[0].beat).toBe(-2)
    expect(events[1].beat).toBe(-1)
    expect(events[2].beat).toBe(0)
    // Spacing is exact arithmetic (nextBeatTime += 60/bpm), not timer-jittered.
    for (let i = 1; i < events.length; i++) {
      expect(events[i].time - events[i - 1].time).toBeCloseTo(60 / 300, 9)
    }
    // Lookahead contract: every beat is scheduled BEFORE its audible time.
    events.forEach((e, i) => expect(scheduledAt[i]).toBeLessThanOrEqual(e.time))
    // Downbeat flags follow beatsPerMeasure=4 (beat 0 accented, 1–3 not).
    const beat0 = events.find(e => e.beat === 0)!
    const beat1 = events.find(e => e.beat === 1)
    expect(beat0.isDownbeat).toBe(true)
    if (beat1) expect(beat1.isDownbeat).toBe(false)
  })

  test('setBpm takes effect from the next unscheduled beat without restarting', async () => {
    const ctx = realtimeCtx()
    const clock = new PlaybackClock(ctx, { bpm: 300 })
    activeClock = clock
    const events: BeatEvent[] = []
    clock.onBeat(e => events.push(e))
    clock.start()
    await sleep(150)
    clock.setBpm(150)
    await sleep(450)
    clock.stop()

    const spacings = events.slice(1).map((e, i) => e.time - events[i].time)
    expect(spacings.some(s => Math.abs(s - 0.2) < 1e-9)).toBe(true) // 300 bpm
    expect(spacings.some(s => Math.abs(s - 0.4) < 1e-9)).toBe(true) // 150 bpm
    expect(clock.bpm).toBe(150)
  })

  test('totalBeats ends the run and fires onEnded', async () => {
    const ctx = realtimeCtx()
    const clock = new PlaybackClock(ctx, { bpm: 300, totalBeats: 2 })
    activeClock = clock
    const beats: number[] = []
    let ended = 0
    clock.onBeat(e => beats.push(e.beat))
    clock.onEnded(() => { ended++ })
    clock.start()
    await sleep(700)

    expect(beats).toEqual([0, 1])
    expect(ended).toBe(1)
    expect(clock.isPlaying).toBe(false)
  })

  test('setTotalBeats gives an endless run a musical stopping boundary', async () => {
    const ctx = realtimeCtx()
    const clock = new PlaybackClock(ctx, { bpm: 300 })
    activeClock = clock
    const beats: number[] = []
    let ended = 0
    clock.onBeat(e => {
      beats.push(e.beat)
      if (e.beat === 1) clock.setTotalBeats(3)
    })
    clock.onEnded(() => { ended++ })
    clock.start()
    await sleep(900)

    expect(beats).toEqual([0, 1, 2])
    expect(ended).toBe(1)
    expect(clock.isPlaying).toBe(false)
  })

  test('stop() halts scheduling immediately', async () => {
    const ctx = realtimeCtx()
    const clock = new PlaybackClock(ctx, { bpm: 300 })
    activeClock = clock
    const events: BeatEvent[] = []
    clock.onBeat(e => events.push(e))
    clock.start()
    await sleep(100)
    clock.stop()
    const countAtStop = events.length
    await sleep(300)
    expect(events.length).toBe(countAtStop)
    expect(clock.isPlaying).toBe(false)
  })
})
