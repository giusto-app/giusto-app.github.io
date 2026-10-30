import { describe, expect, test } from 'bun:test'
import { effectiveBpm, PLAYBACK_SPEEDS, speedLabel } from './playbackSpeed'

describe('playbackSpeed', () => {
  test('scales the transport tempo, and never stops the clock', () => {
    expect(effectiveBpm(80, 0.75)).toBe(60)
    expect(effectiveBpm(80, 1.2)).toBe(96)
    expect(effectiveBpm(80, 0)).toBe(80)
  })

  test('offers 50-120 % with normal speed among them', () => {
    expect(PLAYBACK_SPEEDS[0]).toBe(0.5)
    expect(PLAYBACK_SPEEDS[PLAYBACK_SPEEDS.length - 1]).toBe(1.2)
    expect(PLAYBACK_SPEEDS).toContain(1)
    expect(speedLabel(0.75)).toBe('75 %')
  })
})
