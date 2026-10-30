import { describe, expect, it } from 'bun:test'
import { measureAtPoint, measureBoxes, rangeSegments, type MeasureRect } from './measureBoxes'

/**
 * A piano-style score as lilyjs draws it: two systems, two staves each, one
 * transparent `measure-area` rect per bar per staff. System 1 holds bars 1-4
 * (y 40..90 treble, 120..170 bass), system 2 bars 5-8 (y 260..310, 340..390).
 */
const rect = (measure: number, left: number, right: number, top: number, bottom: number): MeasureRect => ({ measure, left, right, top, bottom })
const score: MeasureRect[] = []
for (const [i, x] of [[1, 60], [2, 160], [3, 260], [4, 360]] as const) {
  score.push(rect(i, x, x + 100, 40, 90), rect(i, x, x + 100, 120, 170))
}
for (const [i, x] of [[5, 30], [6, 130], [7, 230], [8, 330]] as const) {
  score.push(rect(i, x, x + 100, 260, 310), rect(i, x, x + 100, 340, 390))
}

describe('measureBoxes', () => {
  const boxes = measureBoxes(score)

  it('unites a bar\'s staves into one box', () => {
    expect(boxes).toHaveLength(8)
    expect(boxes[0]).toEqual({ measure: 1, left: 60, right: 160, top: 40, bottom: 170, system: 0 })
  })

  it('tells systems apart by vertical position', () => {
    expect(boxes.map((b) => b.system)).toEqual([0, 0, 0, 0, 1, 1, 1, 1])
  })

  it('splits a range that wraps into one band per system', () => {
    expect(rangeSegments(boxes, 3, 6)).toEqual([
      { system: 0, left: 260, right: 460, top: 40, bottom: 170, firstMeasure: 3, lastMeasure: 4 },
      { system: 1, left: 30, right: 230, top: 260, bottom: 390, firstMeasure: 5, lastMeasure: 6 },
    ])
  })

  it('takes the range in either order, and one bar as one band', () => {
    expect(rangeSegments(boxes, 6, 3)).toEqual(rangeSegments(boxes, 3, 6))
    expect(rangeSegments(boxes, 2, 2)).toEqual([{ system: 0, left: 160, right: 260, top: 40, bottom: 170, firstMeasure: 2, lastMeasure: 2 }])
  })

  it('finds the bar under a point, snapping to the nearest system and bar', () => {
    expect(measureAtPoint(boxes, 200, 100)).toBe(2)   // between the staves of bar 2
    expect(measureAtPoint(boxes, 500, 60)).toBe(4)    // past the end of line 1
    expect(measureAtPoint(boxes, 50, 230)).toBe(5)    // in the gap, nearer line 2
    expect(measureAtPoint([], 0, 0)).toBeNull()
  })
})
