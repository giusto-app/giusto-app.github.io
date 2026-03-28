import type { TuningStatus } from './noteUtils'
import type { NoteEvent } from './sessions'

export interface PitchSample {
  midiNote: number
  pitchClass: number
  noteName: string
  octave: number
  cents: number
  timestamp: number  // ms from session start
}

const MIN_SAMPLES = 5    // minimum samples per note event (~80ms at 60fps)
const MIN_DURATION = 100 // ms minimum duration
const MAX_GAP_MS = 200   // silence gap that breaks a note group

export function groupSamplesIntoNoteEvents(samples: PitchSample[]): NoteEvent[] {
  if (samples.length === 0) return []

  const events: NoteEvent[] = []
  let group: PitchSample[] = [samples[0]]

  for (let i = 1; i < samples.length; i++) {
    const s = samples[i]
    const prev = group[group.length - 1]
    const gap = s.timestamp - prev.timestamp

    if (s.midiNote === prev.midiNote && gap < MAX_GAP_MS) {
      group.push(s)
    } else {
      const event = finalizeGroup(group)
      if (event) events.push(event)
      group = [s]
    }
  }

  const last = finalizeGroup(group)
  if (last) events.push(last)

  return events
}

function finalizeGroup(samples: PitchSample[]): NoteEvent | null {
  if (samples.length < MIN_SAMPLES) return null
  const duration = samples[samples.length - 1].timestamp - samples[0].timestamp
  if (duration < MIN_DURATION) return null

  // Use the mode MIDI note (most common) to handle rare detector glitches
  const counts: Record<number, number> = {}
  for (const s of samples) counts[s.midiNote] = (counts[s.midiNote] ?? 0) + 1
  const modeMidi = Number(
    Object.entries(counts).sort(([, a], [, b]) => b - a)[0]![0],
  )

  // Stats from all samples whose midiNote matches the mode
  const core = samples.filter(s => s.midiNote === modeMidi)
  const avgCents = core.reduce((sum, s) => sum + s.cents, 0) / core.length
  const absCentsAvg = core.reduce((sum, s) => sum + Math.abs(s.cents), 0) / core.length
  const status: TuningStatus =
    absCentsAvg <= 10 ? 'in-tune' : absCentsAvg <= 25 ? 'close' : 'out-of-tune'

  const ref = core[0]!
  return {
    midiNote: modeMidi,
    pitchClass: ((modeMidi % 12) + 12) % 12,
    noteName: ref.noteName,
    octave: ref.octave,
    avgCents,
    absCentsAvg,
    durationMs: duration,
    startTime: samples[0].timestamp,
    status,
  }
}
