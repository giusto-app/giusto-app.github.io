import { describe, expect, test } from 'bun:test'
import { keyTransposeOptions, transposedKeyName } from './keyTranspose'

describe('transposedKeyName (matches lilyjs canonical spelling)', () => {
  test('from C', () => {
    expect(transposedKeyName('C', 0)).toBe('C')
    expect(transposedKeyName('C', 2)).toBe('D')
    expect(transposedKeyName('C', 3)).toBe('Eb')
    expect(transposedKeyName('C', -2)).toBe('Bb')
    expect(transposedKeyName('C', 5)).toBe('F')
    expect(transposedKeyName('C', 7)).toBe('G')
  })

  test('from a flat key', () => {
    expect(transposedKeyName('Bb', 2)).toBe('C')
    expect(transposedKeyName('Bb', -2)).toBe('Ab')
  })

  test('from G (up a tone / half steps)', () => {
    expect(transposedKeyName('G', 2)).toBe('A')
    expect(transposedKeyName('G', 1)).toBe('Ab')
    expect(transposedKeyName('G', -1)).toBe('F#')
  })
})

describe('keyTransposeOptions', () => {
  test('12 shifts from −5..+6, original labeled', () => {
    const opts = keyTransposeOptions('C')
    expect(opts.map((o) => o.semitones)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6])
    expect(opts.find((o) => o.semitones === 0)!.label).toBe('C (original)')
    expect(opts.find((o) => o.semitones === 2)!.label).toBe('D')
  })
})
