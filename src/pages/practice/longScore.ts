/**
 * Long scores (PLAN_LOOP_RANGE.md, LR11): past this many bars, the score is
 * rendered one <svg> per system (lilyjs 0.62 `split: 'system'`), each in a
 * `content-visibility: auto` wrapper, so systems off screen cost nothing to
 * draw. Shorter scores keep the one-page render. (lilyjs draws the title in
 * the first system's <svg>, so nothing of the page is lost.)
 */
export const LONG_SCORE_BARS = 32

export function splitsSystems(barCount: number): boolean {
  return barCount > LONG_SCORE_BARS
}

/**
 * A wrapper's CSS `aspect-ratio` from its <svg>'s viewBox ("x y w h"), so a
 * system that has not been drawn yet still takes its real height and the page
 * does not jump as you scroll. Null when the viewBox is missing or degenerate.
 */
export function viewBoxAspectRatio(viewBox: string | null): string | null {
  const parts = (viewBox ?? '').trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [, , w, h] = parts as [number, number, number, number]
  return w > 0 && h > 0 ? `${w} / ${h}` : null
}
