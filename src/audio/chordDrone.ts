// Chord-following drone: sustains the current chord's root + fifth and
// crossfades — click-free and gap-free — to the next chord at a scheduled
// AudioContext time. Chord changes come from the playback clock, so they land
// exactly on the barline together with the metronome.
//
// Voicing is quality-neutral (root + perfect fifth, no third): that's what a
// practice drone should be. Root sits in octave 3 (C3–B3), a comfortable bed
// under violin register.
//
// Why not useDrone.setPitchClass? It tears down and rebuilds the whole graph
// (audible gap) and runs through React state (not sample-accurate). This class
// builds the NEXT chord's voices into their own GainNode and ramps the two
// branches across ~120 ms centered on the change time.

import {
  pitchClassOctaveToFreq,
  preloadCelloSamples,
  startCelloVoiceFromCache,
  startSawtoothVoices,
  startShrutiVoice,
  stopDroneSources,
  type DroneSource,
  type SawtoothPitch,
} from './droneVoices'
import type { ChordQuality } from './chordSchedule'

export type ChordDroneSoundType = 'sawtooth' | 'shruti' | 'cello'

export interface ChordDroneOptions {
  soundType: ChordDroneSoundType
  concertPitchHz: number
  /** 0–1. Default 0.18 so the metronome stays perceptually in front. */
  volume?: number
  /**
   * Where the chord branches connect. Defaults to the raw device output; the
   * app passes the master bus (audioContext.getOutputNode) so the audibility
   * monitor can see this drone in the mix.
   */
  destination?: AudioNode
}

const ROOT_OCTAVE = 3
const CROSSFADE_S = 0.12
const STOP_FADE_S = 0.1
const VOLUME_RAMP_S = 0.05

interface FadeAnchor {
  time: number
  value: number
}

interface ChordBranch {
  gain: GainNode
  sources: DroneSource[]
  /**
   * The linear segment currently scheduled on `gain.gain`: it holds `from.value`
   * until `from.time`, ramps to `to.value` by `to.time`, and holds after.
   *
   * Tracked because a GainNode cannot be asked what it is *scheduled* to do.
   * Without it, setVolume can only append — and an appended ramp is sorted into
   * the middle of a crossfade rather than replacing it.
   */
  from: FadeAnchor
  to: FadeAnchor
}

/** The level a branch's scheduled automation reaches at `t`. */
function levelAt(branch: ChordBranch, t: number): number {
  const { from, to } = branch
  if (t <= from.time) return from.value
  if (t >= to.time) return to.value
  return from.value + (to.value - from.value) * ((t - from.time) / (to.time - from.time))
}

function rootMidi(rootPc: number): number {
  return rootPc + (ROOT_OCTAVE + 1) * 12 // C3 = 48
}

export class ChordDrone {
  private ctx: AudioContext
  private soundType: ChordDroneSoundType
  private concertPitchHz: number
  private volume: number
  private destination: AudioNode
  private current: ChordBranch | null = null
  private currentChord: { rootPc: number; quality: ChordQuality } | null = null
  private disposed = false

  constructor(ctx: AudioContext, options: ChordDroneOptions) {
    this.ctx = ctx
    this.soundType = options.soundType
    this.concertPitchHz = options.concertPitchHz
    this.volume = options.volume ?? 0.18
    this.destination = options.destination ?? ctx.destination
  }

  /**
   * Preload sample assets for all chords in the schedule so setChord never
   * waits on a fetch. No-op for synthesized voices.
   */
  async prepare(rootPcs: number[]): Promise<void> {
    if (this.soundType !== 'cello') return
    const midis = rootPcs.flatMap(pc => [rootMidi(pc), rootMidi(pc) + 7])
    await preloadCelloSamples(this.ctx, midis)
  }

  /**
   * Crossfade to a new chord at `atTime` (AudioContext seconds, may be in the
   * near future). Repeated identical chords are ignored — the drone must not
   * re-articulate when the harmony doesn't change.
   */
  setChord(rootPc: number, quality: ChordQuality, atTime?: number): void {
    if (this.disposed) return
    if (this.currentChord && this.currentChord.rootPc === rootPc && this.currentChord.quality === quality) {
      return
    }
    this.currentChord = { rootPc, quality }

    const now = this.ctx.currentTime
    const center = Math.max(now + 0.01, atTime ?? now)
    const fadeStart = Math.max(now, center - CROSSFADE_S / 2)
    const fadeEnd = fadeStart + CROSSFADE_S

    // Build the next chord's branch, silent from creation. A GainNode is born
    // at gain 1, and setValueAtTime(0, fadeStart) only takes effect AT
    // fadeStart — without the explicit zero below, the voices (started
    // immediately) would blast at full gain until fadeStart and then snap to
    // silence: a loud thump on every chord change.
    const gain = this.ctx.createGain()
    gain.gain.value = 0
    gain.gain.setValueAtTime(0, now)
    gain.gain.setValueAtTime(0, fadeStart)
    gain.gain.linearRampToValueAtTime(this.volume, fadeEnd)
    gain.connect(this.destination)
    const sources = this.buildVoices(gain, rootPc, fadeStart)
    const next: ChordBranch = {
      gain,
      sources,
      from: { time: fadeStart, value: 0 },
      to: { time: fadeEnd, value: this.volume },
    }

    // Fade the old branch out across the same window, then release it.
    const old = this.current
    if (old) {
      // Start from where the old branch actually IS, not from this.volume: on a
      // chord change that lands inside its own fade-in, or after a volume
      // change, those differ and the difference is an audible step.
      old.gain.gain.setValueAtTime(levelAt(old, fadeStart), fadeStart)
      old.gain.gain.linearRampToValueAtTime(0, fadeEnd)
      const releaseDelayMs = (fadeEnd - now) * 1000 + 60
      setTimeout(() => {
        stopDroneSources(old.sources)
        old.gain.disconnect()
      }, releaseDelayMs)
    }

    this.current = next
  }

