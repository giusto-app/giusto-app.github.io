const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export type TuningStatus = 'in-tune' | 'close' | 'out-of-tune'

export interface NoteInfo {
  noteName: string
  octave: number
  cents: number
  frequency: number
  status: TuningStatus
  midiNote: number    // e.g. 69 = A4
  pitchClass: number  // 0–11, 0=C
}

/**
 * Convert a frequency to note info.
 *
 * temperamentOffsets: array of 12 cent deviations from ET, indexed C–B.
 * e.g. Equal = all zeros; Pythagorean A = +5.865¢
 * The reported cents are deviation from the *temperament's* ideal pitch for
 * that note, so 0¢ always means perfectly in tune for the chosen system.
 *
 * concertPitchHz: the reference A4 frequency (default 440). Changing this
 * shifts all note detection so that e.g. 442 Hz reads as A4 +0¢ when set to 442.
 */
export function frequencyToNote(
  frequency: number,
  temperamentOffsets: readonly number[],
  concertPitchHz = 440,
): NoteInfo {
  // Cents above/below A4 (concert pitch) in equal temperament
  const centsDiff = 1200 * Math.log2(frequency / concertPitchHz)

  // Nearest semitone from A4 (equal temperament grid)
  const noteIndex = Math.round(centsDiff / 100)

  // MIDI note number (A4 = 69)
  const midiNote = noteIndex + 69
  const pitchClass = ((midiNote % 12) + 12) % 12

  // Deviation from the temperament's ideal for this note:
  //   rawETCents − temperamentOffset[pitchClass]
  const cents = centsDiff - noteIndex * 100 - temperamentOffsets[pitchClass]!

  const noteName = NOTE_NAMES[pitchClass]!
  const octave = Math.floor(midiNote / 12) - 1

  const absCents = Math.abs(cents)
  const status: TuningStatus =
    absCents <= 10 ? 'in-tune' : absCents <= 25 ? 'close' : 'out-of-tune'

  return { noteName, octave, cents, frequency, status, midiNote, pitchClass }
}

// Violin open strings by pitch class
const OPEN_STRING_NAMES: Partial<Record<number, 'G' | 'D' | 'A' | 'E'>> = {
  7: 'G', 2: 'D', 9: 'A', 4: 'E',
}

/**
 * Returns the open string that sympathetically rings when this note is played
 * perfectly in tune (within ±resonanceThresholdCents). Returns null otherwise.
 *
 * Resonance occurs at any octave of G, D, A, E — the pitch class alone determines
 * whether an open string vibrates; octave doesn't matter.
 */
export function getResonanceString(
  pitchClass: number,
  cents: number,
  resonanceThresholdCents = 5,
): 'G' | 'D' | 'A' | 'E' | null {
  if (Math.abs(cents) > resonanceThresholdCents) return null
  return OPEN_STRING_NAMES[pitchClass] ?? null
}

export function formatCents(cents: number): string {
  const rounded = Math.round(cents)
  if (rounded === 0) return '0¢'
  return `${rounded > 0 ? '+' : ''}${rounded}¢`
}

export function statusColor(status: TuningStatus): string {
  switch (status) {
    case 'in-tune': return 'text-emerald-400'
    case 'close': return 'text-amber-400'
    case 'out-of-tune': return 'text-red-400'
  }
}

export function statusStrokeColor(status: TuningStatus): string {
  switch (status) {
    case 'in-tune': return '#34d399'  // emerald-400
    case 'close': return '#fbbf24'    // amber-400
    case 'out-of-tune': return '#f87171' // red-400
  }
}
