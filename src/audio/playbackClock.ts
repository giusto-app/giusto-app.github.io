// Lookahead playback clock — the single owner of musical time.
//
// The "two clocks" pattern: a coarse JS timer (setInterval, ~25 ms) only wakes
// the scheduler; every audible event is scheduled at a precise
// AudioContext.currentTime. JS timers jitter and pause in background tabs;
// the audio clock is sample-accurate.
//
// Beat callbacks fire AHEAD of audible time (with the future timestamp) so
// subscribers can schedule audio. Visual callbacks fire from a
// requestAnimationFrame loop when the audio clock actually reaches the beat.

export interface BeatEvent {
  /** 0-based beat index from playback start (count-in beats are negative). */
  beat: number
  /** AudioContext time (seconds) at which this beat sounds. */
  time: number
  isDownbeat: boolean
}

export interface PlaybackClockOptions {
  bpm: number
  /** Beats per measure (numerator of the time signature). Default 4. */
  beatsPerMeasure?: number
  /** Number of count-in beats to fire before beat 0. Default 0. */
  countInBeats?: number
  /** Stop after this beat index (exclusive). Omit for endless. */
  totalBeats?: number
  /** Scheduler wake interval in ms. Default 25. */
  timerIntervalMs?: number
  /** Scheduling horizon in seconds. Default 0.1. */
  lookaheadS?: number
}

type BeatCallback = (e: BeatEvent) => void
type VisualCallback = (beat: number) => void

export class PlaybackClock {
  private ctx: AudioContext
  private opts: Required<Pick<PlaybackClockOptions, 'beatsPerMeasure' | 'countInBeats' | 'timerIntervalMs' | 'lookaheadS'>> & {
    totalBeats?: number
  }
  private _bpm: number
  private timer: ReturnType<typeof setInterval> | null = null
  private rafId: number | null = null
  private nextBeat = 0
  private nextBeatTime = 0
  private beatCallbacks = new Set<BeatCallback>()
  private visualCallbacks = new Set<VisualCallback>()
  private endedCallbacks = new Set<() => void>()
  private visualQueue: BeatEvent[] = []
  private _isPlaying = false

  constructor(ctx: AudioContext, options: PlaybackClockOptions) {
    this.ctx = ctx
    this._bpm = options.bpm
    this.opts = {
      beatsPerMeasure: options.beatsPerMeasure ?? 4,
      countInBeats: options.countInBeats ?? 0,
      timerIntervalMs: options.timerIntervalMs ?? 25,
      lookaheadS: options.lookaheadS ?? 0.1,
      totalBeats: options.totalBeats,
    }
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get bpm(): number {
    return this._bpm
  }

  /** Takes effect from the next not-yet-scheduled beat. */
  setBpm(bpm: number): void {
    this._bpm = Math.max(20, Math.min(300, bpm))
  }

  /** End at this absolute beat boundary. Useful for runs whose length is
   * decided while playing, such as a tempo trainer reaching its target. */
  setTotalBeats(totalBeats: number): void {
    this.opts.totalBeats = Math.max(0, totalBeats)
  }

  /** Subscribe to beats at schedule time (timestamps are in the future). */
  onBeat(cb: BeatCallback): () => void {
    this.beatCallbacks.add(cb)
    return () => this.beatCallbacks.delete(cb)
  }

  /** Subscribe to beats at audible time (rAF-aligned, for UI). */
  onVisualBeat(cb: VisualCallback): () => void {
    this.visualCallbacks.add(cb)
    return () => this.visualCallbacks.delete(cb)
  }

  onEnded(cb: () => void): () => void {
    this.endedCallbacks.add(cb)
    return () => this.endedCallbacks.delete(cb)
  }

  /** Must be preceded by a resumed AudioContext (user gesture). */
  start(): void {
    if (this._isPlaying) return
    this._isPlaying = true
    this.nextBeat = -this.opts.countInBeats || 0 // `|| 0` normalizes -0
    // Small offset so the first beat is comfortably schedulable.
    this.nextBeatTime = this.ctx.currentTime + 0.05
    this.visualQueue = []
    this.timer = setInterval(() => this.scheduleAhead(), this.opts.timerIntervalMs)
    this.scheduleAhead()
    this.startVisualLoop()
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.visualQueue = []
    this._isPlaying = false
  }

  private scheduleAhead(): void {
    const horizon = this.ctx.currentTime + this.opts.lookaheadS
    while (this._isPlaying && this.nextBeatTime < horizon) {
      const totalBeats = this.opts.totalBeats
      if (totalBeats !== undefined && this.nextBeat >= totalBeats) {
        // Let the tail of the last beat ring out, then report the end.
        const endDelayMs = Math.max(0, (this.nextBeatTime - this.ctx.currentTime) * 1000)
        setTimeout(() => {
          if (!this._isPlaying) return
          this.stop()
          this.endedCallbacks.forEach(cb => cb())
        }, endDelayMs)
        return
      }
      const event: BeatEvent = {
        beat: this.nextBeat,
        time: this.nextBeatTime,
        isDownbeat: beatIsDownbeat(this.nextBeat, this.opts.beatsPerMeasure),
      }
      this.beatCallbacks.forEach(cb => cb(event))
      this.visualQueue.push(event)
      this.nextBeatTime += secondsPerBeat(this._bpm)
      this.nextBeat += 1
    }
  }

  private startVisualLoop(): void {
    const tick = () => {
      if (!this._isPlaying) return
      const now = this.ctx.currentTime
      while (this.visualQueue.length > 0 && this.visualQueue[0].time <= now) {
        const e = this.visualQueue.shift()!
        this.visualCallbacks.forEach(cb => cb(e.beat))
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm
}

/** Count-in beats (negative indices) accent their own bar starts too. */
export function beatIsDownbeat(beat: number, beatsPerMeasure: number): boolean {
  return ((beat % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure === 0
}
