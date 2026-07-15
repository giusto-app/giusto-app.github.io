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
  /** 0–1. Default 0.35 (matches the manual drone). */
  volume?: number
}

const ROOT_OCTAVE = 3
const CROSSFADE_S = 0.12
const STOP_FADE_S = 0.1

interface ChordBranch {
  gain: GainNode
  sources: DroneSource[]
}

function rootMidi(rootPc: number): number {
  return rootPc + (ROOT_OCTAVE + 1) * 12 // C3 = 48
}

export class ChordDrone {
  private ctx: AudioContext
  private soundType: ChordDroneSoundType
  private concertPitchHz: number
  private volume: number
  private current: ChordBranch | null = null
  private currentChord: { rootPc: number; quality: ChordQuality } | null = null
  private disposed = false

  constructor(ctx: AudioContext, options: ChordDroneOptions) {
    this.ctx = ctx
    this.soundType = options.soundType
    this.concertPitchHz = options.concertPitchHz
    this.volume = options.volume ?? 0.35
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

    // Build the next chord's branch, silent until the fade.
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, fadeStart)
    gain.gain.linearRampToValueAtTime(this.volume, fadeEnd)
    gain.connect(this.ctx.destination)
    const sources = this.buildVoices(gain, rootPc)
    const next: ChordBranch = { gain, sources }

    // Fade the old branch out across the same window, then release it.
    const old = this.current
    if (old) {
      old.gain.gain.setValueAtTime(this.volume, fadeStart)
      old.gain.gain.linearRampToValueAtTime(0, fadeEnd)
      const releaseDelayMs = (fadeEnd - now) * 1000 + 60
      setTimeout(() => {
        stopDroneSources(old.sources)
        old.gain.disconnect()
      }, releaseDelayMs)
    }

    this.current = next
  }

  setVolume(volume: number): void {
    this.volume = volume
    if (this.current) {
      this.current.gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.05)
    }
  }

  /** Fade out and release the current chord. The drone can be restarted with setChord. */
  stop(atTime?: number): void {
    const branch = this.current
    if (!branch) return
    this.current = null
    this.currentChord = null
    const start = Math.max(this.ctx.currentTime, atTime ?? this.ctx.currentTime)
    branch.gain.gain.setValueAtTime(this.volume, start)
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

  private buildVoices(destination: GainNode, rootPc: number): DroneSource[] {
    const fifthPc = (rootPc + 7) % 12
    const fifthOctave = rootPc + 7 >= 12 ? ROOT_OCTAVE + 1 : ROOT_OCTAVE

    switch (this.soundType) {
      case 'shruti':
        // Shruti boxes are root drones (the voice already includes a
        // sub-octave reed); a second full shruti voice on the fifth would
        // double the tremolo LFOs on one gain node.
        return startShrutiVoice(this.ctx, destination, rootPc, ROOT_OCTAVE - 4, this.concertPitchHz)

      case 'cello': {
        const sources: DroneSource[] = []
        const root = startCelloVoiceFromCache(this.ctx, destination, rootMidi(rootPc), this.concertPitchHz)
        const fifth = startCelloVoiceFromCache(this.ctx, destination, rootMidi(rootPc) + 7, this.concertPitchHz)
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
