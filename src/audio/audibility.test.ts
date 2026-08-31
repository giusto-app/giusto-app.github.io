import { describe, expect, test } from 'bun:test'
import {
  initialAudibilityState,
  nextAudibilityState,
  SILENCE_FLOOR,
  SILENCE_GRACE_MS,
  type AudibilitySample,
  type AudibilityState,
} from './audibility'

const LOUD = 0.4

function sample(over: Partial<AudibilitySample> = {}): AudibilitySample {
  return { expectingSound: true, contextState: 'running', peak: LOUD, now: 0, ...over }
}

/** Feed a run of observations, newest state out. */
function run(state: AudibilityState, samples: AudibilitySample[]): AudibilityState {
  return samples.reduce(nextAudibilityState, state)
}

describe('nextAudibilityState', () => {
  test('audible playback reports nothing', () => {
    const s = run(initialAudibilityState(0), [sample({ now: 100 }), sample({ now: 200 })])
    expect(s.issue).toBeNull()
  })

  test('a suspended context is reported as blocked', () => {
    const s = nextAudibilityState(initialAudibilityState(0), sample({ contextState: 'suspended', now: 100 }))
    expect(s.issue).toBe('blocked')
  })

  test("Safari's interrupted state outranks a plain block", () => {
    const s = nextAudibilityState(initialAudibilityState(0), sample({ contextState: 'interrupted', now: 100 }))
    expect(s.issue).toBe('interrupted')
  })

  test('silence is only reported once it outlasts the grace window', () => {
    const start = initialAudibilityState(0)
    const early = nextAudibilityState(start, sample({ peak: 0, now: SILENCE_GRACE_MS - 1 }))
    expect(early.issue).toBeNull()

    const late = nextAudibilityState(early, sample({ peak: 0, now: SILENCE_GRACE_MS }))
    expect(late.issue).toBe('silent')
  })

  test('a metronome click inside the grace window keeps the banner away', () => {
    // Clicks every 1.5 s (40 bpm) with silence between: never flat long enough.
    let state = initialAudibilityState(0)
    for (let t = 0; t <= 10_000; t += 100) {
      state = nextAudibilityState(state, sample({ peak: t % 1500 === 0 ? LOUD : 0, now: t }))
      expect(state.issue).toBeNull()
    }
  })

  test('sound returning clears a latched silent verdict', () => {
    const silent = run(initialAudibilityState(0), [
      sample({ peak: 0, now: SILENCE_GRACE_MS }),
      sample({ peak: 0, now: SILENCE_GRACE_MS + 100 }),
    ])
    expect(silent.issue).toBe('silent')

    const recovered = nextAudibilityState(silent, sample({ now: SILENCE_GRACE_MS + 200 }))
    expect(recovered.issue).toBeNull()
  })

  test('peaks at the floor count as audible, below it as silence', () => {
    const atFloor = nextAudibilityState(initialAudibilityState(0), sample({ peak: SILENCE_FLOOR, now: SILENCE_GRACE_MS }))
    expect(atFloor.issue).toBeNull()

    const belowFloor = nextAudibilityState(initialAudibilityState(0), sample({ peak: SILENCE_FLOOR / 2, now: SILENCE_GRACE_MS }))
    expect(belowFloor.issue).toBe('silent')
  })

  test('nothing is reported while no source claims to be playing', () => {
    const idle = run(initialAudibilityState(0), [
      sample({ expectingSound: false, contextState: 'suspended', peak: 0, now: 5_000 }),
      sample({ expectingSound: false, contextState: 'suspended', peak: 0, now: 20_000 }),
    ])
    expect(idle.issue).toBeNull()
  })

  test('the grace window restarts after an idle span, not mid-silence', () => {
    // Quiet for 20 s with nothing playing, then a take starts: the fresh take
    // gets its own full grace window before anything is claimed inaudible.
    const idle = nextAudibilityState(initialAudibilityState(0), sample({ expectingSound: false, peak: 0, now: 20_000 }))
    const justStarted = nextAudibilityState(idle, sample({ peak: 0, now: 20_100 }))
    expect(justStarted.issue).toBeNull()
  })
})
