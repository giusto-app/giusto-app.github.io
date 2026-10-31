import { useEffect, useRef } from 'react'
import { useLightTheme } from '../../hooks/useLightTheme'
import { viewBoxAspectRatio } from './longScore'
import { createRenderWorker, renderLilyAsync, type LilyRenderWorker, type SystemTimeMap } from 'lilyjs'

// Thin React wrapper around the modern lilyjs renderer (vendored bundle).
// Renders with the current lilyJS engraving engine, so titles, chord symbols,
// beams and spacing match the lilyJS reference output. This is now the only
// notation renderer in the production path — the older vendored viewer and its
// pre-lilyjs parser were retired upstream and deleted on 2026-08-10.
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
  /** Transpose the rendered score by this many semitones (0 = original key). */
  transposeSemitones?: number
  className?: string
  /** Called after each render with the container (for overlays/highlights). */
  onRendered?: (container: HTMLDivElement) => void
  /** Where musical time sits on each system, after every render (lilyjs >= 0.61). */
  onTimeMap?: (timeMap: SystemTimeMap[]) => void
  /**
   * Render one <svg> per system, each in a `content-visibility: auto` wrapper,
   * for long scores (LR11, lilyjs >= 0.62). The title is drawn in the first
   * system's <svg>, as on the page.
   */
  split?: boolean
}

/**
 * Put each of lilyjs's per-system <svg>s in its own wrapper, so the browser can
 * skip drawing the ones off screen. Each wrapper takes its system's aspect
 * ratio up front, so an undrawn system still has its real height.
 */
function wrapSystems(el: HTMLElement): void {
  for (const svg of [...el.children]) {
    if (svg.tagName.toLowerCase() !== 'svg') continue
    const wrap = document.createElement('div')
    wrap.className = 'giusto-system'
    const ratio = viewBoxAspectRatio(svg.getAttribute('viewBox'))
    if (ratio) wrap.style.aspectRatio = ratio
    el.insertBefore(wrap, svg)
    wrap.appendChild(svg)
  }
}

/** The app's one lilyjs render worker, started on first use. It is copied from
 *  the package into public/lilyjs/ by scripts/syncLilyjsFonts.ts. Null where
 *  workers are unavailable: renderLilyAsync then renders on the main thread. */
let sharedWorker: LilyRenderWorker | null | undefined
function renderWorker(): LilyRenderWorker | null {
  if (sharedWorker === undefined) {
    try {
      sharedWorker = typeof Worker === 'undefined' ? null : createRenderWorker('/lilyjs/lilyjs.worker.js')
    } catch {
      sharedWorker = null
    }
  }
  return sharedWorker
}

export default function LilyScore({ source, scoreIndex, title, width = 720, transposeSemitones = 0, className, onRendered, onTimeMap, split = false }: LilyScoreProps) {
  const ref = useRef<HTMLDivElement>(null)
  // The score is drawn in the app's theme, and redrawn when it switches.
  const theme: 'light' | 'dark' = useLightTheme() ? 'light' : 'dark'

  useEffect(() => {
    const el = ref.current
    if (!el || !source.trim()) return
    // lilyjs reports the time map right after it puts the SVGs in place — on the
    // first render and on the font re-render — which is when to wrap them.
    const timeMapped = split
      ? (m: SystemTimeMap[]) => { wrapSystems(el); onTimeMap?.(m) }
      : onTimeMap
    const options = { width, theme, onTimeMap: timeMapped, ...(split ? { split: 'system' as const } : {}) }
    // Drawn in lilyjs's worker, so the page keeps responding while a long score
    // renders; it mounts exactly what renderLily / renderScore mount. One score
    // block (scoreIndex) is selected, transposed and retitled in the worker.
    let cancelled = false
    renderLilyAsync(el, source, {
      ...options,
      worker: renderWorker(),
      ...(scoreIndex !== undefined
        ? { scoreSelection: { index: scoreIndex, ...(transposeSemitones ? { transposeSemitones } : {}), ...(title ? { title } : {}) } }
        : { format: 'lilypond' as const }),
    })
      .then((svg) => { if (!cancelled && svg) onRendered?.(el) })
      .catch((err) => {
        if (cancelled) return
        console.error('lilyjs render failed', err)
        el.textContent = 'Score rendering failed'
      })
    return () => { cancelled = true }
  }, [source, scoreIndex, width, transposeSemitones, onRendered, onTimeMap, theme, split])

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
