// Sampled backing instruments (strings / bass / guitar), one class parameterized
// by a sample set. Each note plays the nearest sample pitch-shifted, through an
// amplitude envelope, into a per-instrument procedural concert-hall reverb.
// Optional ensemble voices (a detuned double) give a string section / two-guitar
// width. Falls back to a mellow sawtooth if a sample isn't present.
//
// Samples: FluidR3_GM (CC-BY 3.0), self-hosted by scripts/fetch-samples.ts.

export type InstrumentId = 'strings' | 'bass' | 'guitar' | 'pizzicato'

export interface SampleSet {
  dir: string
  samples: { midiNote: number; note: string }[]
  attackS: number
  releaseS: number
  /** Peak amplitude scale before velocity. */
  gain: number
  /** Loop the sustain for notes longer than the sample (bowed strings). */
  loopSustain: boolean
  /** Reverb wet mix 0–1. */
  reverbWet: number
  /** Voices per note — 2 gives a detuned ensemble (string section / 2 guitars). */
  voices: number
  /** Detune spread across ensemble voices, in cents. */
  detuneCents: number
}

const STRINGS: SampleSet = {
  dir: '/sounds/strings',
  samples: [
    { midiNote: 36, note: 'C2' }, { midiNote: 40, note: 'E2' }, { midiNote: 43, note: 'G2' },
    { midiNote: 47, note: 'B2' }, { midiNote: 50, note: 'D3' }, { midiNote: 53, note: 'F3' },
    { midiNote: 57, note: 'A3' }, { midiNote: 60, note: 'C4' }, { midiNote: 64, note: 'E4' },
    { midiNote: 67, note: 'G4' }, { midiNote: 71, note: 'B4' }, { midiNote: 74, note: 'D5' },
    { midiNote: 77, note: 'F5' }, { midiNote: 81, note: 'A5' }, { midiNote: 84, note: 'C6' },
  ],
  // A bowed section does not speak instantly and does not stop dead: a slower
  // attack and a long tail are most of what separates "sampled strings" from
  // "synth pad". Three lightly detuned voices widen the section without the
  // chorusing a large detune produces.
  attackS: 0.09, releaseS: 0.85, gain: 0.9, loopSustain: true, reverbWet: 0.38, voices: 3, detuneCents: 9,
}

const BASS: SampleSet = {
  dir: '/sounds/bass',
  samples: [
    { midiNote: 28, note: 'E1' }, { midiNote: 31, note: 'G1' }, { midiNote: 36, note: 'C2' },
    { midiNote: 40, note: 'E2' }, { midiNote: 43, note: 'G2' }, { midiNote: 48, note: 'C3' },
    { midiNote: 52, note: 'E3' }, { midiNote: 55, note: 'G3' },
  ],
  // Upright bass: quick but not clicky, and it rings — a 0.2 s release cut the
  // note off before the next downbeat, which read as a synth blip.
  attackS: 0.008, releaseS: 0.45, gain: 1.25, loopSustain: false, reverbWet: 0.14, voices: 1, detuneCents: 0,
}

const GUITAR: SampleSet = {
  dir: '/sounds/guitar',
  samples: [
    { midiNote: 40, note: 'E2' }, { midiNote: 43, note: 'G2' }, { midiNote: 48, note: 'C3' },
    { midiNote: 52, note: 'E3' }, { midiNote: 55, note: 'G3' }, { midiNote: 60, note: 'C4' },
    { midiNote: 64, note: 'E4' }, { midiNote: 67, note: 'G4' }, { midiNote: 72, note: 'C5' },
    { midiNote: 76, note: 'E5' },
  ],
  attackS: 0.004, releaseS: 0.18, gain: 0.85, loopSustain: false, reverbWet: 0.18, voices: 2, detuneCents: 6,
}

const PIZZICATO: SampleSet = {
  dir: '/sounds/pizzicato',
  samples: [
    { midiNote: 36, note: 'C2' }, { midiNote: 40, note: 'E2' }, { midiNote: 43, note: 'G2' },
    { midiNote: 48, note: 'C3' }, { midiNote: 52, note: 'E3' }, { midiNote: 55, note: 'G3' },
    { midiNote: 60, note: 'C4' }, { midiNote: 64, note: 'E4' }, { midiNote: 67, note: 'G4' },
    { midiNote: 72, note: 'C5' },
  ],
  // Section pizzicato: a pluck is instant, then decays — the ring has to be
  // allowed to continue past the note's written length or every chick sounds
  // clipped. Two detuned voices give the orchestral width, and it shares some
  // of the bowed section's hall.
  attackS: 0.003, releaseS: 0.55, gain: 1.0, loopSustain: false, reverbWet: 0.3, voices: 2, detuneCents: 6,
}

export const SAMPLE_SETS: Record<InstrumentId, SampleSet> = { strings: STRINGS, bass: BASS, guitar: GUITAR, pizzicato: PIZZICATO }

export interface SampledInstrumentOptions {
  concertPitchHz: number
  /** 0–1. Default 0.6. */
  volume?: number
}

