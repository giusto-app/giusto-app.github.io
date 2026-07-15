import { describe, expect, test } from 'bun:test'
import { playWoodblock } from './woodblock'
import { FakeAudioContext, asAudioContext } from './testing/fakeAudioContext'

describe('playWoodblock', () => {
  test('schedules a short square burst through a high-Q bandpass at the given time', () => {
    const fake = new FakeAudioContext()
    playWoodblock(asAudioContext(fake), fake.destination as unknown as AudioNode, 1.5, false, 1)

    expect(fake.oscillators).toHaveLength(1)
    const osc = fake.oscillators[0]
    expect(osc.type).toBe('square')
    expect(osc.frequency.value).toBe(800)
    expect(osc.startedAt).toBe(1.5)
    // Total ring must stay under 100 ms so clicks never smear at fast tempos.
    expect(osc.stoppedAt! - osc.startedAt!).toBeLessThanOrEqual(0.1)

    expect(fake.filters).toHaveLength(1)
    expect(fake.filters[0].type).toBe('bandpass')
    expect(fake.filters[0].Q.value).toBe(8)
    expect(fake.filters[0].frequency.value).toBe(800)
  })

  test('accent clicks are higher-pitched and louder', () => {
    const fake = new FakeAudioContext()
    playWoodblock(asAudioContext(fake), fake.destination as unknown as AudioNode, 0, true, 1)
    playWoodblock(asAudioContext(fake), fake.destination as unknown as AudioNode, 1, false, 1)

    const [accent, normal] = fake.oscillators
    expect(accent.frequency.value).toBeGreaterThan(normal.frequency.value)

    const accentPeak = fake.gains[0].gain.events.find(e => e.type === 'set')!.value
    const normalPeak = fake.gains[1].gain.events.find(e => e.type === 'set')!.value
    expect(accentPeak).toBeGreaterThan(normalPeak)
  })

  test('envelope: instant attack, exponential decay to a floor, then hard zero', () => {
    const fake = new FakeAudioContext()
    playWoodblock(asAudioContext(fake), fake.destination as unknown as AudioNode, 2, false, 0.5)

    const events = fake.gains[0].gain.events
    expect(events[0]).toMatchObject({ type: 'set', time: 2 })
    expect(events[0].value).toBeCloseTo(0.35, 9) // 0.7 non-accent × 0.5 volume
    expect(events[1].type).toBe('exponentialRamp')
    expect(events[1].value).toBeCloseTo(0.001, 9) // exponentialRamp cannot reach 0
    const last = events[events.length - 1]
    expect(last).toMatchObject({ type: 'set', value: 0 })
    expect(last.time).toBeGreaterThan(events[1].time)
  })

  test('respects the volume argument', () => {
    const fake = new FakeAudioContext()
    playWoodblock(asAudioContext(fake), fake.destination as unknown as AudioNode, 0, false, 0)
    expect(fake.gains[0].gain.events[0].value).toBe(0)
  })
})
