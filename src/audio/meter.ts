// Meter → metronome-pulse math (pure, no audio). The playback clock always
// ticks quarter notes; the METRONOME clicks on the meter's felt pulse:
//
//   simple meters (4/4, 3/4, 2/4)      → quarter-note clicks (pulse 1 QN)
//   compound meters (6/8, 9/8, 12/8)   → dotted-quarter clicks (pulse 1.5 QN)
//   half-note meters (2/2, 3/2)        → half-note clicks (pulse 2 QN)
//
// Pulse positions are expressed in quarter-note beats on the same grid as
// chordSchedule/noteSchedule, so they can fall between clock ticks (a 6/8
// bar pulses at 0 and 1.5).

export interface MeterTimeSignature {
  beats: number
  beatUnit: number
}

/** Metronome pulse length in quarter-note beats for a time signature. */
export function pulseFromTimeSignature(ts?: MeterTimeSignature | null): number {
  if (!ts || ts.beatUnit <= 0) return 1
  if (ts.beatUnit === 8 && ts.beats % 3 === 0) return 1.5 // compound: dotted quarter
  if (ts.beatUnit === 2) return 2 // cut time & friends: half note
  return 1
}

export interface MetronomeClick {
  /** Position in quarter-note beats (may be negative during count-in). */
  beat: number
  isDownbeat: boolean
}

const EPS = 1e-9

/**
 * All metronome clicks in `[fromBeat, toBeat)` — clicks live on multiples of
 * `pulseBeats`; downbeats on multiples of `beatsPerBar`. The playback loop
 * calls this once per clock beat (a 1-QN window), so compound-meter clicks
 * that fall between clock ticks are still scheduled at their exact position.
 * Negative windows (count-in) work: the grid extends below zero.
 */
export function clicksInWindow(
  fromBeat: number,
  toBeat: number,
  pulseBeats: number,
  beatsPerBar: number,
): MetronomeClick[] {
  const clicks: MetronomeClick[] = []
  if (pulseBeats <= 0) return clicks
  for (let k = Math.ceil((fromBeat - EPS) / pulseBeats); k * pulseBeats < toBeat - EPS; k++) {
    const beat = k * pulseBeats || 0 // `|| 0` normalizes -0 (k = ceil(-ε))
    const posInBar = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar
    clicks.push({ beat, isDownbeat: posInBar < EPS || beatsPerBar - posInBar < EPS })
  }
  return clicks
}
