// Target-key dropdown options. The SPELLING comes from lilyjs — the engine
// that will actually render the transposed score — so a label can never
// disagree with the key on the page. A private copy of the letter/accidental
// table drifted once already: it parsed the mode away and showed "G (original)"
// for a `\key g \minor` piece.

import { transposedKeyName } from 'lilyjs'

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
