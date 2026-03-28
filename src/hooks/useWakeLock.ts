import { useCallback, useEffect, useRef, useState } from 'react'

export function useWakeLock() {
  const [active, setActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const wantedRef = useRef(false)  // user's intent, survives visibility changes

  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  const acquire = useCallback(async () => {
    if (!supported) return
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
      sentinelRef.current.addEventListener('release', () => {
        // Re-acquire automatically if the user still wants it (page was hidden then shown)
        setActive(false)
      })
      setActive(true)
    } catch {
      setActive(false)
    }
  }, [supported])

  const release = useCallback(async () => {
    await sentinelRef.current?.release()
    sentinelRef.current = null
    setActive(false)
  }, [])

  const toggle = useCallback(() => {
    if (wantedRef.current) {
      wantedRef.current = false
      release()
    } else {
      wantedRef.current = true
      acquire()
    }
  }, [acquire, release])

  // Re-acquire when the page becomes visible again (browser releases lock on hide)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && wantedRef.current) {
        acquire()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [acquire])

  // Release on unmount
  useEffect(() => () => { release() }, [release])

  return { active, toggle, supported }
}
