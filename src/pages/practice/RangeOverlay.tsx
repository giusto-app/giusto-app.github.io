import { useEffect, useState } from 'react'
import { measureBoxes, readMeasureRects } from './measureBoxes'
import { rangeOverlayGeometry, type RangeOverlayGeometry, type SectionSpan } from './rangeOverlayGeometry'

/**
 * The loop range drawn over the score (PLAN_LOOP_RANGE.md, LR2; after
 * Sightread's player): a fuchsia wash per system with a grip handle on each
 * end. Display only — the handles take no pointer events until LR3, so a
 * click still reaches the bar underneath (`handleScoreClick`).
 *
 * Positioned absolutely in the score's wrapper, in px read from lilyjs's
 * `measure-area` rects. Re-read when the section changes, when the SVG is
 * rebuilt (`renderNonce`), and when the container resizes — the SVG rescales
 * with CSS, so a resize moves every bar without a re-render.
 */
export default function RangeOverlay({ container, span, renderNonce }: {
  container: HTMLElement | null
  span: SectionSpan | null
  renderNonce: number
}) {
  const [geometry, setGeometry] = useState<RangeOverlayGeometry | null>(null)

  useEffect(() => {
    if (!container) { setGeometry(null); return }
    const update = () => setGeometry(rangeOverlayGeometry(measureBoxes(readMeasureRects(container)), span))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, span, renderNonce])

  if (!geometry) return null
  return (
    <div id="play-along-range" className="pointer-events-none absolute inset-0" aria-hidden="true">
      {geometry.bands.map((b) => (
        <div
          key={b.system}
          className="giusto-range-band absolute"
          style={{ left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top }}
        />
      ))}
      {[geometry.start, geometry.end].map((h, i) => h && (
        <div
          key={i === 0 ? 'start' : 'end'}
          data-range-handle={i === 0 ? 'start' : 'end'}
          className="giusto-range-handle absolute"
          style={{ left: h.x - 6, top: h.top, width: 12, height: h.bottom - h.top }}
        />
      ))}
    </div>
  )
}
