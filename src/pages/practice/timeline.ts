/**
 * The timeline strip under the score (PLAN_LOOP_RANGE.md, LR5): the whole tune
 * as one bar, after Sightread's player. Everything is a FRACTION of the strip's
 * width, so the strip resizes with CSS alone. Pure, unit-tested without a DOM.
 */
import type { SectionSpan } from './rangeOverlayGeometry'

/** Bars at which a tick carries its number, so labels never crowd. */
export function labelledBars(barCount: number, widthPx: number, minGapPx = 28): number[] {
  if (barCount <= 0 || widthPx <= 0) return []
  const perBar = widthPx / barCount
  const step = [1, 2, 4, 5, 10, 20, 50, 100].find((n) => n * perBar >= minGapPx) ?? 100
  const out = [1]
  for (let bar = step; bar <= barCount; bar += step) if (bar !== 1) out.push(bar)
  return out
}

/** The bar under a fraction of the strip (0..1), clamped to the tune. */
export function barAtFraction(fraction: number, barCount: number): number {
  return Math.min(barCount, Math.max(1, Math.floor(fraction * barCount) + 1))
}

/** A bar's left edge, as a fraction of the strip. */
export function barFraction(bar: number, barCount: number): number {
  return barCount > 0 ? (bar - 1) / barCount : 0
}

/**
 * Where a seek at `fraction` lands: the start of the bar under it, kept inside
 * the section when one is set. A take loops its section, so a start outside it
 * would be wrapped back in anyway; landing inside says so up front.
 */
export function seekBar(fraction: number, barCount: number, span: SectionSpan | null): number {
  const bar = barAtFraction(fraction, barCount)
  if (!span) return bar
  const last = span.end ?? barCount
  return Math.min(last, Math.max(span.start, bar))
}
