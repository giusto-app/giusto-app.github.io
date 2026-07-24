// Sampled string-section instrument for the musical backing (chords + arpeggio).
//
// Samples: FluidR3_GM string_ensemble_1 (CC-BY 3.0), self-hosted in
// public/sounds/strings/ by scripts/fetch-strings.ts. Each note plays the
// nearest sample pitch-shifted, through an amplitude envelope, into a shared
// procedural concert-hall reverb — so chords/arpeggios read as an orchestral
// string section rather than a synth.
//
// If the samples aren't present (script not run yet), notes fall back to a
// mellow filtered sawtooth so playback still works.

/** Nearest-sample map — matches the files scripts/fetch-strings.ts downloads. */
const STRINGS_SAMPLES: { midiNote: number; note: string }[] = [
  { midiNote: 36, note: 'C2' }, { midiNote: 40, note: 'E2' }, { midiNote: 43, note: 'G2' },
  { midiNote: 47, note: 'B2' }, { midiNote: 50, note: 'D3' }, { midiNote: 53, note: 'F3' },
  { midiNote: 57, note: 'A3' }, { midiNote: 60, note: 'C4' }, { midiNote: 64, note: 'E4' },
  { midiNote: 67, note: 'G4' }, { midiNote: 71, note: 'B4' }, { midiNote: 74, note: 'D5' },
  { midiNote: 77, note: 'F5' }, { midiNote: 81, note: 'A5' }, { midiNote: 84, note: 'C6' },
]

const SAMPLE_URL = (note: string) => `/sounds/strings/${note}.mp3`
/** Skip the ensemble's soft bow attack when looping a sustained note. */
const STRINGS_ATTACK_S = 0.18

export interface StringsInstrumentOptions {
  concertPitchHz: number
  /** 0–1. Default 0.6. */
  volume?: number
}

function nearestSample(midi: number): { midiNote: number; note: string } {
  let best = STRINGS_SAMPLES[0]!
  for (const s of STRINGS_SAMPLES) {
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
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return ir
}

export class StringsInstrument {
  private ctx: AudioContext
  private concertPitchHz: number
  private master: GainNode
  private dry: GainNode
  private wet: GainNode
  private convolver: ConvolverNode
  private cache = new Map<string, AudioBuffer>()
  private disposed = false

  constructor(ctx: AudioContext, options: StringsInstrumentOptions) {
    this.ctx = ctx
    this.concertPitchHz = options.concertPitchHz
    this.master = ctx.createGain()
    this.master.gain.value = options.volume ?? 0.6

    this.dry = ctx.createGain()
    this.dry.gain.value = 0.78
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.32
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
    const notes = new Set(midiNotes.map((m) => nearestSample(m).note))
    await Promise.all(
      [...notes].map(async (note) => {
        if (this.cache.has(note)) return
        try {
          const res = await fetch(SAMPLE_URL(note))
          if (!res.ok) return
          const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer())
          this.cache.set(note, buffer)
        } catch {
          /* missing sample → fallback synth at play time */
        }
      }),
    )
  }

  setVolume(volume: number): void {
    this.master.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.05)
  }

  /** Play one string note at `atTime`, sounding for ~`durationS` then releasing. */
  playNote(midi: number, atTime: number, durationS: number, velocity: number): void {
    if (this.disposed) return
    const start = Math.max(this.ctx.currentTime + 0.001, atTime)
    const nearest = nearestSample(midi)
    const buffer = this.cache.get(nearest.note)
    if (!buffer) {
      this.playFallback(midi, start, durationS, velocity)
      return
    }

    const peak = Math.max(0.0002, Math.min(1, velocity / 127) * 0.9)
    const attack = 0.03
    const release = 0.28
    const holdEnd = start + Math.max(attack, durationS)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = Math.pow(2, (midi - nearest.midiNote) / 12) * (this.concertPitchHz / 440)
    // Loop the sustain if the note outlasts the sample.
    if (buffer.duration / source.playbackRate.value < durationS + release) {
      source.loop = true
      source.loopStart = STRINGS_ATTACK_S
      source.loopEnd = buffer.duration
    }

    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(peak, start + attack)
    env.gain.setValueAtTime(peak, holdEnd)
    env.gain.exponentialRampToValueAtTime(0.0001, holdEnd + release)

    source.connect(env)
    env.connect(this.master)
    source.start(start)
    source.stop(holdEnd + release + 0.05)
  }

  private playFallback(midi: number, start: number, durationS: number, velocity: number): void {
    const freq = this.concertPitchHz * Math.pow(2, (midi - 69) / 12)
    const peak = Math.max(0.0002, Math.min(1, velocity / 127) * 0.5)
    const attack = 0.05
    const release = 0.3
    const holdEnd = start + Math.max(attack, durationS)

    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2000
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(peak, start + attack)
    env.gain.setValueAtTime(peak, holdEnd)
    env.gain.exponentialRampToValueAtTime(0.0001, holdEnd + release)

    osc.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    osc.start(start)
    osc.stop(holdEnd + release + 0.05)
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
