/**
 * The loop range's ends (PLAN_LOOP_RANGE.md, LR2): which bars a section spans,
 * as lilyjs `setRange` bounds, and where its two handles sit on the bands
 * lilyjs drew — the start handle on the first band's left edge, the end handle
 * on the last band's right edge.
 *
 * Pure, so it is unit-tested without a DOM; `RangeOverlay.tsx` reads the drawn
 * bands' screen boxes and positions divs from this.
 */
import type { RangeBound } from 'lilyjs'

/** A section as the player holds it: bars, 1-based; `end` is null while armed. */
export interface SectionSpan {
  start: number
  end: number | null
}

/** One drawn band (`data-lily-element="range-band"`), in px relative to the score container. */
export interface BandBox {
  system: number
  left: number
  right: number
  top: number
  bottom: number
}

/** A handle: a vertical grip at `x`, as tall as its band. */
export interface RangeHandle {
  x: number
  top: number
  bottom: number
  /** The bar it bounds: the first bar for the start handle, the last for the end. */
  measure: number
}

export interface RangeHandles {
  start: RangeHandle
  /** None while the section is armed (its end not chosen yet). */
  end: RangeHandle | null
}

/**
 * The `setRange` bounds for a section. An armed section shows its start bar,
 * so a half-made selection still reads as "something is set".
 */
export function rangeBounds(span: SectionSpan): [RangeBound, RangeBound] {
  return [{ measure: span.start }, { measure: span.end ?? span.start }]
}

export function rangeHandles(bands: readonly BandBox[], span: SectionSpan | null): RangeHandles | null {
  if (span === null || bands.length === 0) return null
  const sorted = [...bands].sort((a, b) => a.system - b.system)
  const first = sorted[0]!, last = sorted[sorted.length - 1]!
  return {
    start: { x: first.left, top: first.top, bottom: first.bottom, measure: span.start },
    end: span.end === null ? null : { x: last.right, top: last.top, bottom: last.bottom, measure: span.end },
  }
}
