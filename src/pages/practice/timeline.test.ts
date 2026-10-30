import { describe, expect, it } from 'bun:test'
import { barAtFraction, barFraction, labelledBars, seekBar } from './timeline'

describe('timeline', () => {
  it('numbers every bar when there is room, and thins the numbers when there is not', () => {
    expect(labelledBars(8, 640)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(labelledBars(64, 640)).toEqual([1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64])
    expect(labelledBars(0, 640)).toEqual([])
  })

  it('maps a fraction of the strip to its bar, clamped to the tune', () => {
    expect(barAtFraction(0, 8)).toBe(1)
    expect(barAtFraction(0.49, 8)).toBe(4)
    expect(barAtFraction(1, 8)).toBe(8)
    expect(barAtFraction(-0.2, 8)).toBe(1)
    expect(barFraction(5, 8)).toBe(0.5)
  })

  it('seeks to a bar, kept inside the section when there is one', () => {
    expect(seekBar(0.6, 10, null)).toBe(7)
    expect(seekBar(0.05, 10, { start: 3, end: 6 })).toBe(3)
    expect(seekBar(0.95, 10, { start: 3, end: 6 })).toBe(6)
    expect(seekBar(0.95, 10, { start: 3, end: null })).toBe(10)   // armed: to the end of the tune
  })
})
