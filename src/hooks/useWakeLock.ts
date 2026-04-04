import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'giusto-wakelock'

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
      localStorage.setItem(STORAGE_KEY, '0')
      release()
    } else {
      wantedRef.current = true
      localStorage.setItem(STORAGE_KEY, '1')
      acquire()
    }
  }, [acquire, release])

  // On mount: restore the user's saved preference
  useEffect(() => {
    if (supported && localStorage.getItem(STORAGE_KEY) === '1') {
      wantedRef.current = true
      acquire()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
