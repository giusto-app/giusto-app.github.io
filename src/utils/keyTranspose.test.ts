import { describe, expect, test } from 'bun:test'
import { keyTransposeOptions } from './keyTranspose'

// The spelling itself is lilyjs's (src/music-tools/transforms/transposeKey.ts,
// covered there). What this file owns is the OPTION LIST: the range offered and
// how the current key is labeled.
describe('keyTransposeOptions', () => {
  test('12 shifts from −5..+6, original labeled', () => {
    const opts = keyTransposeOptions('C')
    expect(opts.map((o) => o.semitones)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6])
    expect(opts.find((o) => o.semitones === 0)!.label).toBe('C (original)')
    expect(opts.find((o) => o.semitones === 2)!.label).toBe('D')
  })

  test('a minor exercise is labeled minor at every step', () => {
    // Merry-Go-Round of Life is `\key g \minor`. The badge read "G (original)"
    // while this module re-derived the spelling from its own table.
    const opts = keyTransposeOptions('Gm')
    expect(opts.find((o) => o.semitones === 0)!.label).toBe('Gm (original)')
    expect(opts.find((o) => o.semitones === 2)!.label).toBe('Am')
    expect(opts.every((o) => o.label.replace(' (original)', '').endsWith('m'))).toBe(true)
  })
})
