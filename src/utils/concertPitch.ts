const STORAGE_KEY = 'giusto-concert-pitch-hz'
export const CONCERT_PITCH_PRESETS = [415, 432, 440, 441, 442, 443, 444] as const
export type ConcertPitchHz = typeof CONCERT_PITCH_PRESETS[number]

export function loadConcertPitch(): ConcertPitchHz {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10)
    return (CONCERT_PITCH_PRESETS as readonly number[]).includes(v) ? (v as ConcertPitchHz) : 440
  } catch {
    return 440
  }
}

export function saveConcertPitch(hz: ConcertPitchHz): void {
  localStorage.setItem(STORAGE_KEY, String(hz))
}
