const PLAY_ALONG_HASH_PREFIX = '#practice/'
const LEGACY_EXERCISE_IDS: Record<string, string> = {
  'bundled-practice-arpeggios': 'practice-arpeggios-Gm-Cm-F-Bb',
}

export function playAlongExerciseIdFromHash(hash: string): string | null {
  if (!hash.startsWith(PLAY_ALONG_HASH_PREFIX)) return null
  const encodedId = hash.slice(PLAY_ALONG_HASH_PREFIX.length)
  if (!encodedId) return null
  try {
    const id = decodeURIComponent(encodedId)
    return LEGACY_EXERCISE_IDS[id] ?? id
  } catch {
    return null
  }
}

export function playAlongHash(exerciseId: string): string {
  return `${PLAY_ALONG_HASH_PREFIX}${encodeURIComponent(exerciseId)}`
}

export function playAlongUrl(exerciseId: string, currentUrl = window.location.href): string {
  const url = new URL(currentUrl)
  url.hash = playAlongHash(exerciseId).slice(1)
  return url.toString()
}

export function replacePlayAlongUrl(exerciseId: string): void {
  window.history.replaceState(null, '', playAlongUrl(exerciseId))
}
