import { describe, expect, test } from 'bun:test'
import { clicksInWindow, pulseFromTimeSignature } from './meter'

describe('pulseFromTimeSignature', () => {
  test('simple meters pulse on the quarter', () => {
    expect(pulseFromTimeSignature({ beats: 4, beatUnit: 4 })).toBe(1)
    expect(pulseFromTimeSignature({ beats: 3, beatUnit: 4 })).toBe(1)
    expect(pulseFromTimeSignature({ beats: 2, beatUnit: 4 })).toBe(1)
  })

  test('compound meters pulse on the dotted quarter', () => {
    expect(pulseFromTimeSignature({ beats: 6, beatUnit: 8 })).toBe(1.5)
    expect(pulseFromTimeSignature({ beats: 9, beatUnit: 8 })).toBe(1.5)
    expect(pulseFromTimeSignature({ beats: 12, beatUnit: 8 })).toBe(1.5)
  })

  test('non-compound eighth meters stay on the quarter', () => {
    expect(pulseFromTimeSignature({ beats: 5, beatUnit: 8 })).toBe(1)
    expect(pulseFromTimeSignature({ beats: 7, beatUnit: 8 })).toBe(1)
  })

  test('half-note meters pulse on the half', () => {
    expect(pulseFromTimeSignature({ beats: 2, beatUnit: 2 })).toBe(2)
  })

  test('missing signature defaults to the quarter', () => {
    expect(pulseFromTimeSignature(null)).toBe(1)
    expect(pulseFromTimeSignature(undefined)).toBe(1)
  })
})

describe('clicksInWindow', () => {
  test('4/4: one click per clock beat, downbeat every 4', () => {
    expect(clicksInWindow(0, 1, 1, 4)).toEqual([{ beat: 0, isDownbeat: true }])
    expect(clicksInWindow(3, 4, 1, 4)).toEqual([{ beat: 3, isDownbeat: false }])
    expect(clicksInWindow(4, 5, 1, 4)).toEqual([{ beat: 4, isDownbeat: true }])
  })

  test('6/8 (pulse 1.5, bar 3 QN): clicks at 0 and 1.5 per bar — never at 1 or 2', () => {
    const bar = [
      ...clicksInWindow(0, 1, 1.5, 3),
      ...clicksInWindow(1, 2, 1.5, 3),
      ...clicksInWindow(2, 3, 1.5, 3),
    ]
    expect(bar).toEqual([
      { beat: 0, isDownbeat: true },
      { beat: 1.5, isDownbeat: false },
    ])
    // next bar starts a new downbeat
    expect(clicksInWindow(3, 4, 1.5, 3)).toEqual([{ beat: 3, isDownbeat: true }])
  })

  test('count-in windows (negative beats) stay on the same grid', () => {
    // one 6/8 count-in bar: clock beats -3..-1 → clicks at -3 (accented) and -1.5
    const countIn = [
      ...clicksInWindow(-3, -2, 1.5, 3),
      ...clicksInWindow(-2, -1, 1.5, 3),
      ...clicksInWindow(-1, 0, 1.5, 3),
    ]
    expect(countIn).toEqual([
      { beat: -3, isDownbeat: true },
      { beat: -1.5, isDownbeat: false },
    ])
  })

  test('12/8: four pulses per bar, downbeat only on the first', () => {
    const clicks = []
    for (let b = 0; b < 6; b++) clicks.push(...clicksInWindow(b, b + 1, 1.5, 6))
    expect(clicks).toEqual([
      { beat: 0, isDownbeat: true },
      { beat: 1.5, isDownbeat: false },
      { beat: 3, isDownbeat: false },
      { beat: 4.5, isDownbeat: false },
    ])
  })
})
