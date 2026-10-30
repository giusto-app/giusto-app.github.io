// Wait mode (PLAN_LOOP_RANGE.md, LR10; Sightread's "Wait"): the cursor holds
// on a note of the violin line until the microphone hears it — the right
// pitch, in tune, held briefly — then moves to the next. Rests are passed over;
// there is no clock, so the player sets the pace. Pure logic, no audio or DOM:
// the page feeds it what the pitch detector hears.

import { buildPlaybackTimelineFromScore, type Score } from 'lilyjs'

/** One note to play: its rendered event id and the pitches that satisfy it. */
export interface WaitNote {
  eventId: string
  /** A chord (double stop) is satisfied by any of its pitches. */
  midis: number[]
  startBeat: number
}

/** The violin line's notes in order, rests and grace notes left out. */
export function waitNotes(score: Score, partIndex = 0): WaitNote[] {
  return buildPlaybackTimelineFromScore(score).events
    .filter((e) => e.partIndex === partIndex && !e.isRest && !e.isGrace && e.pitches.length > 0)
    .map((e) => ({ eventId: e.eventId, midis: e.pitches.map((p) => p.midi), startBeat: e.startQN.num / e.startQN.den }))
}

/** The notes that start inside `[fromBeat, toBeat)`; `toBeat` null = to the end. */
export function waitNotesInWindow(notes: readonly WaitNote[], fromBeat: number, toBeat: number | null): WaitNote[] {
  return notes.filter((n) => n.startBeat >= fromBeat - 1e-6 && (toBeat === null || n.startBeat < toBeat - 1e-6))
}

export interface WaitOptions {
  /** How long the right pitch must be held, in ms, so a passing slide does not count. */
  holdMs?: number
  /** How far from the note, in cents, still counts as in tune. */
  toleranceCents?: number
  /** Start over at the first note after the last, as Loop does. */
  loop?: boolean
}

export type WaitResult = 'waiting' | 'holding' | 'advanced' | 'done'

export class WaitTracker {
  private index = 0
  private heldSince: number | null = null
  /** The next note repeats the last one's pitch, so it needs a fresh attack. */
  private needsRelease = false
  private readonly holdMs: number
  private readonly toleranceCents: number
  private readonly loop: boolean

  constructor(private readonly notes: readonly WaitNote[], options: WaitOptions = {}) {
    this.holdMs = options.holdMs ?? 200
    this.toleranceCents = options.toleranceCents ?? 25
    this.loop = options.loop ?? false
  }

  /** The note being waited for; null once a take without loop is done. */
  get current(): WaitNote | null {
    return this.notes[this.index] ?? null
  }

  /**
   * What the detector heard at `nowMs`: a MIDI note and its cents off, or null
   * for silence or an unclear pitch.
   */
  hear(midi: number | null, cents: number, nowMs: number): WaitResult {
    const note = this.current
    if (!note) return 'done'
    const right = midi !== null && note.midis.includes(midi) && Math.abs(cents) <= this.toleranceCents
    if (!right) {
      this.heldSince = null
      // Silence or another pitch is the gap between two equal notes.
      if (midi === null || !note.midis.includes(midi)) this.needsRelease = false
      return 'waiting'
    }
    if (this.needsRelease) return 'waiting'
    this.heldSince ??= nowMs
    if (nowMs - this.heldSince < this.holdMs) return 'holding'
    return this.advance()
  }

  private advance(): WaitResult {
    const prev = this.current!
    this.heldSince = null
    this.index += 1
    if (this.index >= this.notes.length) {
      if (!this.loop || this.notes.length === 0) return 'done'
      this.index = 0
    }
    const next = this.current!
    this.needsRelease = next.midis.some((m) => prev.midis.includes(m))
    return 'advanced'
  }
}
