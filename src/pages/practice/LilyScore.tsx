import { useEffect, useRef } from 'react'
import { parseSource, renderLily, renderScore } from 'lilyjs'

// Thin React wrapper around the modern lilyjs renderer (vendored bundle).
// Unlike StaffViewLilyPond (legacy lily-parser + frozen lily-viewer), this
// renders with the CURRENT lilyJS engraving engine — titles, chord symbols,
// beams, and spacing match the lilyJS reference output.
//
// Sizing model (same as the lilyJS editor): the score is engraved at a fixed
// page width and the resulting SVG is scaled to fill the container via CSS —
// resizes never re-engrave, they just rescale the vector image.

interface LilyScoreProps {
  source: string
  /** Render only this \score block (0-based). Omit to render the whole file.
   *  Selecting one block keeps event ids unique for playback highlighting —
   *  each score block restarts its ids at event-0. */
  scoreIndex?: number
  /** Replaces the score's own title (files often have none — "Untitled").
   *  Only applies to the scoreIndex render path. */
  title?: string
  /** SVG layout width in px. Default 720 (lilyJS letter-page content width). */
  width?: number
  className?: string
  /** Called after each render with the container (for overlays/highlights). */
  onRendered?: (container: HTMLDivElement) => void
}

export default function LilyScore({ source, scoreIndex, title, width = 720, className, onRendered }: LilyScoreProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !source.trim()) return
    try {
      // Match the lilyJS editor's dark mode: light ink on a dark score page
      // (the container in PracticePlayback provides the dark page background).
      if (scoreIndex !== undefined) {
        const blocks = parseSource(source).document?.blocks.filter(b => b.type === 'score') ?? []
        const block = blocks[scoreIndex] as
          | { score: Parameters<typeof renderScore>[1] & { title?: string } }
          | undefined
        if (!block) throw new Error(`score block ${scoreIndex} not found (${blocks.length} scores)`)
        // The parsed doc is ours (fresh from parseSource) — safe to retitle.
        if (title) block.score.title = title
        renderScore(el, block.score, { width, theme: 'dark' })
      } else {
        renderLily(el, source, { width, theme: 'dark' })
      }
      onRendered?.(el)
      // lilyjs re-renders asynchronously once music fonts finish loading; run
      // the overlay hook again after the swap.
      const timer = setTimeout(() => onRendered?.(el), 600)
      return () => clearTimeout(timer)
    } catch (err) {
      console.error('lilyjs render failed', err)
      el.textContent = 'Score rendering failed'
    }
  }, [source, scoreIndex, width, onRendered])

  // [&_svg]: the fill-the-container scaling must survive lilyjs's async
  // font-ready re-render (which replaces the <svg>), so it lives in CSS
  // rather than inline styles on the element.
  return (
    <div
      ref={ref}
      className={['[&_svg]:w-full [&_svg]:h-auto [&_svg]:block', className ?? ''].join(' ')}
    />
  )
}
