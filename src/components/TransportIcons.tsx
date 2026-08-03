/**
 * Transport icons — one coherent set.
 *
 * These were emoji (⏮ ▶ ❙❙ ↻), which is three unrelated typefaces: each glyph
 * came from whatever font the platform happened to resolve, so they differed
 * in weight, size and vertical alignment and could not be styled. These are
 * drawn on a shared 24×24 grid with one stroke weight and `currentColor`, so
 * they inherit the button's colour and line up with each other.
 */
interface IconProps {
  /** Rendered size in px (square). */
  size?: number
  className?: string
}

function Svg({ size = 22, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

/** Filled shapes read better at small sizes for play/pause than outlines. */
export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="currentColor" />
    </Svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5.5v13M15 5.5v13" strokeWidth={2.6} />
    </Svg>
  )
}

export function RewindIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 6v12" strokeWidth={2.2} />
      <path d="M18.5 6.2v11.6L9.5 12l9-5.8Z" fill="currentColor" stroke="currentColor" />
    </Svg>
  )
}

export function LoopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 11a7.5 7.5 0 0 1 7.5-7.5h4" />
      <path d="M13.5 1.2 16.6 3.5 13.5 5.8" />
      <path d="M19.5 13a7.5 7.5 0 0 1-7.5 7.5H8" />
      <path d="M10.5 22.8 7.4 20.5l3.1-2.3" />
    </Svg>
  )
}
