// Drone voice builders — pure Web Audio graph constructors shared by
// useDrone (manual drone tab) and ChordDrone (chord-following playback).
//
// Each builder wires its nodes into the provided destination gain and returns
// the started source nodes so the caller can stop()/disconnect() them.
// Synthesis recipes are unchanged from the original useDrone implementations
// (shruti research notes live in DRONE-AUDIO-RESEARCH.md).

export type DroneSoundType = 'sawtooth' | 'shruti' | 'cello' | 'tanpura'

/** A started source that can be stopped: OscillatorNode or AudioBufferSourceNode. */
export type DroneSource = AudioScheduledSourceNode

export function pitchClassOctaveToFreq(pitchClass: number, octave: number, concertPitchHz: number): number {
  const midiNote = pitchClass + (octave + 1) * 12
  return concertPitchHz * Math.pow(2, (midiNote - 69) / 12)
}

// ── Shruti box synthesis constants (see DRONE-AUDIO-RESEARCH.md) ────────────
const SHRUTI_IMAG_TEMPLATE = [0, 1.0, 0.6, 0.35, 0.2, 0.12, 0.08]
const SHRUTI_DETUNE = [0, +10, -10] as const
const SHRUTI_TREMOLO_RATE = 6.0
// Relative to the voice's unity tremolo stage. (The recipe originally
// modulated the caller's ~0.35 master gain by an absolute 0.12 — same ±34%.)
const SHRUTI_TREMOLO_DEPTH = 0.34
const SHRUTI_CHORUS_RATE = 0.8
const SHRUTI_CHORUS_BASE_MS = 8.0
const SHRUTI_CHORUS_DEPTH_MS = 4.0

// ── Cello sample set (VSCO2 Community Edition, CC0) ─────────────────────────

/** The sustain samples open with a forte bow attack; loops — and crossfaded
 *  chord changes — start past it. */
const CELLO_ATTACK_S = 0.2
const CELLO_SAMPLES: { midiNote: number; url: string }[] = [
  { midiNote: 36, url: '/sounds/cello/01_C2_forte.wav' },
  { midiNote: 40, url: '/sounds/cello/02_E2_forte.wav' },
  { midiNote: 43, url: '/sounds/cello/03_G2_forte.wav' },
  { midiNote: 47, url: '/sounds/cello/04_B2_forte.wav' },
  { midiNote: 50, url: '/sounds/cello/05_D3_forte.wav' },
  { midiNote: 53, url: '/sounds/cello/06_F3_forte.wav' },
  { midiNote: 57, url: '/sounds/cello/07_A3_forte.wav' },
  { midiNote: 60, url: '/sounds/cello/08_C4_forte.wav' },
  { midiNote: 64, url: '/sounds/cello/09_E4_forte.wav' },
  { midiNote: 67, url: '/sounds/cello/10_G4_forte.wav' },
  { midiNote: 71, url: '/sounds/cello/11_B4_forte.wav' },
  { midiNote: 74, url: '/sounds/cello/12_D5_forte.wav' },
  { midiNote: 77, url: '/sounds/cello/13_F5_forte.wav' },
]

const sampleCache = new Map<string, AudioBuffer>()

async function fetchSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  if (sampleCache.has(url)) return sampleCache.get(url)!
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  sampleCache.set(url, audioBuffer)
  return audioBuffer
}

function nearestCelloSample(targetMidi: number): { midiNote: number; url: string } {
  return CELLO_SAMPLES.reduce((best, s) =>
    Math.abs(s.midiNote - targetMidi) < Math.abs(best.midiNote - targetMidi) ? s : best
  )
}

/**
 * Preload (fetch + decode) the cello samples covering the given MIDI notes.
 * ChordDrone calls this before playback starts so chord changes never wait on
 * a network fetch mid-phrase.
 */
export async function preloadCelloSamples(ctx: AudioContext, midiNotes: number[]): Promise<void> {
  const urls = new Set(midiNotes.map(midi => nearestCelloSample(midi).url))
  await Promise.all([...urls].map(url => fetchSample(ctx, url).catch(() => undefined)))
}

// ── Tanpura sample set (per pitch class, octave 3) ──────────────────────────
const TANPURA_SAMPLES: Record<number, string> = {
  0: '/sounds/tanpura/01_C3.wav',
  1: '/sounds/tanpura/02_Cs3.wav',
  2: '/sounds/tanpura/03_D3.wav',
  3: '/sounds/tanpura/04_Ds3.wav',
  4: '/sounds/tanpura/05_E3.wav',
  5: '/sounds/tanpura/06_F3.wav',
  6: '/sounds/tanpura/07_Fs3.wav',
  7: '/sounds/tanpura/08_G3.wav',
  8: '/sounds/tanpura/09_Gs3.wav',
  9: '/sounds/tanpura/10_A3.wav',
  10: '/sounds/tanpura/11_As3.wav',
  11: '/sounds/tanpura/12_B3.wav',
}

