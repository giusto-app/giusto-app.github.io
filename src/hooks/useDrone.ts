import { useCallback, useRef, useState } from 'react'

// Drone note: a pitch class (0=C … 11=B) plus an octave.
// Frequency = concertPitchHz × 2^((midiNote - 69) / 12)
// where midiNote = pitchClass + (octave + 1) * 12
function pitchClassOctaveToFreq(pitchClass: number, octave: number, concertPitchHz: number): number {
  const midiNote = pitchClass + (octave + 1) * 12
  return concertPitchHz * Math.pow(2, (midiNote - 69) / 12)
}

export type DroneInterval = 'unison' | 'octave' | 'fifth'
export type DroneSoundType = 'sawtooth' | 'shruti' | 'cello'

export interface DroneState {
  active: boolean
  pitchClass: number      // 0–11, 0=C
  interval: DroneInterval
  volume: number          // 0–1
  octaveOffset: number    // -2..+2, applied on top of base octave 4
  soundType: DroneSoundType
}

// ---------------------------------------------------------------------------
// Shruti Box synthesis
//
// Key findings from research:
// - Three symmetric reeds per pitch, ±10 cents — symmetric detuning blends
//   into warmth; asymmetric wide detuning sounds like competing notes
// - Chorus (slow delay modulation, 0.8 Hz) is the secret sauce that makes
//   the three voices blend into one warm instrument
// - Shimmer tremolo at 6 Hz / 12% depth = the characteristic harmonium shimmer
// - createPeriodicWave with both odd+even harmonics (free reed waveform)
// - Tiny inharmonic partial at 6.27× gives the slight "reedy" character
// ---------------------------------------------------------------------------

// Reed waveform: both odd and even harmonics (free reed physics)
// Indices 0..N correspond to DC, 1f, 2f, 3f...
const SHRUTI_IMAG_TEMPLATE = [
  0,     // DC
  1.00,  // 1st harmonic
  0.60,  // 2nd — strong even harmonics (free reed asymmetric waveform)
  0.35,  // 3rd
  0.20,  // 4th
  0.12,  // 5th
  0.08,  // 6th
]
// The inharmonic partial at 6.27× is added as a separate sine oscillator

// Three symmetric reed voices (center + sharp + flat)
const SHRUTI_DETUNE = [0, +10, -10] as const   // cents — symmetric, not too wide

// Tremolo: the characteristic harmonium shimmer
const SHRUTI_TREMOLO_RATE  = 6.0   // Hz
const SHRUTI_TREMOLO_DEPTH = 0.12  // ±12% amplitude

// Chorus: slow delay LFO that makes voices blend into warmth, not clash
const SHRUTI_CHORUS_RATE      = 0.8    // Hz
const SHRUTI_CHORUS_BASE_MS   = 8.0   // ms base delay
const SHRUTI_CHORUS_DEPTH_MS  = 4.0   // ±ms modulation depth

// ---------------------------------------------------------------------------
// Cello sample engine
//
// Uses VSCO2 Community Edition (CC0) — 8 cello section sustain samples
// spaced ~3 semitones apart. For any target pitch we pick the nearest
// sample and adjust playbackRate to fine-tune to the exact frequency.
// Max shift is ≤2 semitones in any direction — near-transparent quality.
// ---------------------------------------------------------------------------

// MIDI note numbers for each bundled sample — ordered low to high
// Source: VSCO2 Community Edition (CC0), cello section vibrato sustain, forte layer
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

// Module-level cache: url → decoded AudioBuffer (survives re-renders)
const cellosampleCache = new Map<string, AudioBuffer>()

async function fetchCelloSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  if (cellosampleCache.has(url)) return cellosampleCache.get(url)!
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  cellosampleCache.set(url, audioBuffer)
  return audioBuffer
}

function nearestCelloSample(targetMidi: number): { midiNote: number; url: string } {
  return CELLO_SAMPLES.reduce((best, s) =>
    Math.abs(s.midiNote - targetMidi) < Math.abs(best.midiNote - targetMidi) ? s : best
  )
}

// ---------------------------------------------------------------------------

