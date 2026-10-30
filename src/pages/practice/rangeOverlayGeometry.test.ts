import { describe, expect, it } from 'bun:test'
import { measureBoxes, type MeasureRect } from './measureBoxes'
import { rangeOverlayGeometry } from './rangeOverlayGeometry'

/**
 * Three systems of four bars, one staff each: bars 1-4 (y 40..90),
 * 5-8 (y 160..210), 9-12 (y 280..330); every bar 100 px wide from x 60.
 */
const rects: MeasureRect[] = []
for (let m = 1; m <= 12; m++) {
  const row = Math.floor((m - 1) / 4), col = (m - 1) % 4
  rects.push({ measure: m, left: 60 + col * 100, right: 160 + col * 100, top: 40 + row * 120, bottom: 90 + row * 120 })
}
const boxes = measureBoxes(rects)

describe('rangeOverlayGeometry', () => {
  it('draws a 5-12 section that wraps as one band per system, handles on its ends', () => {
    const g = rangeOverlayGeometry(boxes, { start: 5, end: 12 })!
    expect(g.bands.map((b) => [b.system, b.left, b.right, b.firstMeasure, b.lastMeasure])).toEqual([
      [1, 60, 460, 5, 8],
      [2, 60, 460, 9, 12],
    ])
    expect(g.start).toEqual({ x: 60, top: 160, bottom: 210, measure: 5 })
    expect(g.end).toEqual({ x: 460, top: 280, bottom: 330, measure: 12 })
  })

  it('puts the handles on the section\'s own bars, not the systems\' ends', () => {
    const g = rangeOverlayGeometry(boxes, { start: 3, end: 6 })!
    expect(g.bands.map((b) => [b.left, b.right])).toEqual([[260, 460], [60, 260]])
    expect([g.start.x, g.end!.x]).toEqual([260, 260])
    expect([g.start.top, g.end!.top]).toEqual([40, 160])
  })

  it('shows an armed section as its start bar, with no end handle', () => {
    const g = rangeOverlayGeometry(boxes, { start: 7, end: null })!
    expect(g.bands.map((b) => [b.left, b.right])).toEqual([[260, 360]])
    expect(g.end).toBeNull()
  })

  it('draws nothing without a section, or for bars the score does not have', () => {
    expect(rangeOverlayGeometry(boxes, null)).toBeNull()
    expect(rangeOverlayGeometry(boxes, { start: 20, end: 24 })).toBeNull()
  })
})
