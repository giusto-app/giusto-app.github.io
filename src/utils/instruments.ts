// Instruments the tuner knows, how their open strings are tuned, and which
// temperament suits playing on them.
//
// Bowed strings tune their open strings by ear in PURE intervals from the
// reference A: violin, viola and cello in pure fifths (3:2, beat-free), the
// double bass in pure fourths (4:3, usually via harmonics). A pure fifth is
// ~1.955 ¢ wider than an equal-tempered one, so a violin's E sits ~+2 ¢ above
// its equal-tempered pitch and its G ~−3.9 ¢ below. Fretted and keyboard
// instruments use equal temperament. "With piano" narrows the fifths to equal
// temperament so the low strings agree with the keyboard.
import type { TemperamentKey } from './temperaments'

export type InstrumentKey = 'violin' | 'viola' | 'cello' | 'bass' | 'guitar'

export interface OpenString {
  /** Display name, e.g. "G". */
  name: string
  /** MIDI note number of the open string (A4 = 69). */
  midi: number
}

export interface Instrument {
  key: InstrumentKey
  label: string
  /** Open strings, lowest first. */
  strings: readonly OpenString[]
  /** The string tuned first, to the reference pitch. */
  referenceString: string
  /** How the open strings relate: pure fifths/fourths from the reference, or equal temperament. */
  openTuning: 'pure-fifths' | 'pure-fourths' | 'equal'
  /** The order a player tunes in: the reference first, then outward. */
  tuneOrder: readonly string[]
  /** Temperament recommended for playing (stopped notes) on this instrument. */
  playTemperament: TemperamentKey
}

export const INSTRUMENTS: Record<InstrumentKey, Instrument> = {
  violin: {
    key: 'violin', label: 'Violin',
    strings: [{ name: 'G', midi: 55 }, { name: 'D', midi: 62 }, { name: 'A', midi: 69 }, { name: 'E', midi: 76 }],
    referenceString: 'A', openTuning: 'pure-fifths', tuneOrder: ['A', 'D', 'G', 'E'],
    playTemperament: 'pythagorean',
  },
  viola: {
    key: 'viola', label: 'Viola',
    strings: [{ name: 'C', midi: 48 }, { name: 'G', midi: 55 }, { name: 'D', midi: 62 }, { name: 'A', midi: 69 }],
    referenceString: 'A', openTuning: 'pure-fifths', tuneOrder: ['A', 'D', 'G', 'C'],
    playTemperament: 'pythagorean',
  },
  cello: {
    key: 'cello', label: 'Cello',
    strings: [{ name: 'C', midi: 36 }, { name: 'G', midi: 43 }, { name: 'D', midi: 50 }, { name: 'A', midi: 57 }],
    referenceString: 'A', openTuning: 'pure-fifths', tuneOrder: ['A', 'D', 'G', 'C'],
    playTemperament: 'pythagorean',
  },
  bass: {
    key: 'bass', label: 'Double bass',
    strings: [{ name: 'E', midi: 28 }, { name: 'A', midi: 33 }, { name: 'D', midi: 38 }, { name: 'G', midi: 43 }],
    referenceString: 'A', openTuning: 'pure-fourths', tuneOrder: ['A', 'D', 'G', 'E'],
    playTemperament: 'pythagorean',
  },
  guitar: {
    key: 'guitar', label: 'Guitar',
    strings: [
      { name: 'E', midi: 40 }, { name: 'A', midi: 45 }, { name: 'D', midi: 50 },
      { name: 'G', midi: 55 }, { name: 'B', midi: 59 }, { name: 'e', midi: 64 },
    ],
    referenceString: 'A', openTuning: 'equal', tuneOrder: ['A', 'E', 'D', 'G', 'B', 'e'],
    playTemperament: 'equal',
  },
}

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS) as InstrumentKey[]

const equalFrequency = (midi: number, concertPitch: number): number =>
  concertPitch * Math.pow(2, (midi - 69) / 12)

export interface StringTarget extends OpenString {
  /** Target frequency, Hz. */
  frequency: number
  /** The target's offset from its equal-tempered pitch, cents. */
  centsFromEqual: number
}

/**
 * Each open string's target. Pure tunings chain from the reference string by
 * pure intervals (3:2 for fifths, 4:3 for fourths); `withPiano` or an
 * equal-tempered instrument puts every string at its equal-tempered pitch.
 */
export function openStringTargets(
  instrument: Instrument,
  concertPitch: number,
  withPiano = false,
): StringTarget[] {
  const ref = instrument.strings.find((s) => s.name === instrument.referenceString)!
  const refFreq = equalFrequency(ref.midi, concertPitch)
  const pure = !withPiano && instrument.openTuning !== 'equal'
  const ratio = instrument.openTuning === 'pure-fourths' ? 4 / 3 : 3 / 2
  const refIndex = instrument.strings.indexOf(ref)
  return instrument.strings.map((s, i) => {
    const equal = equalFrequency(s.midi, concertPitch)
    const frequency = pure ? refFreq * Math.pow(ratio, i - refIndex) : equal
    return { ...s, frequency, centsFromEqual: 1200 * Math.log2(frequency / equal) }
  })
}

/** Cents from `target` to `frequency`. */
export function centsFrom(frequency: number, target: number): number {
  return 1200 * Math.log2(frequency / target)
}

/**
 * The open string a sounding pitch belongs to: the nearest target, if it lies
 * within `maxCents` of it (default a little over a semitone, so a string that
 * is badly out of tune is still recognised).
 */
export function nearestString(
  frequency: number,
  targets: readonly StringTarget[],
  maxCents = 150,
): { index: number; cents: number } | null {
  let best: { index: number; cents: number } | null = null
  targets.forEach((t, index) => {
    const cents = centsFrom(frequency, t.frequency)
    if (Math.abs(cents) <= maxCents && (!best || Math.abs(cents) < Math.abs(best.cents))) best = { index, cents }
  })
  return best
}

const INSTRUMENT_STORAGE_KEY = 'giusto-tuner-instrument'

export function loadInstrument(): InstrumentKey {
  try {
    const v = localStorage.getItem(INSTRUMENT_STORAGE_KEY)
    return v && (INSTRUMENT_KEYS as string[]).includes(v) ? (v as InstrumentKey) : 'violin'
  } catch {
    return 'violin'
  }
}

export function saveInstrument(key: InstrumentKey): void {
  try { localStorage.setItem(INSTRUMENT_STORAGE_KEY, key) } catch { /* private mode */ }
}