export function useDrone() {
  const [state, setState] = useState<DroneState>({
    active: false,
    pitchClass: 9,         // A (matches default concert pitch reference)
    interval: 'unison',
    volume: 0.35,
    octaveOffset: 0,
    soundType: 'sawtooth',
  })

  const audioCtxRef    = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainRef        = useRef<GainNode | null>(null)

  // -------------------------------------------------------------------------
  // Stop
  // -------------------------------------------------------------------------
  const stopOscillators = useCallback(() => {
    oscillatorsRef.current.forEach(osc => {
      try { osc.stop(); osc.disconnect() } catch { /* already stopped */ }
    })
    oscillatorsRef.current = []
    gainRef.current?.disconnect()
    gainRef.current = null
  }, [])

  // -------------------------------------------------------------------------
  // Start — sawtooth mode (simple continuous drone)
  // -------------------------------------------------------------------------
  function startSawtooth(
    ctx: AudioContext,
    masterGain: GainNode,
    pitchClass: number,
    interval: DroneInterval,
    octaveOffset: number,
    concertPitchHz: number,
  ) {
    const rootOctave = 4 + octaveOffset
    const pitches: { pitchClass: number; octave: number; relVol: number }[] = [
      { pitchClass, octave: rootOctave, relVol: 1.0 },
    ]

    if (interval === 'octave') {
      pitches.push({ pitchClass, octave: rootOctave + 1, relVol: 0.6 })
    } else if (interval === 'fifth') {
      const fifthPitchClass = (pitchClass + 7) % 12
      const fifthOctave = pitchClass + 7 >= 12 ? rootOctave + 1 : rootOctave
      pitches.push({ pitchClass: fifthPitchClass, octave: fifthOctave, relVol: 0.7 })
    }

    oscillatorsRef.current = pitches.map(({ pitchClass: pc, octave, relVol }) => {
      const freq = pitchClassOctaveToFreq(pc, octave, concertPitchHz)

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
      noteGain.connect(masterGain)
      osc.start()
      return osc
    })
  }

  // -------------------------------------------------------------------------
  // Start — shruti box mode
  // -------------------------------------------------------------------------
  function startShruti(
    ctx: AudioContext,
    masterGain: GainNode,
    pitchClass: number,
    octaveOffset: number,
    concertPitchHz: number,
  ) {
    const rootOctave = 4 + octaveOffset
    const freq = pitchClassOctaveToFreq(pitchClass, rootOctave, concertPitchHz)

    // Build the free-reed periodic waveform (both odd+even harmonics)
    const imag = new Float32Array(SHRUTI_IMAG_TEMPLATE.length)
    SHRUTI_IMAG_TEMPLATE.forEach((amp, i) => { imag[i] = amp })
    const real = new Float32Array(SHRUTI_IMAG_TEMPLATE.length)   // all zeros, same length
    const reedWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false })

    // ── Tremolo LFO (6 Hz shimmer — the characteristic harmonium wavering) ──
    const tremoloLFO = ctx.createOscillator()
    tremoloLFO.type = 'sine'
    tremoloLFO.frequency.value = SHRUTI_TREMOLO_RATE
    const tremoloGain = ctx.createGain()
    tremoloGain.gain.value = SHRUTI_TREMOLO_DEPTH
    tremoloLFO.connect(tremoloGain)
    tremoloGain.connect(masterGain.gain)
    tremoloLFO.start()
    oscillatorsRef.current.push(tremoloLFO as unknown as OscillatorNode)

    // ── Filter chain: warmth EQ → reed formant → gentle lowpass → master ──
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 5000     // open enough to not muffle; wood cuts ultrasonics
    lowpass.Q.value = 0.5
    lowpass.connect(masterGain)

    const reedFormant = ctx.createBiquadFilter()
    reedFormant.type = 'peaking'
    reedFormant.frequency.value = 900  // nasal reed resonance
    reedFormant.gain.value = 4         // +4 dB
    reedFormant.Q.value = 2.0
    reedFormant.connect(lowpass)

    const warmth = ctx.createBiquadFilter()
    warmth.type = 'peaking'
    warmth.frequency.value = 400       // warmth/sweetness region
    warmth.gain.value = 3              // +3 dB
    warmth.Q.value = 1.0
    warmth.connect(reedFormant)

    // ── Chorus: DelayNode + slow LFO — blends the three voices into warmth ──
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
    oscillatorsRef.current.push(chorusLFO as unknown as OscillatorNode)

    // ── Sub-octave reed (bass drone pipe) ──
    const subOsc = ctx.createOscillator()
    subOsc.setPeriodicWave(reedWave)
    subOsc.frequency.value = freq / 2
    subOsc.detune.value = -5           // bass reeds drift slightly flat
    const subGain = ctx.createGain()
    subGain.gain.value = 0.20
    subOsc.connect(subGain)
    subGain.connect(warmth)            // bypasses chorus (bass stays solid)
    subOsc.start()
    oscillatorsRef.current.push(subOsc)

    // ── Inharmonic partial at 6.27× (gives the slight "reedy" character) ──
    const inharmonic = ctx.createOscillator()
    inharmonic.type = 'sine'
    inharmonic.frequency.value = freq * 6.27
    const inharmonicGain = ctx.createGain()
    inharmonicGain.gain.value = 0.04   // very subtle — just a hint of reed buzz
    inharmonic.connect(inharmonicGain)
    inharmonicGain.connect(reedFormant)
    inharmonic.start()
    oscillatorsRef.current.push(inharmonic)

    // ── Three symmetric reed oscillators (0, +10, -10 cents) ──
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
      oscillatorsRef.current.push(osc)
    })
  }

  // -------------------------------------------------------------------------
  // Start — cello sample mode
  // -------------------------------------------------------------------------
  async function startCello(
    ctx: AudioContext,
    masterGain: GainNode,
    pitchClass: number,
    octaveOffset: number,
    concertPitchHz: number,
  ) {
    const rootOctave = 4 + octaveOffset
    const targetMidi = pitchClass + (rootOctave + 1) * 12

    const nearest = nearestCelloSample(targetMidi)
    const semitoneShift = targetMidi - nearest.midiNote
    // playbackRate: shift by semitones relative to recorded pitch,
    // then fine-tune for concert pitch deviation from A440
    const playbackRate = Math.pow(2, semitoneShift / 12) * (concertPitchHz / 440)

    try {
      const buffer = await fetchCelloSample(ctx, nearest.url)
      // Check we're still supposed to be playing (user may have stopped while loading)
      if (!gainRef.current) return

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = playbackRate
      source.loop = true
      // Loop the sustain portion — skip the first 200ms (bow attack) for tighter loops
      source.loopStart = 0.2
      source.loopEnd = buffer.duration

      source.connect(masterGain)
      source.start()
      // Cast as OscillatorNode so it fits the existing ref type; stop() works the same
      oscillatorsRef.current.push(source as unknown as OscillatorNode)
    } catch (err) {
      console.warn('Cello sample load failed, falling back to sawtooth', err)
      startSawtooth(ctx, masterGain, pitchClass, 'unison', octaveOffset, concertPitchHz)
    }
  }

  // -------------------------------------------------------------------------
  // Unified start dispatcher
  // -------------------------------------------------------------------------
  const startOscillators = useCallback((
    pitchClass: number,
    interval: DroneInterval,
    volume: number,
    concertPitchHz: number,
    octaveOffset: number,
    soundType: DroneSoundType,
  ) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current

    const masterGain = ctx.createGain()
    if (soundType === 'shruti') {
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime)
      masterGain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.15)
    } else {
      masterGain.gain.setValueAtTime(0, ctx.currentTime)
      masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05)
    }
    masterGain.connect(ctx.destination)
    gainRef.current = masterGain

    if (soundType === 'cello') {
      startCello(ctx, masterGain, pitchClass, octaveOffset, concertPitchHz)
    } else if (soundType === 'shruti') {
      startShruti(ctx, masterGain, pitchClass, octaveOffset, concertPitchHz)
    } else {
      startSawtooth(ctx, masterGain, pitchClass, interval, octaveOffset, concertPitchHz)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Public callbacks
  // -------------------------------------------------------------------------
  const toggle = useCallback((concertPitchHz = 440) => {
    setState(prev => {
      if (prev.active) {
        if (gainRef.current && audioCtxRef.current) {
          gainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.08)
          setTimeout(stopOscillators, 100)
        } else {
          stopOscillators()
        }
        return { ...prev, active: false }
      } else {
        stopOscillators()
        startOscillators(prev.pitchClass, prev.interval, prev.volume, concertPitchHz, prev.octaveOffset, prev.soundType)
        return { ...prev, active: true }
      }
    })
  }, [stopOscillators, startOscillators])

  const setPitchClass = useCallback((pitchClass: number, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, pitchClass }
      if (prev.active) {
        stopOscillators()
        startOscillators(pitchClass, prev.interval, prev.volume, concertPitchHz, prev.octaveOffset, prev.soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const setInterval = useCallback((interval: DroneInterval, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, interval }
      if (prev.active) {
        stopOscillators()
        startOscillators(prev.pitchClass, interval, prev.volume, concertPitchHz, prev.octaveOffset, prev.soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const setVolume = useCallback((volume: number) => {
    setState(prev => {
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.linearRampToValueAtTime(volume, audioCtxRef.current.currentTime + 0.05)
      }
      return { ...prev, volume }
    })
  }, [])

  const shiftOctave = useCallback((delta: number, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, octaveOffset: Math.max(-2, Math.min(2, prev.octaveOffset + delta)) }
      if (prev.active) {
        stopOscillators()
        startOscillators(next.pitchClass, next.interval, next.volume, concertPitchHz, next.octaveOffset, next.soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const setSoundType = useCallback((soundType: DroneSoundType, concertPitchHz = 440) => {
    setState(prev => {
      // Cello samples are recorded in octave 2–5 range; snap to octave 2 when switching to cello
      const octaveOffset = soundType === 'cello' ? -2 : prev.octaveOffset
      const next = { ...prev, soundType, octaveOffset }
      if (prev.active) {
        stopOscillators()
        startOscillators(next.pitchClass, next.interval, next.volume, concertPitchHz, next.octaveOffset, soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const stop = useCallback(() => {
    stopOscillators()
    setState(prev => ({ ...prev, active: false }))
  }, [stopOscillators])

  return { droneState: state, toggle, setPitchClass, setInterval, setVolume, shiftOctave, setSoundType, stop }
}
