/**
 * Transport icons — Material Symbols, the standard media-player set.
 *
 * These were emoji, then hand-drawn shapes, then stroked Feather outlines.
 * A transport is not navigation chrome: every mainstream player (MuseScore's
 * web player, YouTube, Spotify, Apple Music) draws SOLID glyphs on the 24px
 * Material grid, and a filled triangle reads as "press me" at 22px where a
 * 2px outline reads as decoration.
 *
 * So the app now has exactly two icon families with a clear rule: Feather for
 * navigation and settings (TabBar, PracticeView, DroneControl), Material
 * filled for the transport. What must never come back is a THIRD style inside
 * this cluster — all four glyphs below are the unmodified Material paths
 * (`play_arrow`, `pause`, `skip_previous`, `repeat`) so they share one weight,
 * one optical size, and one corner treatment.
 */
interface IconProps {
  size?: number
  className?: string
}

function MaterialIcon({ size = 22, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

/** Material `play_arrow`. */
export function PlayIcon(props: IconProps) {
  return (
    <MaterialIcon {...props}>
      <path d="M8 5v14l11-7z" />
    </MaterialIcon>
  )
}

/** Material `pause`. */
export function PauseIcon(props: IconProps) {
  return (
    <MaterialIcon {...props}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </MaterialIcon>
  )
}

/** Material `skip_previous` — back to the start, the player convention. */
export function RewindIcon(props: IconProps) {
  return (
    <MaterialIcon {...props}>
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </MaterialIcon>
  )
}

/** Material `repeat`. */
export function LoopIcon(props: IconProps) {
  return (
    <MaterialIcon {...props}>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </MaterialIcon>
  )
}
