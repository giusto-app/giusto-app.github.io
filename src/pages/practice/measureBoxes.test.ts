import { describe, expect, it } from 'bun:test'
import { measureAtPoint, measureBoxes, type MeasureRect } from './measureBoxes'

/**
 * A piano-style score as lilyjs draws it: two systems, two staves each, one
 * transparent `measure-area` rect per bar per staff, tagged with its system.
 * System 0 holds bars 1-4 (y 40..90 treble, 120..170 bass), system 1 bars 5-8
 * (y 260..310, 340..390).
 */
const rect = (measure: number, system: number, left: number, right: number, top: number, bottom: number): MeasureRect => ({ measure, system, left, right, top, bottom })
const score: MeasureRect[] = []
for (const [i, x] of [[1, 60], [2, 160], [3, 260], [4, 360]] as const) {
  score.push(rect(i, 0, x, x + 100, 40, 90), rect(i, 0, x, x + 100, 120, 170))
}
for (const [i, x] of [[5, 30], [6, 130], [7, 230], [8, 330]] as const) {
  score.push(rect(i, 1, x, x + 100, 260, 310), rect(i, 1, x, x + 100, 340, 390))
}

describe('measureBoxes', () => {
  const boxes = measureBoxes(score)

  it('unites a bar\'s staves into one box on its tagged system', () => {
    expect(boxes).toHaveLength(8)
    expect(boxes[0]).toEqual({ measure: 1, system: 0, left: 60, right: 160, top: 40, bottom: 170 })
    expect(boxes.map((b) => b.system)).toEqual([0, 0, 0, 0, 1, 1, 1, 1])
  })

  it('finds the bar under a point, snapping to the nearest system and bar', () => {
    expect(measureAtPoint(boxes, 200, 100)).toBe(2)   // between the staves of bar 2
    expect(measureAtPoint(boxes, 500, 60)).toBe(4)    // past the end of line 1
    expect(measureAtPoint(boxes, 50, 230)).toBe(5)    // in the gap, nearer line 2
    expect(measureAtPoint([], 0, 0)).toBeNull()
  })
})
