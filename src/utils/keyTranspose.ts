// Map a target-key choice to a semitone shift for lilyjs `transpose`, labeling
// each option the way lilyjs will actually spell it (canonical interval per
// semitone count), so the dropdown label matches the rendered key.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// Semitone → diatonic (letter) shift for the canonical interval, matching lilyjs.
const REM_TO_DIATONIC = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]

function parseKeyName(key: string): { letter: string; alter: number } {
  const m = /^([A-Ga-g])([#♯b♭]*)/.exec(key.trim())
  if (!m) return { letter: 'C', alter: 0 }
  let alter = 0
  for (const c of m[2]!) alter += c === '#' || c === '♯' ? 1 : c === 'b' || c === '♭' ? -1 : 0
  return { letter: m[1]!.toUpperCase(), alter }
}

/** The key `sourceKey` becomes when transposed by `semitones`, spelled as lilyjs spells it. */
export function transposedKeyName(sourceKey: string, semitones: number): string {
  const { letter, alter } = parseKeyName(sourceKey)
  const srcIdx = Math.max(0, LETTERS.indexOf(letter as (typeof LETTERS)[number]))
  const srcPc = ((((LETTER_PC[letter] ?? 0) + alter) % 12) + 12) % 12
  const dia = REM_TO_DIATONIC[(((semitones % 12) + 12) % 12)]!
  const outLetter = LETTERS[(((srcIdx + dia) % 7) + 7) % 7]!
  const outPc = (((srcPc + semitones) % 12) + 12) % 12
  let diff = outPc - LETTER_PC[outLetter]!
  while (diff > 6) diff -= 12
  while (diff < -6) diff += 12
  const acc = diff > 0 ? '#'.repeat(diff) : diff < 0 ? 'b'.repeat(-diff) : ''
  return outLetter + acc
}

export interface KeyOption {
  semitones: number
  label: string
}

/** Target-key dropdown options for an exercise in `sourceKey` (−5…+6 semitones). */
export function keyTransposeOptions(sourceKey: string): KeyOption[] {
  return [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((s) => ({
    semitones: s,
    label: transposedKeyName(sourceKey, s) + (s === 0 ? ' (original)' : ''),
  }))
}
