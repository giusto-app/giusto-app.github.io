/**
 * Moving a loop range's ends (PLAN_LOOP_RANGE.md, LR3): where a dragged handle
 * snaps, and what the range becomes. Pure, so it is unit-tested without a DOM.
 */
import type { MeasureBox } from './measureBoxes'
import type { SectionSpan } from './rangeOverlayGeometry'

export type RangeEdge = 'start' | 'end'

/** A complete range: bars `start`..`end`, inclusive, 1-based. */
export interface BarRange {
  start: number
  end: number
}

/**
 * The bar a handle snaps to at a point: on the system nearest `y`, the bar line
 * nearest `x`. A start handle takes the bar that line OPENS, an end handle the
 * bar it CLOSES, so dropping either one on the same bar line between bars 4
 * and 5 means "from 5" or "through 4". That is what lets a one-bar range be
 * made by bringing the end handle onto the start bar's closing line.
 */
export function snapBar(boxes: readonly MeasureBox[], x: number, y: number, edge: RangeEdge): number | null {
  if (boxes.length === 0) return null
  const dist = (lo: number, hi: number, v: number) => (v < lo ? lo - v : v > hi ? v - hi : 0)
  let system = -1, best = Infinity
  for (const b of boxes) {
    const d = dist(b.top, b.bottom, y)
    if (d < best) { best = d; system = b.system }
  }
  let bar: number | null = null
  best = Infinity
  for (const b of boxes) {
    if (b.system !== system) continue
    const d = Math.abs((edge === 'start' ? b.left : b.right) - x)
    if (d < best) { best = d; bar = b.measure }
  }
  return bar
}

/**
 * The range after one handle moves to `bar`. A handle dragged past the other
 * one swaps roles with it, as the click model accepts either order: the range
 * stays valid, and the returned `edge` is the one the pointer now holds.
 */
export function dragRange(range: BarRange, edge: RangeEdge, bar: number): { range: BarRange; edge: RangeEdge } {
  if (edge === 'start') {
    return bar <= range.end ? { range: { start: bar, end: range.end }, edge } : { range: { start: range.end, end: bar }, edge: 'end' }
  }
  return bar >= range.start ? { range: { start: range.start, end: bar }, edge } : { range: { start: bar, end: range.start }, edge: 'start' }
}

/**
 * A section after the handle on `edge` moves to `bar`. While a section is armed
 * (no end chosen yet) only the start handle exists, and moving it moves the
 * armed bar, which stays armed.
 */
export function moveHandle(span: SectionSpan, edge: RangeEdge, bar: number): { span: SectionSpan; edge: RangeEdge } {
  if (span.end === null) return { span: { start: bar, end: null }, edge: 'start' }
  const moved = dragRange({ start: span.start, end: span.end }, edge, bar)
  return { span: moved.range, edge: moved.edge }
}

/** One arrow-key step of a focused handle: one bar, kept inside bars 1..`lastBar`. */
export function stepHandle(span: SectionSpan, edge: RangeEdge, delta: -1 | 1, lastBar: number): { span: SectionSpan; edge: RangeEdge } {
  const at = edge === 'end' && span.end !== null ? span.end : span.start
  return moveHandle(span, edge, Math.min(lastBar, Math.max(1, at + delta)))
}

/**
 * Drag to create (LR4): the range a press on bar `anchor` makes once the
 * pointer has reached bar `bar`, in either direction.
 */
export function dragCreateSpan(anchor: number, bar: number): SectionSpan {
  return { start: Math.min(anchor, bar), end: Math.max(anchor, bar) }
}

/** A press becomes a drag only past this many px, so a click stays a click. */
export const DRAG_CREATE_THRESHOLD_PX = 6
