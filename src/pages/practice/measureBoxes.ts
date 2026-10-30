/**
 * Where each bar of the rendered score sits on screen — the geometry the loop
 * range's handles are hit-tested against (PLAN_LOOP_RANGE.md, LR1).
 *
 * lilyjs draws a transparent `measure-area` rect behind every bar of every staff,
 * tagged `data-lily-measure` (1-based, as printed) and, since lilyjs 0.61,
 * `data-lily-system-index` (0-based, document-wide). A bar never splits across
 * systems, so uniting a bar's rects gives ONE box per bar spanning all its
 * staves, on the system its tag names.
 *
 * Bar numbers are unique within ONE score, and Giusto renders one score per
 * exercise (`renderScore` per `scoreIndex`); a whole document with several
 * `\score` blocks would restart them (`data-lily-document-block` tells them
 * apart, should Giusto ever render one).
 *
 * The functions here are pure (plain rects in, plain boxes out) so they are
 * unit-tested without a DOM; `readMeasureRects` is the only DOM-touching part.
 */

/** One `measure-area` rect, in px relative to the score container. */
export interface MeasureRect {
  measure: number
  /** `data-lily-system-index`: the system the rect is drawn on. */
  system: number
  left: number
  right: number
  top: number
  bottom: number
}

/** A bar's box: the union of its staves' rects. */
export type MeasureBox = MeasureRect

/** One box per bar, sorted by bar number. */
export function measureBoxes(rects: readonly MeasureRect[]): MeasureBox[] {
  const byMeasure = new Map<number, MeasureRect>()
  for (const r of rects) {
    if (!Number.isFinite(r.measure)) continue
    const prev = byMeasure.get(r.measure)
    byMeasure.set(r.measure, prev
      ? { ...prev, left: Math.min(prev.left, r.left), right: Math.max(prev.right, r.right), top: Math.min(prev.top, r.top), bottom: Math.max(prev.bottom, r.bottom) }
      : { ...r })
  }
  return [...byMeasure.values()].sort((a, b) => a.measure - b.measure)
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
    const system = Number(el.getAttribute('data-lily-system-index'))
    const r = el.getBoundingClientRect()
    if (!Number.isFinite(measure) || !Number.isFinite(system) || r.width <= 0 || r.height <= 0) continue
    out.push({ measure, system, left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top })
  }
  return out
}
