import { useCallback, useRef, useState } from 'react'
import { getAudioContext } from '../audio/audioContext'
import {
  pitchClassOctaveToFreq,
  startCelloVoice,
  startSawtoothVoices,
  startShrutiVoice,
  startTanpuraVoice,
  stopDroneSources,
  type DroneSource,
  type SawtoothPitch,
} from '../audio/droneVoices'

// Drone note: a pitch class (0=C … 11=B) plus an octave.
// Frequency math lives in audio/droneVoices.ts (pitchClassOctaveToFreq).
//
// Synthesis recipes (sawtooth / shruti / cello / tanpura) are shared with the
// chord-following drone — see src/audio/droneVoices.ts and
// DRONE-AUDIO-RESEARCH.md for the research notes behind each voice.

export type DroneIntervalName = 'fifth' | 'octave'
/** Independent add-on toggles above the root — both can be on at once. */
export interface DroneIntervals { fifth: boolean; octave: boolean }
export type DroneSoundType = 'sawtooth' | 'shruti' | 'cello' | 'tanpura'

export interface DroneState {
  active: boolean
  pitchClass: number      // 0–11, 0=C
  intervals: DroneIntervals // sounded by the synth voice only
  volume: number          // 0–1
  octaveOffset: number    // -2..+2, applied on top of base octave 4
  soundType: DroneSoundType
}

export { pitchClassOctaveToFreq }

export function useDrone() {
  const [state, setState] = useState<DroneState>({
    active: false,
    pitchClass: 9,         // A (matches default concert pitch reference)
    intervals: { fifth: true, octave: true },
    volume: 0.35,
    octaveOffset: -2,      // octave 2
    soundType: 'sawtooth',
  })

  const sourcesRef = useRef<DroneSource[]>([])
  const gainRef    = useRef<GainNode | null>(null)

  // -------------------------------------------------------------------------
  // Stop
  // -------------------------------------------------------------------------
  const stopOscillators = useCallback(() => {
    stopDroneSources(sourcesRef.current)
    sourcesRef.current = []
    gainRef.current?.disconnect()
    gainRef.current = null
  }, [])

  // -------------------------------------------------------------------------
  // Unified start dispatcher
  // -------------------------------------------------------------------------
  const startOscillators = useCallback((
    pitchClass: number,
    intervals: DroneIntervals,
    volume: number,
    concertPitchHz: number,
    octaveOffset: number,
    soundType: DroneSoundType,
  ) => {
    // Shared app-wide context (drone + metronome + chord drone use one clock).
    const ctx = getAudioContext()

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

    // Async sample voices may resolve after the user hit stop; only attach
    // when this masterGain is still the live one.
    const isCancelled = () => gainRef.current !== masterGain

    if (soundType === 'cello') {
      void startCelloVoice(ctx, masterGain, pitchClass, octaveOffset, concertPitchHz, isCancelled)
        .then(sources => { sourcesRef.current.push(...sources) })
    } else if (soundType === 'tanpura') {
      void startTanpuraVoice(ctx, masterGain, pitchClass, isCancelled)
        .then(sources => { sourcesRef.current.push(...sources) })
    } else if (soundType === 'shruti') {
      sourcesRef.current.push(...startShrutiVoice(ctx, masterGain, pitchClass, octaveOffset, concertPitchHz))
    } else {
      const rootOctave = 4 + octaveOffset
      const pitches: SawtoothPitch[] = [{ pitchClass, octave: rootOctave, relVol: 1.0 }]
      if (intervals.fifth) {
        const fifthPitchClass = (pitchClass + 7) % 12
        const fifthOctave = pitchClass + 7 >= 12 ? rootOctave + 1 : rootOctave
        pitches.push({ pitchClass: fifthPitchClass, octave: fifthOctave, relVol: 0.7 })
      }
      if (intervals.octave) {
        pitches.push({ pitchClass, octave: rootOctave + 1, relVol: 0.6 })
      }
      sourcesRef.current.push(...startSawtoothVoices(ctx, masterGain, pitches, concertPitchHz))
    }
  }, [])

  // -------------------------------------------------------------------------
  // Public callbacks
  // -------------------------------------------------------------------------
  const toggle = useCallback((concertPitchHz = 440) => {
    setState(prev => {
      if (prev.active) {
        if (gainRef.current) {
          gainRef.current.gain.linearRampToValueAtTime(0, getAudioContext().currentTime + 0.08)
          setTimeout(stopOscillators, 100)
        } else {
          stopOscillators()
        }
        return { ...prev, active: false }
      } else {
        stopOscillators()
        startOscillators(prev.pitchClass, prev.intervals, prev.volume, concertPitchHz, prev.octaveOffset, prev.soundType)
        return { ...prev, active: true }
      }
    })
  }, [stopOscillators, startOscillators])

  const setPitchClass = useCallback((pitchClass: number, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, pitchClass }
      if (prev.active) {
        stopOscillators()
        startOscillators(pitchClass, prev.intervals, prev.volume, concertPitchHz, prev.octaveOffset, prev.soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const toggleInterval = useCallback((name: DroneIntervalName, concertPitchHz = 440) => {
    setState(prev => {
      const intervals = { ...prev.intervals, [name]: !prev.intervals[name] }
      if (prev.active) {
        stopOscillators()
        startOscillators(prev.pitchClass, intervals, prev.volume, concertPitchHz, prev.octaveOffset, prev.soundType)
      }
      return { ...prev, intervals }
    })
  }, [stopOscillators, startOscillators])

  const setVolume = useCallback((volume: number) => {
    setState(prev => {
      if (gainRef.current) {
        gainRef.current.gain.linearRampToValueAtTime(volume, getAudioContext().currentTime + 0.05)
      }
      return { ...prev, volume }
    })
  }, [])

  const shiftOctave = useCallback((delta: number, concertPitchHz = 440) => {
    setState(prev => {
      const next = { ...prev, octaveOffset: Math.max(-2, Math.min(2, prev.octaveOffset + delta)) }
      if (prev.active) {
        stopOscillators()
        startOscillators(next.pitchClass, next.intervals, next.volume, concertPitchHz, next.octaveOffset, next.soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const setSoundType = useCallback((soundType: DroneSoundType, concertPitchHz = 440) => {
    setState(prev => {
      // The chosen octave carries across sound switches — synth and cello both
      // sound at octave 4 + offset, so the pitch stays put. Tanpura is a fixed
      // octave-3 recording and ignores the offset (its octave buttons are
      // disabled in the UI).
      const next = { ...prev, soundType }
      if (prev.active) {
        stopOscillators()
        startOscillators(next.pitchClass, next.intervals, next.volume, concertPitchHz, next.octaveOffset, soundType)
      }
      return next
    })
  }, [stopOscillators, startOscillators])

  const stop = useCallback(() => {
    stopOscillators()
    setState(prev => ({ ...prev, active: false }))
  }, [stopOscillators])

  return { droneState: state, toggle, setPitchClass, toggleInterval, setVolume, shiftOctave, setSoundType, stop }
}
