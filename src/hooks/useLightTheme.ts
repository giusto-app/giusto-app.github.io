import { useEffect, useState } from 'react'

/**
 * Whether the app is in light mode: App.tsx puts a `light` class on <body>.
 * Watched, not read once, so a theme switch re-renders whoever draws in the
 * theme's colours (the score, PLAN_LIGHT_MODE.md LM2).
 */
export function useLightTheme(): boolean {
  const read = () => typeof document !== 'undefined' && document.body.classList.contains('light')
  const [light, setLight] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setLight(read()))
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    setLight(read())
    return () => observer.disconnect()
  }, [])
  return light
}
