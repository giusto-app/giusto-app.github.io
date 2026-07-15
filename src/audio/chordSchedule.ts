// Chord-change schedule derived from a parsed score (pure data — no audio,
// no React). Input is the modern lilyjs music-model shape: measures carrying
// `chordSymbols` from `\chordmode` (eventId === null) with quarter-note
// offsets, plus per-measure time signatures.
//
// All positions are in quarter-note beats ("QN beats"). The playback clock's
// BPM is quarter = N, which matches simple meters (4/4, 3/4, 2/4). Compound
// meters (6/8 dotted-quarter beats) are out of scope for now.

import type { MeasureLike, ScoreLike } from 'lilyjs'

export type ChordQuality = 'maj' | 'min' | 'dom7' | 'other'

export interface ChordEvent {
  /** 0-based start position in quarter-note beats. */
  startBeat: number
  durationBeats: number
  /** 0=C … 11=B */
  rootPc: number
  quality: ChordQuality
  /** Display label, e.g. "Gm", "Bb". */
  label: string
}

const ROOT_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/**
 * Parse a chord label ("Gm", "Bb", "C#m7", "F", "G7") into root pitch class
 * and quality. The drone voices root+fifth, so unknown qualities are fine —
 * they only lose the (unused) third.
 */
export function parseChordLabel(name: string): { rootPc: number; quality: ChordQuality } | null {
  const m = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(name.trim())
  if (!m) return null
  const [, letter, accidental, rest] = m
  let rootPc = ROOT_PC[letter.toUpperCase()]
  if (rootPc === undefined) return null
  if (accidental === '#' || accidental === '♯') rootPc = (rootPc + 1) % 12
  if (accidental === 'b' || accidental === '♭') rootPc = (rootPc + 11) % 12

  const suffix = rest.toLowerCase()
  let quality: ChordQuality
  if (suffix.startsWith('maj')) {
    quality = 'maj'
  } else if (suffix.startsWith('m') || suffix.startsWith('min') || suffix.startsWith('-')) {
    quality = 'min'
  } else if (suffix === '') {
    quality = 'maj'
  } else if (suffix.startsWith('7') || suffix.startsWith('dom')) {
    quality = 'dom7'
  } else {
    quality = 'other'
  }
  return { rootPc, quality }
}

function measureDurationQN(measure: MeasureLike): number {
  if (typeof measure.expectedDurationQN === 'number' && measure.expectedDurationQN > 0) {
    return measure.expectedDurationQN
  }
  const ts = measure.timeSignature
  if (ts && ts.beatUnit > 0) return (ts.beats * 4) / ts.beatUnit
  return 4
}

export interface ChordScheduleResult {
  events: ChordEvent[]
  /** Total score length in quarter-note beats. */
  totalBeats: number
  /** Quarter-note beats per bar of the first measure (for the metronome accent). */
  beatsPerBar: number
  /** First explicit \tempo bpm found in the score, if any. */
  bpm?: number
}

/**
 * Walk the score's first part and turn its `\chordmode` chord symbols into a
 * merged timeline. Consecutive identical chords (| g1:m | g1:m |) merge into
 * one event so the drone never re-articulates on a repeated chord.
 */
export function buildChordSchedule(score: ScoreLike): ChordScheduleResult {
  const measures = score.parts[0]?.measures ?? []
  const raw: Array<Omit<ChordEvent, 'durationBeats'>> = []
  let cursorQN = 0
  let bpm: number | undefined
  let beatsPerBar = 4

  measures.forEach((measure, index) => {
    if (index === 0) {
      const ts = measure.timeSignature
      if (ts && ts.beatUnit > 0) beatsPerBar = (ts.beats * 4) / ts.beatUnit
    }
    if (bpm === undefined) {
      bpm = measure.tempoMarks?.find(t => typeof t.bpm === 'number')?.bpm
    }
    for (const symbol of measure.chordSymbols) {
      // \chordmode-derived names have eventId === null; note-attached ^"..."
      // markup has an eventId and is not a harmony track.
      if (symbol.eventId !== null) continue
      const parsed = parseChordLabel(symbol.text)
      if (!parsed) continue
      const offsetQN = symbol.offset ? symbol.offset.num / symbol.offset.den : 0
      raw.push({
        startBeat: cursorQN + offsetQN,
        rootPc: parsed.rootPc,
        quality: parsed.quality,
        label: symbol.text,
      })
    }
    cursorQN += measureDurationQN(measure)
  })

  const totalBeats = cursorQN
  raw.sort((a, b) => a.startBeat - b.startBeat)

  const events: ChordEvent[] = []
  for (const entry of raw) {
    const prev = events[events.length - 1]
    if (prev && prev.rootPc === entry.rootPc && prev.quality === entry.quality) {
      continue // same chord continues — extend, don't re-articulate
    }
    if (prev) prev.durationBeats = entry.startBeat - prev.startBeat
    events.push({ ...entry, durationBeats: 0 })
  }
  const last = events[events.length - 1]
  if (last) last.durationBeats = totalBeats - last.startBeat

  return { events, totalBeats, beatsPerBar, bpm }
}

/** The chord event starting exactly at `beat`, if any (for scheduler wiring). */
export function chordStartingAtBeat(events: ChordEvent[], beat: number): ChordEvent | undefined {
  return events.find(e => Math.abs(e.startBeat - beat) < 1e-6)
}

/**
 * Chord events starting in `[fromBeat, toBeat)` — the scheduler calls this per
 * clock beat so mid-beat chord changes (offbeat offsets) are still scheduled,
 * each at its exact fractional position.
 */
export function chordsStartingInWindow(events: ChordEvent[], fromBeat: number, toBeat: number): ChordEvent[] {
  return events.filter(e => e.startBeat >= fromBeat - 1e-6 && e.startBeat < toBeat - 1e-6)
}

/** The chord event sounding at `beat`, if any (for UI highlighting). */
export function chordSoundingAtBeat(events: ChordEvent[], beat: number): ChordEvent | undefined {
  return events.find(e => beat >= e.startBeat - 1e-6 && beat < e.startBeat + e.durationBeats - 1e-6)
}