export interface SawtoothPitch {
  pitchClass: number
  octave: number
  relVol: number
}

/** One filtered sawtooth per pitch — the "Synth Pure" drone voice. */
export function startSawtoothVoices(
  ctx: AudioContext,
  destination: AudioNode,
  pitches: SawtoothPitch[],
  concertPitchHz: number,
): DroneSource[] {
  return pitches.map(({ pitchClass, octave, relVol }) => {
    const freq = pitchClassOctaveToFreq(pitchClass, octave, concertPitchHz)

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1200
    filter.Q.value = 0.7

    const noteGain = ctx.createGain()
    noteGain.gain.value = relVol

    osc.connect(filter)
    filter.connect(noteGain)
    noteGain.connect(destination)
    osc.start()
    return osc
  })
}

/**
 * Additive free-reed shruti-box voice ("Synth Wavy").
 * The tremolo LFO modulates a gain stage INSIDE the voice — modulating the
 * caller's gain param would ADD to whatever automation runs on it (crossfades,
 * volume ramps) and leak ±depth of signal through "silent" anchors: an audible
 * pump/click around chord changes and after stop().
 */
export function startShrutiVoice(
  ctx: AudioContext,
  destination: AudioNode,
  pitchClass: number,
  octaveOffset: number,
  concertPitchHz: number,
): DroneSource[] {
  const sources: DroneSource[] = []
  const rootOctave = 4 + octaveOffset
  const freq = pitchClassOctaveToFreq(pitchClass, rootOctave, concertPitchHz)

  const imag = new Float32Array(SHRUTI_IMAG_TEMPLATE.length)
  SHRUTI_IMAG_TEMPLATE.forEach((amp, i) => {
    imag[i] = amp
  })
  const real = new Float32Array(SHRUTI_IMAG_TEMPLATE.length)
  const reedWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false })

  // Tremolo LFO — the characteristic harmonium shimmer (see doc comment).
  const tremolo = ctx.createGain()
  tremolo.gain.value = 1
  tremolo.connect(destination)
  const tremoloLFO = ctx.createOscillator()
  tremoloLFO.type = 'sine'
  tremoloLFO.frequency.value = SHRUTI_TREMOLO_RATE
  const tremoloDepth = ctx.createGain()
  tremoloDepth.gain.value = SHRUTI_TREMOLO_DEPTH
  tremoloLFO.connect(tremoloDepth)
  tremoloDepth.connect(tremolo.gain)
  tremoloLFO.start()
  sources.push(tremoloLFO)

  // Filter chain: warmth EQ → reed formant → gentle lowpass → tremolo stage.
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 5000
  lowpass.Q.value = 0.5
  lowpass.connect(tremolo)

  const reedFormant = ctx.createBiquadFilter()
  reedFormant.type = 'peaking'
  reedFormant.frequency.value = 900
  reedFormant.gain.value = 4
  reedFormant.Q.value = 2.0
  reedFormant.connect(lowpass)

  const warmth = ctx.createBiquadFilter()
  warmth.type = 'peaking'
  warmth.frequency.value = 400
  warmth.gain.value = 3
  warmth.Q.value = 1.0
  warmth.connect(reedFormant)

  // Chorus: DelayNode + slow LFO — blends the three reeds into warmth.
  const chorusDelay = ctx.createDelay(0.03)
  chorusDelay.delayTime.value = SHRUTI_CHORUS_BASE_MS / 1000
  chorusDelay.connect(warmth)

  const chorusLFO = ctx.createOscillator()
  chorusLFO.type = 'sine'
  chorusLFO.frequency.value = SHRUTI_CHORUS_RATE
  const chorusLFOGain = ctx.createGain()
  chorusLFOGain.gain.value = SHRUTI_CHORUS_DEPTH_MS / 1000
  chorusLFO.connect(chorusLFOGain)
  chorusLFOGain.connect(chorusDelay.delayTime)
  chorusLFO.start()
  sources.push(chorusLFO)

  // Sub-octave reed (bass drone pipe) — bypasses chorus so the bass stays solid.
  const subOsc = ctx.createOscillator()
  subOsc.setPeriodicWave(reedWave)
  subOsc.frequency.value = freq / 2
  subOsc.detune.value = -5
  const subGain = ctx.createGain()
  subGain.gain.value = 0.2
  subOsc.connect(subGain)
  subGain.connect(warmth)
  subOsc.start()
  sources.push(subOsc)

  // Inharmonic partial at 6.27× — a hint of reed buzz.
  const inharmonic = ctx.createOscillator()
  inharmonic.type = 'sine'
  inharmonic.frequency.value = freq * 6.27
  const inharmonicGain = ctx.createGain()
  inharmonicGain.gain.value = 0.04
  inharmonic.connect(inharmonicGain)
  inharmonicGain.connect(reedFormant)
  inharmonic.start()
  sources.push(inharmonic)

  // Three symmetric reed oscillators (0, +10, −10 cents).
  SHRUTI_DETUNE.forEach(detune => {
    const osc = ctx.createOscillator()
    osc.setPeriodicWave(reedWave)
    osc.frequency.value = freq
    osc.detune.value = detune

    const voiceGain = ctx.createGain()
    voiceGain.gain.value = 1 / SHRUTI_DETUNE.length

    osc.connect(voiceGain)
    voiceGain.connect(chorusDelay)
    osc.start()
    sources.push(osc)
  })

  return sources
}

