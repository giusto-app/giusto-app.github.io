import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SvgPlaybackBinding } from 'lilyjs'
import { measureAtPoint, measureBoxes, readMeasureRects, type MeasureBox } from './measureBoxes'
import { DRAG_CREATE_THRESHOLD_PX, dragCreateSpan, moveHandle, snapBar, stepHandle, type RangeEdge } from './rangeDrag'
import { rangeBounds, rangeHandles, type BandBox, type RangeHandles, type SectionSpan } from './rangeOverlayGeometry'

/**
 * The loop range on the score (PLAN_LOOP_RANGE.md, LR2-LR3; after Sightread's
 * player). lilyjs draws the fuchsia wash itself, one band per system BEHIND
 * the notation (`binding.setRange`, lilyjs 0.61, coloured by the
 * `--lily-range-*` variables in index.css); this component adds the two grip
 * handles on the drawn bands' ends. Dragging a handle snaps it to the nearest
 * bar line; a focused handle moves one bar with Left/Right. Pressing on a bar
 * and dragging across others makes a range in one gesture (LR4); a press that
 * does not move stays a click, which `handleScoreClick` folds into the
 * click-click selection. Mouse and pen only: on touch the same drag scrolls
 * the score, and the handles still work.
 *
 * Redrawn when the section changes and when the SVG is rebuilt
 * (`renderNonce`); the handles are re-placed when the container resizes, since
 * the SVG rescales with CSS and moves every band without a re-render.
 */
export default function RangeOverlay({ container, span, renderNonce, binding, onChange }: {
  container: HTMLElement | null
  span: SectionSpan | null
  renderNonce: number
  /** The score's playback binding, created with the render's time map. */
  binding: () => SvgPlaybackBinding | null
  /** A handle moved the range. Called on every bar a drag crosses. */
  onChange: (span: SectionSpan) => void
}) {
  const [boxes, setBoxes] = useState<MeasureBox[]>([])
  const [handles, setHandles] = useState<RangeHandles | null>(null)
  // The latest span for pointer handlers, which outlive the render they were
  // made in while a drag crosses several bars.
  const spanRef = useRef(span)
  spanRef.current = span
  const dragRef = useRef<RangeEdge | null>(null)
  const handleRefs = useRef<Record<RangeEdge, HTMLDivElement | null>>({ start: null, end: null })
  const focusAfterSwap = useRef<RangeEdge | null>(null)

  useEffect(() => {
    if (!container) { setBoxes([]); setHandles(null); return }
    const b = binding()
    if (span) {
      const [from, to] = rangeBounds(span)
      b?.setRange(from, to)
    } else {
      b?.setRange(null)
    }
    const place = () => {
      setBoxes(measureBoxes(readMeasureRects(container)))
      setHandles(rangeHandles(readBandBoxes(container), span))
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(container)
    // A long score's systems are skipped while off screen (LR11); re-place the
    // handles when one comes into view. The event does not bubble: capture it.
    container.addEventListener('contentvisibilityautostatechange', place, true)
    return () => {
      observer.disconnect()
      container.removeEventListener('contentvisibilityautostatechange', place, true)
    }
  }, [container, span, renderNonce, binding])

  // Drag to create (LR4), on the score itself. Native listeners on the
  // container, so the overlay can stay transparent to pointer events.
  const boxesRef = useRef(boxes)
  boxesRef.current = boxes
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    if (!container) return
    let press: { x: number; y: number; anchor: number; dragging: boolean } | null = null
    const local = (e: globalThis.PointerEvent) => {
      const origin = container.getBoundingClientRect()
      return { x: e.clientX - origin.left, y: e.clientY - origin.top }
    }
    const down = (e: globalThis.PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return
      const p = local(e)
      const anchor = measureAtPoint(boxesRef.current, p.x, p.y)
      press = anchor === null ? null : { ...p, anchor, dragging: false }
    }
    const move = (e: globalThis.PointerEvent) => {
      if (!press) return
      const p = local(e)
      if (!press.dragging) {
        if (Math.hypot(p.x - press.x, p.y - press.y) < DRAG_CREATE_THRESHOLD_PX) return
        press.dragging = true
        // Best-effort: capture throws if the pointer was released meanwhile.
        try { container.setPointerCapture(e.pointerId) } catch { /* keep dragging uncaptured */ }
      }
      const bar = measureAtPoint(boxesRef.current, p.x, p.y)
      if (bar === null) return
      const next = dragCreateSpan(press.anchor, bar)
      const cur = spanRef.current
      if (cur && cur.start === next.start && cur.end === next.end) return
      spanRef.current = next
      onChangeRef.current(next)
    }
    const up = () => {
      // A drag ends with a click on the bar it ended on; swallow that one, or
      // the click-click model would read it as a fresh selection.
      if (press?.dragging) {
        const swallow = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault() }
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      }
      press = null
    }
    container.addEventListener('pointerdown', down)
    container.addEventListener('pointermove', move)
    container.addEventListener('pointerup', up)
    container.addEventListener('pointercancel', up)
    return () => {
      container.removeEventListener('pointerdown', down)
      container.removeEventListener('pointermove', move)
      container.removeEventListener('pointerup', up)
      container.removeEventListener('pointercancel', up)
    }
  }, [container])

  // A keyboard step that swapped the handles keeps the focus on the end that
  // moved, which is now the other handle.
  useEffect(() => {
    const edge = focusAfterSwap.current
    if (edge) { focusAfterSwap.current = null; handleRefs.current[edge]?.focus() }
  })

  if (!handles || !container) return null
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
      {(['start', 'end'] as const).map((edge) => {
        const h = edge === 'start' ? handles.start : handles.end
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

/** The bands lilyjs drew (`setRange`), in px relative to `container`. */
function readBandBoxes(container: HTMLElement): BandBox[] {
  const origin = container.getBoundingClientRect()
  const out: BandBox[] = []
  for (const el of container.querySelectorAll<SVGGraphicsElement>('[data-lily-element="range-band"]')) {
    const r = el.getBoundingClientRect()
    const system = Number(el.getAttribute('data-lily-system'))
    if (!Number.isFinite(system) || r.width <= 0) continue
    out.push({ system, left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top })
  }
  return out
}
