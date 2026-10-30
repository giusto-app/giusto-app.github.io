import { describe, expect, it } from 'bun:test'
import { rangeBounds, rangeHandles, type BandBox } from './rangeOverlayGeometry'

/** A 5-12 range wrapping over two systems, as lilyjs draws it (px). */
const bands: BandBox[] = [
  { system: 2, left: 60, right: 460, top: 280, bottom: 330 },
  { system: 1, left: 60, right: 460, top: 160, bottom: 210 },
]

describe('rangeBounds', () => {
  it('asks lilyjs for the section\'s bars, an armed one as its start bar', () => {
    expect(rangeBounds({ start: 5, end: 12 })).toEqual([{ measure: 5 }, { measure: 12 }])
    expect(rangeBounds({ start: 7, end: null })).toEqual([{ measure: 7 }, { measure: 7 }])
  })
})

describe('rangeHandles', () => {
  it('puts the start handle on the first system\'s band and the end handle on the last', () => {
    expect(rangeHandles(bands, { start: 5, end: 12 })).toEqual({
      start: { x: 60, top: 160, bottom: 210, measure: 5 },
      end: { x: 460, top: 280, bottom: 330, measure: 12 },
    })
  })

  it('gives an armed section no end handle', () => {
    expect(rangeHandles(bands.slice(1), { start: 7, end: null })!.end).toBeNull()
  })

  it('places nothing without a section or without drawn bands', () => {
    expect(rangeHandles(bands, null)).toBeNull()
    expect(rangeHandles([], { start: 5, end: 12 })).toBeNull()
  })
})
