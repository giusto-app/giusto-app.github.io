/**
 * Where each bar of the rendered score sits on screen — the geometry the loop
 * range overlay and the timeline strip are drawn from (PLAN_LOOP_RANGE.md, LR1).
 *
 * lilyjs draws a transparent `measure-area` rect behind every bar of every staff,
 * tagged `data-lily-measure` (1-based, as printed). A bar never splits across
 * systems, so uniting a bar's rects gives ONE box per bar spanning all its
 * staves; boxes whose vertical extents overlap belong to the same system.
 *
 * Bar numbers are unique within ONE score, and Giusto renders one score per
 * exercise (`renderScore` per `scoreIndex`); a whole document with several
 * `\score` blocks would restart them, and its bar 1s would merge here.
 *
 * The functions here are pure (plain rects in, plain boxes out) so they are
 * unit-tested without a DOM; `readMeasureRects` is the only DOM-touching part.
 */

/** One `measure-area` rect, in px relative to the score container. */
export interface MeasureRect {
  measure: number
  left: number
  right: number
  top: number
  bottom: number
}

/** A bar's box: the union of its staves' rects, and the system it is drawn on. */
export interface MeasureBox extends MeasureRect {
  /** 0-based, top to bottom. */
  system: number
}

/** One band of a range, on one system. */
export interface RangeSegment {
  system: number
  left: number
  right: number
  top: number
  bottom: number
  /** The first and last bars this band covers. */
  firstMeasure: number
  lastMeasure: number
}

/** One box per bar, sorted by bar number, each tagged with its system. */
export function measureBoxes(rects: readonly MeasureRect[]): MeasureBox[] {
  const byMeasure = new Map<number, MeasureRect>()
  for (const r of rects) {
    if (!Number.isFinite(r.measure)) continue
    const prev = byMeasure.get(r.measure)
    byMeasure.set(r.measure, prev
      ? { measure: r.measure, left: Math.min(prev.left, r.left), right: Math.max(prev.right, r.right), top: Math.min(prev.top, r.top), bottom: Math.max(prev.bottom, r.bottom) }
      : { ...r })
  }
  const boxes = [...byMeasure.values()]
  // Systems: group boxes whose vertical extents overlap, ordered top to bottom.
  const rows: { top: number; bottom: number }[] = []
  for (const b of [...boxes].sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => b.top < r.bottom && b.bottom > r.top)
    if (row) { row.top = Math.min(row.top, b.top); row.bottom = Math.max(row.bottom, b.bottom) }
    else rows.push({ top: b.top, bottom: b.bottom })
  }
  rows.sort((a, b) => a.top - b.top)
  return boxes
    .map((b) => ({ ...b, system: rows.findIndex((r) => b.top < r.bottom && b.bottom > r.top) }))
    .sort((a, b) => a.measure - b.measure)
}

/**
 * The bands that draw bars `first`..`last` (inclusive, either order): one per
 * system the range touches, each as tall as that system's tallest bar in it.
 */
export function rangeSegments(boxes: readonly MeasureBox[], first: number, last: number): RangeSegment[] {
  const lo = Math.min(first, last), hi = Math.max(first, last)
  const bySystem = new Map<number, RangeSegment>()
  for (const b of boxes) {
    if (b.measure < lo || b.measure > hi) continue
    const s = bySystem.get(b.system)
    bySystem.set(b.system, s
      ? { ...s, left: Math.min(s.left, b.left), right: Math.max(s.right, b.right), top: Math.min(s.top, b.top), bottom: Math.max(s.bottom, b.bottom), firstMeasure: Math.min(s.firstMeasure, b.measure), lastMeasure: Math.max(s.lastMeasure, b.measure) }
      : { system: b.system, left: b.left, right: b.right, top: b.top, bottom: b.bottom, firstMeasure: b.measure, lastMeasure: b.measure })
  }
  return [...bySystem.values()].sort((a, b) => a.system - b.system)
}

/**
 * The bar under a point, for clicks and drags: the system whose band holds `y`
 * (or the nearest one), then the bar on it whose span holds `x` (or the nearest
 * one, so a drag past the end of a line still lands on its last bar).
 */
export function measureAtPoint(boxes: readonly MeasureBox[], x: number, y: number): number | null {
  if (boxes.length === 0) return null
  const systems = new Map<number, { top: number; bottom: number }>()
  for (const b of boxes) {
    const s = systems.get(b.system)
    systems.set(b.system, s ? { top: Math.min(s.top, b.top), bottom: Math.max(s.bottom, b.bottom) } : { top: b.top, bottom: b.bottom })
  }
  const dist = (lo: number, hi: number, v: number) => (v < lo ? lo - v : v > hi ? v - hi : 0)
  let system = -1, best = Infinity
  for (const [s, band] of systems) {
    const d = dist(band.top, band.bottom, y)
    if (d < best) { best = d; system = s }
  }
  let measure: number | null = null
  best = Infinity
  for (const b of boxes) {
    if (b.system !== system) continue
    const d = dist(b.left, b.right, x)
    if (d < best) { best = d; measure = b.measure }
  }
  return measure
}

/** Every `measure-area` rect of the rendered score, relative to `container`. */
export function readMeasureRects(container: HTMLElement): MeasureRect[] {
  const origin = container.getBoundingClientRect()
  const out: MeasureRect[] = []
  for (const el of container.querySelectorAll<SVGGraphicsElement>('[data-lily-element="measure-area"][data-lily-measure]')) {
    const measure = Number(el.getAttribute('data-lily-measure'))
    const r = el.getBoundingClientRect()
    if (!Number.isFinite(measure) || r.width <= 0 || r.height <= 0) continue
    out.push({ measure, left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top })
  }
  return out
}
