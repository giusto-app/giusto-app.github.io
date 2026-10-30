import { describe, expect, it } from 'bun:test'
import { measureBoxes, type MeasureRect } from './measureBoxes'
import { dragRange, moveHandle, snapBar, stepHandle } from './rangeDrag'

/** Two systems of four bars: 1-4 at y 40..90, 5-8 at y 160..210; bars 100 px wide from x 60. */
const rects: MeasureRect[] = []
for (let m = 1; m <= 8; m++) {
  const row = Math.floor((m - 1) / 4), col = (m - 1) % 4
  rects.push({ measure: m, left: 60 + col * 100, right: 160 + col * 100, top: 40 + row * 120, bottom: 90 + row * 120 })
}
const boxes = measureBoxes(rects)

describe('snapBar', () => {
  it('snaps to the nearest bar line: the bar it opens for a start, the bar it closes for an end', () => {
    // x 250 is nearest the line at 260, between bars 2 and 3.
    expect(snapBar(boxes, 250, 60, 'start')).toBe(3)
    expect(snapBar(boxes, 250, 60, 'end')).toBe(2)
  })

  it('follows the pointer onto another system, and past a line\'s ends', () => {
    expect(snapBar(boxes, 70, 180, 'start')).toBe(5)
    expect(snapBar(boxes, 900, 60, 'end')).toBe(4)
    expect(snapBar(boxes, 0, 130, 'start')).toBe(5)   // in the gap, nearer system 2
    expect(snapBar([], 0, 0, 'start')).toBeNull()
  })
})

describe('dragRange', () => {
  it('moves one end and keeps the other', () => {
    expect(dragRange({ start: 3, end: 6 }, 'start', 2)).toEqual({ range: { start: 2, end: 6 }, edge: 'start' })
    expect(dragRange({ start: 3, end: 6 }, 'end', 7)).toEqual({ range: { start: 3, end: 7 }, edge: 'end' })
  })

  it('makes a one-bar range when the end comes onto the start bar', () => {
    expect(dragRange({ start: 3, end: 6 }, 'end', 3)).toEqual({ range: { start: 3, end: 3 }, edge: 'end' })
  })

  it('swaps the handles when one is dragged past the other', () => {
    expect(dragRange({ start: 3, end: 6 }, 'start', 8)).toEqual({ range: { start: 6, end: 8 }, edge: 'end' })
    expect(dragRange({ start: 3, end: 6 }, 'end', 1)).toEqual({ range: { start: 1, end: 3 }, edge: 'start' })
  })
})

describe('moveHandle and stepHandle', () => {
  it('moves an armed section\'s bar and keeps it armed', () => {
    expect(moveHandle({ start: 3, end: null }, 'start', 6)).toEqual({ span: { start: 6, end: null }, edge: 'start' })
  })

  it('steps a focused handle one bar, inside the score', () => {
    expect(stepHandle({ start: 3, end: 6 }, 'end', -1, 8)).toEqual({ span: { start: 3, end: 5 }, edge: 'end' })
    expect(stepHandle({ start: 1, end: 6 }, 'start', -1, 8)).toEqual({ span: { start: 1, end: 6 }, edge: 'start' })
    expect(stepHandle({ start: 3, end: 8 }, 'end', 1, 8)).toEqual({ span: { start: 3, end: 8 }, edge: 'end' })
    expect(stepHandle({ start: 3, end: 3 }, 'start', 1, 8)).toEqual({ span: { start: 3, end: 4 }, edge: 'end' })
  })
})
