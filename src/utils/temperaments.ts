// Cent deviations from Equal Temperament for each pitch class.
// Index: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B
export type TemperamentOffsets = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

export type TemperamentKey = 'equal' | 'pythagorean' | 'just' | 'meantone'

export interface Temperament {
  key: TemperamentKey
  label: string
  shortLabel: string
  description: string
  offsets: TemperamentOffsets
}

export const TEMPERAMENTS: Record<TemperamentKey, Temperament> = {
  equal: {
    key: 'equal',
    label: 'Equal',
    shortLabel: 'Equal',
    description: '12-tone equal temperament — universal modern standard. Used by piano, guitar, winds, and most fixed-pitch instruments.',
    offsets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },

  pythagorean: {
    key: 'pythagorean',
    label: 'Pythagorean',
    shortLabel: 'Pyth.',
    // Built by stacking pure perfect fifths (3:2 = 701.955¢).
    // Favoured by string players — open strings tune in pure fifths.
    description: 'Pure perfect fifths (3:2). Favoured by violin, viola, cello, and double bass — open strings naturally tune in Pythagorean fifths.',
    offsets: [
       0,       // C
      -9.775,  // C#
       3.910,  // D
      -5.865,  // D#/Eb
       7.820,  // E
      -1.955,  // F
      11.730,  // F#
       1.955,  // G
      -7.820,  // G#/Ab
       5.865,  // A
      -3.910,  // A#/Bb
       9.775,  // B
    ],
  },

  just: {
    key: 'just',
    label: 'Just',
    shortLabel: 'Just',
    // 5-limit just intonation relative to C.
    // Pure major thirds (5:4 = 386¢) and perfect fifths (3:2 = 702¢).
    description: '5-limit just intonation — pure thirds (5:4) and fifths (3:2). Used by string quartets, choirs, brass ensembles, and a cappella singers.',
    offsets: [
        0,      // C  — 1:1
      -29.328,  // C# — 25:24
        3.910,  // D  — 9:8
      -15.641,  // D#/Eb — 6:5
      -13.686,  // E  — 5:4
       -1.955,  // F  — 4:3
       -9.776,  // F# — 45:32
        1.955,  // G  — 3:2
       13.686,  // G#/Ab — 8:5
      -15.641,  // A  — 5:3
       -3.910,  // A#/Bb — 16:9
      -11.731,  // B  — 15:8
    ],
  },

  meantone: {
    key: 'meantone',
    label: 'Meantone',
    shortLabel: 'Mean.',
    // Quarter-comma meantone: pure major thirds (5:4), fifths narrowed to 696.578¢.
    // Common in Renaissance and Baroque music (lutes, viols, early keyboards).
    description: 'Quarter-comma meantone — pure major thirds (5:4). Used by Baroque violin, viol da gamba, lute, recorder, and early keyboard instruments.',
    offsets: [
       0,       // C
      -23.951,  // C#
       -6.843,  // D
       10.265,  // D#/Eb
      -13.686,  // E
        3.422,  // F
      -20.529,  // F#
       -3.422,  // G
       13.686,  // G#/Ab
      -10.265,  // A
        6.843,  // A#/Bb
      -17.108,  // B
    ],
  },
}

export const TEMPERAMENT_KEYS: TemperamentKey[] = ['equal', 'pythagorean', 'just', 'meantone']
