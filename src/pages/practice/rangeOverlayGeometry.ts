/**
 * What the loop-range overlay draws for a section (PLAN_LOOP_RANGE.md, LR2):
 * one wash band per system the section touches, the start handle on the first
 * band's left edge and the end handle on the last band's right edge.
 *
 * Pure, so it is unit-tested without a DOM; `RangeOverlay.tsx` only positions
 * divs from it.
 */
import { rangeSegments, type MeasureBox, type RangeSegment } from './measureBoxes'

/** A section as the player holds it: bars, 1-based; `end` is null while armed. */
export interface SectionSpan {
  start: number
  end: number | null
}

/** A handle: a vertical grip at `x`, as tall as its band. */
export interface RangeHandle {
  x: number
  top: number
  bottom: number
  /** The bar line it sits on is this bar's opening (start) or closing (end) one. */
  measure: number
}

export interface RangeOverlayGeometry {
  bands: RangeSegment[]
  start: RangeHandle
  /** None while the section is armed (its end not chosen yet). */
  end: RangeHandle | null
}

export function rangeOverlayGeometry(boxes: readonly MeasureBox[], span: SectionSpan | null): RangeOverlayGeometry | null {
  if (span === null) return null
  // An armed section shows its start bar, so a half-made selection still reads
  // as "something is set" (the rule the old per-bar tint had).
  const bands = rangeSegments(boxes, span.start, span.end ?? span.start)
  if (bands.length === 0) return null
  const first = bands[0]!, last = bands[bands.length - 1]!
  return {
    bands,
    start: { x: first.left, top: first.top, bottom: first.bottom, measure: first.firstMeasure },
    end: span.end === null ? null : { x: last.right, top: last.top, bottom: last.bottom, measure: last.lastMeasure },
  }
}