/**
 * Looped cello sustain sample, pitch-shifted to the target note.
 * Async (sample fetch); `isCancelled` guards against starting after a stop.
 * Falls back to a sawtooth voice if the sample fails to load.
 */
export async function startCelloVoice(
  ctx: AudioContext,
  destination: AudioNode,
  pitchClass: number,
  octaveOffset: number,
  concertPitchHz: number,
  isCancelled: () => boolean,
): Promise<DroneSource[]> {
  const rootOctave = 4 + octaveOffset
  const targetMidi = pitchClass + (rootOctave + 1) * 12

  const nearest = nearestCelloSample(targetMidi)
  const semitoneShift = targetMidi - nearest.midiNote
  const playbackRate = Math.pow(2, semitoneShift / 12) * (concertPitchHz / 440)

  try {
    const buffer = await fetchSample(ctx, nearest.url)
    if (isCancelled()) return []

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = playbackRate
    source.loop = true
    // Loop past the bow attack for tighter loops (the attack itself still
    // plays once — natural for a manually started drone).
    source.loopStart = CELLO_ATTACK_S
    source.loopEnd = buffer.duration
    source.connect(destination)
    source.start()
    return [source]
  } catch (err) {
    console.warn('Cello sample load failed, falling back to sawtooth', err)
    if (isCancelled()) return []
    return startSawtoothVoices(
      ctx,
      destination,
      [{ pitchClass, octave: rootOctave, relVol: 1.0 }],
      concertPitchHz,
    )
  }
}

/**
 * Build a looping cello voice synchronously from an already-decoded sample
 * (see preloadCelloSamples). Returns null when the sample isn't cached yet —
 * the caller decides its own fallback.
 *
 * Playback begins at `offsetS` into the sample — past the bow attack by
 * default, so a crossfaded chord change never re-articulates the bow.
 */
export function startCelloVoiceFromCache(
  ctx: AudioContext,
  destination: AudioNode,
  targetMidi: number,
  concertPitchHz: number,
  startAt?: number,
  offsetS: number = CELLO_ATTACK_S,
): DroneSource[] | null {
  const nearest = nearestCelloSample(targetMidi)
  const buffer = sampleCache.get(nearest.url)
  if (!buffer) return null

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = Math.pow(2, (targetMidi - nearest.midiNote) / 12) * (concertPitchHz / 440)
  source.loop = true
  source.loopStart = CELLO_ATTACK_S
  source.loopEnd = buffer.duration
  source.connect(destination)
  source.start(startAt ?? ctx.currentTime, offsetS)
  return [source]
}

/**
 * Looped tanpura recording for the pitch class (octave fixed by the recording).
 * Falls back to a sawtooth voice if the sample fails to load.
 */
export async function startTanpuraVoice(
  ctx: AudioContext,
  destination: AudioNode,
  pitchClass: number,
  isCancelled: () => boolean,
): Promise<DroneSource[]> {
  const url = TANPURA_SAMPLES[pitchClass]
  try {
    const buffer = await fetchSample(ctx, url)
    if (isCancelled()) return []

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopStart = 0
    source.loopEnd = buffer.duration
    source.connect(destination)
    source.start()
    return [source]
  } catch (err) {
    console.warn('Tanpura sample load failed, falling back to sawtooth', err)
    if (isCancelled()) return []
    return startSawtoothVoices(ctx, destination, [{ pitchClass, octave: 4, relVol: 1.0 }], 440)
  }
}

export function stopDroneSources(sources: DroneSource[]): void {
  sources.forEach(source => {
    try {
      source.stop()
      source.disconnect()
    } catch {
      /* already stopped */
    }
  })
}
