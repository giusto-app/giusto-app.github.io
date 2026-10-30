import { describe, expect, test } from 'bun:test'
import { beatsToSeconds, formatClock, transportTime } from './transportTime'

describe('transportTime', () => {
  test('a beat at 60 bpm is a second; at 120, half of one', () => {
    expect(beatsToSeconds(4, 60)).toBe(4)
    expect(beatsToSeconds(4, 120)).toBe(2)
    expect(beatsToSeconds(4, 0)).toBe(0)
  })

  test('formats minutes and seconds, flooring', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(8.99)).toBe('0:08')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
  })

  test('reads elapsed against the whole tune, never past its end', () => {
    // 32 bars of 4/4 at 80 bpm = 128 beats = 96 s.
    expect(transportTime(0, 128, 80)).toBe('0:00 / 1:36')
    expect(transportTime(16, 128, 80)).toBe('0:12 / 1:36')
    expect(transportTime(200, 128, 80)).toBe('1:36 / 1:36')
  })
})
