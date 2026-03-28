/**
 * Map absolute cents deviation to a smooth HSL color string.
 *
 *   0¢  → hsl(142, 80%, 45%)  — emerald green  (in tune)
 *  10¢  → hsl( 60, 80%, 45%)  — yellow          (transition)
 *  50+¢ → hsl(  0, 80%, 50%)  — red             (out of tune)
 */
export function centsToHsl(absCents: number): string {
  const t = Math.min(Math.abs(absCents), 50)
  let hue: number
  if (t <= 10) {
    // green → yellow
    hue = 142 - (t / 10) * (142 - 60)
  } else {
    // yellow → red
    hue = 60 - ((t - 10) / 40) * 60
  }
  const lightness = t <= 10 ? 45 : 45 + ((t - 10) / 40) * 8
  return `hsl(${hue.toFixed(0)}, 80%, ${lightness.toFixed(0)}%)`
}
