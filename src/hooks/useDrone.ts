import { useCallback, useRef, useState } from 'react'

// Drone note: a pitch class (0=C … 11=B) plus an octave.
// Frequency = concertPitchHz × 2^((midiNote - 69) / 12)
// where midiNote = pitchClass + (octave + 1) * 12
function pitchClassOctaveToFreq(pitchClass: number, octave: number, concertPitchHz: number): number {
  const midiNote = pitchClass + (octave + 1) * 12
  return concertPitchHz * Math.pow(2, (midiNote - 69) / 12)
}

export type DroneInterval = 'unison' | 'octave' | 'fifth'

export interface DroneState {
  active: boolean
  pitchClass: number    // 0–11, 0=C
  interval: DroneInterval
  volume: number        // 0–1
}

export function useDrone() {
  const [state, setState] = useState<DroneState>({
    active: false,
    pitchClass: 9,       // A (matches default concert pitch reference)
    interval: 'unison',
    volume: 0.35,
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  // Keep refs for each active oscillator so we can tear them down precisely
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainRef = useRef<GainNode | null>(null)

  const stopOscillators = useCallback(() => {
    oscillatorsRef.current.forEach(osc => {
      try { osc.stop(); osc.disconnect() } catch { /* already stopped */ }
    })
    oscillatorsRef.current = []
    gainRef.current?.disconnect()
    gainRef.current = null
  }, [])

  const startOscillators = useCallback((
    pitchClass: number,
    interval: DroneInterval,
    volume: number,
    concertPitchHz: number,
  ) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current

    // Gain node — master volume + soft fade-in to avoid clicks
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05)
    gain.connect(ctx.destination)
    gainRef.current = gain

    // Determine which pitches to play
    const pitches: { pitchClass: number; octave: number; relVol: number }[] = []

    // Root tone — place it in a comfortable central octave (octave 3 or 4)
    const rootOctave = pitchClass <= 4 ? 4 : 3   // C–E → octave 4, F–B → octave 3
    pitches.push({ pitchClass, octave: rootOctave, relVol: 1.0 })

    if (interval === 'octave') {
      pitches.push({ pitchClass, octave: rootOctave + 1, relVol: 0.6 })
    } else if (interval === 'fifth') {
      // Perfect fifth above = +7 semitones
      const fifthPitchClass = (pitchClass + 7) % 12
      const fifthOctave = pitchClass + 7 >= 12 ? rootOctave + 1 : rootOctave
      pitches.push({ pitchClass: fifthPitchClass, octave: fifthOctave, relVol: 0.7 })
    }

    oscillatorsRef.current = pitches.map(({ pitchClass: pc, octave, relVol }) => {
      const freq = pitchClassOctaveToFreq(pc, octave, concertPitchHz)

      // Primary oscillator (sawtooth — rich, string-like)
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq

      // Low-pass filter to soften the sawtooth (remove harsh highs)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1200
      filter.Q.value = 0.7

      // Per-note gain for relative volumes
      const noteGain = ctx.createGain()
      noteGain.gain.value = relVol

      osc.connect(filter)
      filter.connect(noteGain)
      noteGain.connect(gain)
      osc.start()
      return osc
    })
  }, [])

  const toggle = useCallback((concertPitchHz = 440) => {
    setState(prev => {
      if (prev.active) {
        // Fade out then stop
        if (gainRef.current && audioCtxRef.current) {
          gainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.08)
          setTimeout(stopOscillators, 100)
        } else {
          stopOscillators()
        }
        return { ...prev, active: false }
      } else {
        stopOscillators()
        startOscillators(prev.pitchClass, prev.interval, prev.volume, concertPitchHz)
        return { ...prev, active: true }
      }
    })
  }, [stopOscillators, startOscillators])

  const setPitchClass = useCallback((pitchClass: number, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, pitchClass }
      if (prev.active) {
        stopOscillators()
        startOscillators(pitchClass, prev.interval, prev.volume, concertPitchHz)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const setInterval = useCallback((interval: DroneInterval, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, interval }
      if (prev.active) {
        stopOscillators()
        startOscillators(prev.pitchClass, interval, prev.volume, concertPitchHz)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const setVolume = useCallback((volume: number) => {
    setState(prev => {
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.linearRampToValueAtTime(
          volume,
          audioCtxRef.current.currentTime + 0.05,
        )
      }
      return { ...prev, volume }
    })
  }, [])

  const stop = useCallback(() => {
    stopOscillators()
    setState(prev => ({ ...prev, active: false }))
  }, [stopOscillators])

  return { droneState: state, toggle, setPitchClass, setInterval, setVolume, stop }
}
