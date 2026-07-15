import { useEffect, useRef } from 'react'
import { renderLily } from 'lilyjs'

// Thin React wrapper around the modern lilyjs renderer (vendored bundle).
// Unlike StaffViewLilyPond (legacy lily-parser + frozen lily-viewer), this
// renders with the CURRENT lilyJS engraving engine — titles, chord symbols,
// beams, and spacing match the lilyJS reference output.

interface LilyScoreProps {
  source: string
  /** SVG layout width in px. Default 720 (lilyJS letter-page content width). */
  width?: number
  className?: string
  /** Called after each render with the container (for overlays/highlights). */
  onRendered?: (container: HTMLDivElement) => void
}

export default function LilyScore({ source, width = 720, className, onRendered }: LilyScoreProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !source.trim()) return
    try {
      renderLily(el, source, { width, theme: 'dark' })
      onRendered?.(el)
      // lilyjs re-renders asynchronously once music fonts finish loading; run
      // the overlay hook again after the swap.
      const timer = setTimeout(() => onRendered?.(el), 600)
      return () => clearTimeout(timer)
    } catch (err) {
      console.error('lilyjs render failed', err)
      el.textContent = 'Score rendering failed'
    }
  }, [source, width, onRendered])

  return <div ref={ref} className={className} />
}
