import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { measureBoxes, readMeasureRects, type MeasureBox } from './measureBoxes'
import { moveHandle, snapBar, stepHandle, type RangeEdge } from './rangeDrag'
import { rangeOverlayGeometry, type SectionSpan } from './rangeOverlayGeometry'

/**
 * The loop range drawn over the score (PLAN_LOOP_RANGE.md, LR2-LR3; after
 * Sightread's player): a fuchsia wash per system with a grip handle on each
 * end. Dragging a handle snaps it to the nearest bar line; a focused handle
 * moves one bar with Left/Right. The wash itself takes no pointer events, so
 * a click still reaches the bar underneath (`handleScoreClick`).
 *
 * Positioned absolutely in the score's wrapper, in px read from lilyjs's
 * `measure-area` rects. Re-read when the section changes, when the SVG is
 * rebuilt (`renderNonce`), and when the container resizes — the SVG rescales
 * with CSS, so a resize moves every bar without a re-render.
 */
export default function RangeOverlay({ container, span, renderNonce, onChange }: {
  container: HTMLElement | null
  span: SectionSpan | null
  renderNonce: number
  /** A handle moved the range. Called on every bar a drag crosses. */
  onChange: (span: SectionSpan) => void
}) {
  const [boxes, setBoxes] = useState<MeasureBox[]>([])
  // The latest span for pointer handlers, which outlive the render they were
  // made in while a drag crosses several bars.
  const spanRef = useRef(span)
  spanRef.current = span
  const dragRef = useRef<RangeEdge | null>(null)
  const handleRefs = useRef<Record<RangeEdge, HTMLDivElement | null>>({ start: null, end: null })
  const focusAfterSwap = useRef<RangeEdge | null>(null)

  useEffect(() => {
    if (!container) { setBoxes([]); return }
    const update = () => setBoxes(measureBoxes(readMeasureRects(container)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, renderNonce])

  // A keyboard step that swapped the handles keeps the focus on the end that
  // moved, which is now the other handle.
  useEffect(() => {
    const edge = focusAfterSwap.current
    if (edge) { focusAfterSwap.current = null; handleRefs.current[edge]?.focus() }
  })

  const geometry = rangeOverlayGeometry(boxes, span)
  if (!geometry || !container) return null
  const lastBar = boxes.reduce((m, b) => Math.max(m, b.measure), 1)

  const apply = (next: { span: SectionSpan; edge: RangeEdge }) => {
    const cur = spanRef.current
    if (cur && cur.start === next.span.start && cur.end === next.span.end) return next.edge
    spanRef.current = next.span
    onChange(next.span)
    return next.edge
  }

  const onPointerDown = (edge: RangeEdge) => (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = edge
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const edge = dragRef.current, cur = spanRef.current
    if (!edge || !cur) return
    const origin = container.getBoundingClientRect()
    const bar = snapBar(boxes, e.clientX - origin.left, e.clientY - origin.top, edge)
    if (bar === null) return
    dragRef.current = apply(moveHandle(cur, edge, bar))
  }
  const endDrag = () => { dragRef.current = null }
  const onKeyDown = (edge: RangeEdge) => (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    const cur = spanRef.current
    if (!delta || !cur) return
    e.preventDefault()
    const held = apply(stepHandle(cur, edge, delta, lastBar))
    if (held !== edge) focusAfterSwap.current = held
  }

  return (
    <div id="play-along-range" className="pointer-events-none absolute inset-0">
      {geometry.bands.map((b) => (
        <div
          key={b.system}
          className="giusto-range-band absolute"
          aria-hidden="true"
          style={{ left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top }}
        />
      ))}
      {(['start', 'end'] as const).map((edge) => {
        const h = edge === 'start' ? geometry.start : geometry.end
        if (!h) return null
        return (
          <div
            key={edge}
            ref={(el) => { handleRefs.current[edge] = el }}
            data-range-handle={edge}
            className="giusto-range-handle absolute pointer-events-auto"
            style={{ left: h.x - 6, top: h.top, width: 12, height: h.bottom - h.top }}
            role="slider"
            tabIndex={0}
            aria-label={edge === 'start' ? 'Loop start' : 'Loop end'}
            aria-valuemin={1}
            aria-valuemax={lastBar}
            aria-valuenow={h.measure}
            aria-valuetext={`bar ${h.measure}`}
            onPointerDown={onPointerDown(edge)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown(edge)}
          />
        )
      })}
    </div>
  )
}