function nearestSample(set: SampleSet, midi: number): { midiNote: number; note: string } {
  let best = set.samples[0]!
  for (const s of set.samples) {
    if (Math.abs(s.midiNote - midi) < Math.abs(best.midiNote - midi)) best = s
  }
  return best
}

/** Procedural concert-hall impulse: exponentially-decaying stereo noise. */
function makeReverbIR(ctx: AudioContext, seconds = 2.4, decay = 2.6): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const ir = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
  }
  return ir
}

export class SampledInstrument {
  private ctx: AudioContext
  private set: SampleSet
  private concertPitchHz: number
  private master: GainNode
  private dry: GainNode
  private wet: GainNode
  private convolver: ConvolverNode
  private cache = new Map<string, AudioBuffer>()
  private disposed = false

  constructor(ctx: AudioContext, set: SampleSet, options: SampledInstrumentOptions) {
    this.ctx = ctx
    this.set = set
    this.concertPitchHz = options.concertPitchHz
    this.master = ctx.createGain()
    this.master.gain.value = options.volume ?? 0.6

    this.dry = ctx.createGain()
    this.dry.gain.value = 1 - set.reverbWet
    this.wet = ctx.createGain()
    this.wet.gain.value = set.reverbWet
    this.convolver = ctx.createConvolver()
    this.convolver.buffer = makeReverbIR(ctx)

    this.master.connect(this.dry)
    this.dry.connect(ctx.destination)
    this.master.connect(this.convolver)
    this.convolver.connect(this.wet)
    this.wet.connect(ctx.destination)
  }

  /** Preload (fetch + decode) the samples nearest the given MIDI notes. */
  async prepare(midiNotes: number[]): Promise<void> {
    const notes = new Set(midiNotes.map((m) => nearestSample(this.set, m).note))
    await Promise.all(
      [...notes].map(async (note) => {
        if (this.cache.has(note)) return
        try {
          const res = await fetch(`${this.set.dir}/${note}.mp3`)
          if (!res.ok) return
          this.cache.set(note, await this.ctx.decodeAudioData(await res.arrayBuffer()))
        } catch {
          /* missing sample → fallback synth at play time */
        }
      }),
    )
  }

  setVolume(volume: number): void {
    this.master.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.05)
  }

  /** Play one note at `atTime`, sounding for ~`durationS` then releasing. */
  playNote(midi: number, atTime: number, durationS: number, velocity: number): void {
    if (this.disposed) return
    const set = this.set
    const start = Math.max(this.ctx.currentTime + 0.001, atTime)
    const nearest = nearestSample(set, midi)
    const buffer = this.cache.get(nearest.note)
    if (!buffer) {
      this.playFallback(midi, start, durationS, velocity)
      return
    }

    const voices = Math.max(1, set.voices)
    const peak = Math.max(0.0002, (Math.min(1, velocity / 127) * set.gain) / voices)
    const holdEnd = start + Math.max(set.attackS, durationS)
    const rate = Math.pow(2, (midi - nearest.midiNote) / 12) * (this.concertPitchHz / 440)

    for (let v = 0; v < voices; v++) {
      const detune = voices === 1 ? 0 : -set.detuneCents / 2 + (set.detuneCents * v) / (voices - 1)
      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      source.detune.value = detune
      if (set.loopSustain && buffer.duration / rate < durationS + set.releaseS) {
        source.loop = true
        source.loopStart = Math.min(0.18, buffer.duration * 0.3)
        source.loopEnd = buffer.duration
      }
      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.0001, start)
      env.gain.linearRampToValueAtTime(peak, start + set.attackS)
      env.gain.setValueAtTime(peak, holdEnd)
      env.gain.exponentialRampToValueAtTime(0.0001, holdEnd + set.releaseS)
      source.connect(env)
      env.connect(this.master)
      source.start(start)
      source.stop(holdEnd + set.releaseS + 0.05)
    }
  }

  private playFallback(midi: number, start: number, durationS: number, velocity: number): void {
    const freq = this.concertPitchHz * Math.pow(2, (midi - 69) / 12)
    const peak = Math.max(0.0002, Math.min(1, velocity / 127) * 0.4)
    const holdEnd = start + Math.max(this.set.attackS, durationS)
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2000
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(peak, start + this.set.attackS)
    env.gain.setValueAtTime(peak, holdEnd)
    env.gain.exponentialRampToValueAtTime(0.0001, holdEnd + this.set.releaseS)
    osc.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    osc.start(start)
    osc.stop(holdEnd + this.set.releaseS + 0.05)
  }

  stop(atTime?: number): void {
    const start = Math.max(this.ctx.currentTime, atTime ?? this.ctx.currentTime)
    this.master.gain.cancelScheduledValues(start)
    this.master.gain.setValueAtTime(this.master.gain.value, start)
    this.master.gain.linearRampToValueAtTime(0.0001, start + 0.15)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    setTimeout(() => {
      this.master.disconnect()
      this.dry.disconnect()
      this.wet.disconnect()
      this.convolver.disconnect()
    }, 250)
  }
}
