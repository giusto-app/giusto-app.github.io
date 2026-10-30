import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { moveHandle, stepHandle, type RangeEdge } from './rangeDrag'
import type { SectionSpan } from './rangeOverlayGeometry'
import { barFraction, labelledBars, seekBar } from './timeline'

/**
 * The whole tune as one strip under the score (PLAN_LOOP_RANGE.md, LR5; after
 * Sightread's player): a tick per bar, the elapsed fill, the loop range as a
 * box with its own two handles, and the playhead. Click or drag on the strip
 * to seek; the range's handles here edit the same section as the score's.
 */
export default function TimelineStrip({ barCount, position, span, isPlaying, onSeek, onRangeChange }: {
  barCount: number
  /** Where the transport is, as a fraction of the tune (0..1). */
  position: number
  span: SectionSpan | null
  isPlaying: boolean
  /** Seek to the start of `bar`. While playing, called once the press ends. */
  onSeek: (bar: number) => void
  onRangeChange: (span: SectionSpan) => void
}) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const spanRef = useRef(span)
  spanRef.current = span
  const press = useRef<{ kind: 'seek'; bar: number } | { kind: 'handle'; edge: RangeEdge } | null>(null)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  if (barCount <= 0) return null
  const fractionAt = (clientX: number) => {
    const r = stripRef.current!.getBoundingClientRect()
    return r.width > 0 ? (clientX - r.left) / r.width : 0
  }
  /** The bar line nearest a fraction: the bar it opens (start) or closes (end). */
  const handleBar = (f: number, edge: RangeEdge) => {
    const line = Math.round(Math.min(1, Math.max(0, f)) * barCount)
    return Math.min(barCount, Math.max(1, edge === 'start' ? line + 1 : line))
  }
  const editRange = (edge: RangeEdge, bar: number) => {
    const cur = spanRef.current
    if (!cur) return edge
    const next = moveHandle(cur, edge, bar)
    if (next.span.start !== cur.start || next.span.end !== cur.end) {
      spanRef.current = next.span
      onRangeChange(next.span)
    }
    return next.edge
  }

  const onStripDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const bar = seekBar(fractionAt(e.clientX), barCount, spanRef.current)
    press.current = { kind: 'seek', bar }
    if (!isPlaying) onSeek(bar)
  }
  const onStripMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p) return
    if (p.kind === 'handle') { press.current = { kind: 'handle', edge: editRange(p.edge, handleBar(fractionAt(e.clientX), p.edge)) }; return }
    const bar = seekBar(fractionAt(e.clientX), barCount, spanRef.current)
    if (bar === p.bar) return
    press.current = { kind: 'seek', bar }
    // Stopped, scrub live. Playing, every bar crossed would restart the audio,
    // so the seek waits for the release.
    if (!isPlaying) onSeek(bar)
  }
  const onStripUp = () => {
    const p = press.current
    press.current = null
    if (p?.kind === 'seek' && isPlaying) onSeek(p.bar)
  }
  const onHandleDown = (edge: RangeEdge) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    stripRef.current?.setPointerCapture(e.pointerId)
    press.current = { kind: 'handle', edge }
  }
  const onHandleKey = (edge: RangeEdge) => (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    const cur = spanRef.current
    if (!delta || !cur) return
    e.preventDefault()
    const next = stepHandle(cur, edge, delta, barCount)
    onRangeChange(next.span)
  }

  const pct = (f: number) => `${Math.min(1, Math.max(0, f)) * 100}%`
  const labels = new Set(labelledBars(barCount, width))
  const rangeStart = span ? barFraction(span.start, barCount) : 0
  const rangeEnd = span ? barFraction((span.end ?? span.start) + 1, barCount) : 0

  return (
    <div
      id="play-along-timeline"
      ref={stripRef}
      className="relative h-10 rounded-lg bg-gray-800/70 select-none touch-none cursor-pointer overflow-visible"
      onPointerDown={onStripDown}
      onPointerMove={onStripMove}
      onPointerUp={onStripUp}
      onPointerCancel={onStripUp}
      role="slider"
      aria-label="Seek"
      aria-valuemin={1}
      aria-valuemax={barCount}
      aria-valuenow={Math.min(barCount, Math.floor(position * barCount) + 1)}
    >
      {/* Elapsed */}
      <div className="giusto-timeline-elapsed absolute inset-y-0 left-0 rounded-l-lg" style={{ width: pct(position) }} />
      {/* Bar ticks */}
      {Array.from({ length: barCount }, (_, i) => i + 1).map((bar) => (
        <div key={bar} className="absolute bottom-0 top-0 pointer-events-none" style={{ left: pct(barFraction(bar, barCount)) }}>
          <div className={['giusto-timeline-tick absolute bottom-0 w-px', labels.has(bar) ? 'h-3' : 'h-1.5'].join(' ')} />
          {labels.has(bar) && (
            <span className="giusto-timeline-label absolute top-1 left-1 text-[10px] tabular-nums leading-none">{bar}</span>
          )}
        </div>
      ))}
      {/* The loop range */}
      {span && (
        <div
          className="giusto-timeline-range absolute inset-y-0 pointer-events-none"
          style={{ left: pct(rangeStart), width: pct(rangeEnd - rangeStart) }}
        >
          {(['start', 'end'] as const).map((edge) => (edge === 'end' && span.end === null) ? null : (
            <div
              key={edge}
              data-timeline-handle={edge}
              className="giusto-range-handle absolute inset-y-0 pointer-events-auto"
              style={{ [edge === 'start' ? 'left' : 'right']: -6, width: 12 }}
              role="slider"
              tabIndex={0}
              aria-label={edge === 'start' ? 'Loop start' : 'Loop end'}
              aria-valuemin={1}
              aria-valuemax={barCount}
              aria-valuenow={edge === 'start' ? span.start : (span.end ?? span.start)}
              onPointerDown={onHandleDown(edge)}
              onKeyDown={onHandleKey(edge)}
            />
          ))}
        </div>
      )}
      {/* Playhead */}
      <div className="giusto-timeline-playhead absolute inset-y-0 w-0.5 pointer-events-none" style={{ left: pct(position) }}>
        <div className="giusto-timeline-playhead-cap absolute -top-1 -left-1" />
      </div>
    </div>
  )
}