  /**
   * Retarget the live branch. Safe to call at any point in a crossfade — the
   * backing-volume slider fires this on every drag, which lands mid-fade often
   * enough to matter.
   *
   * The old implementation appended a ramp, which the automation timeline sorts
   * INTO the crossfade rather than replacing it. Two audible failures came out
   * of that: called before the fade window opened, the branch faded in early and
   * the next chord bled over the current one; called during the window, the gain
   * raced to the new level and then drifted back to the level captured when the
   * chord was scheduled, leaving the drone at the wrong volume until the next
   * chord change. So: re-anchor at the level actually reached now, and rewrite
   * the rest of the segment.
   */
  setVolume(volume: number): void {
    this.volume = volume
    const branch = this.current
    if (!branch) return

    const now = this.ctx.currentTime
    const param = branch.gain.gain
    const held = levelAt(branch, now)
    // An in-flight crossfade keeps its END time — the window exists so the
    // change lands with the chord. Afterwards, a short ramp of its own.
    const endTime = now < branch.to.time ? branch.to.time : now + VOLUME_RAMP_S

    param.cancelScheduledValues(now)
    param.setValueAtTime(held, now)
    if (now < branch.from.time) {
      // The window has not opened yet: stay silent until it does.
      param.setValueAtTime(branch.from.value, branch.from.time)
    } else {
      branch.from = { time: now, value: held }
    }
    param.linearRampToValueAtTime(volume, endTime)
    branch.to = { time: endTime, value: volume }
  }

  /** Fade out and release the current chord. The drone can be restarted with setChord. */
  stop(atTime?: number): void {
    const branch = this.current
    if (!branch) return
    this.current = null
    this.currentChord = null
    const start = Math.max(this.ctx.currentTime, atTime ?? this.ctx.currentTime)
    // Same reasoning as the crossfade: fade from where the branch is, which is
    // not this.volume if we are stopping partway through a fade-in.
    branch.gain.gain.setValueAtTime(levelAt(branch, start), start)
    branch.gain.gain.linearRampToValueAtTime(0, start + STOP_FADE_S)
    const releaseDelayMs = (start + STOP_FADE_S - this.ctx.currentTime) * 1000 + 60
    setTimeout(() => {
      stopDroneSources(branch.sources)
      branch.gain.disconnect()
    }, releaseDelayMs)
  }

  dispose(): void {
    this.stop()
    this.disposed = true
  }

  // ── voice construction ─────────────────────────────────────────────────────

  private buildVoices(destination: GainNode, rootPc: number, startAt: number): DroneSource[] {
    const fifthPc = (rootPc + 7) % 12
    const fifthOctave = rootPc + 7 >= 12 ? ROOT_OCTAVE + 1 : ROOT_OCTAVE

    switch (this.soundType) {
      case 'shruti':
        // Shruti boxes are root drones (the voice already includes a
        // sub-octave reed); a fifth would double every reed oscillator.
        return startShrutiVoice(this.ctx, destination, rootPc, ROOT_OCTAVE - 4, this.concertPitchHz)

      case 'cello': {
        // Start at the fade window, past the sample's bow attack (default
        // offset) — a chord change must never re-articulate the bow.
        const sources: DroneSource[] = []
        const root = startCelloVoiceFromCache(this.ctx, destination, rootMidi(rootPc), this.concertPitchHz, startAt)
        const fifth = startCelloVoiceFromCache(this.ctx, destination, rootMidi(rootPc) + 7, this.concertPitchHz, startAt)
        if (root) sources.push(...root)
        if (fifth) sources.push(...fifth)
        if (sources.length > 0) return sources
        // Samples not cached (prepare() skipped or failed) — degrade to synth
        // rather than waiting on a fetch mid-phrase.
        return this.sawtoothChord(destination, rootPc, fifthPc, fifthOctave)
      }

      case 'sawtooth':
      default:
        return this.sawtoothChord(destination, rootPc, fifthPc, fifthOctave)
    }
  }

  private sawtoothChord(
    destination: GainNode,
    rootPc: number,
    fifthPc: number,
    fifthOctave: number,
  ): DroneSource[] {
    const pitches: SawtoothPitch[] = [
      { pitchClass: rootPc, octave: ROOT_OCTAVE, relVol: 1.0 },
      { pitchClass: fifthPc, octave: fifthOctave, relVol: 0.7 },
    ]
    return startSawtoothVoices(this.ctx, destination, pitches, this.concertPitchHz)
  }
}

export { pitchClassOctaveToFreq }
