import { useCallback, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { frequencyToNote, type NoteInfo, type TuningStatus } from '../utils/noteUtils'
import { TEMPERAMENTS } from '../utils/temperaments'

export type ListeningState = 'idle' | 'listening' | 'error'

export interface PitchDetectionState {
  note: NoteInfo | null
  listeningState: ListeningState
  errorMessage: string | null
}

// Lower alpha = smoother but slower to respond (0.08 is much calmer than 0.25)
const EMA_ALPHA = 0.08

export function usePitchDetection() {
  const [state, setState] = useState<PitchDetectionState>({
    note: null,
    listeningState: 'idle',
    errorMessage: null,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const smoothedCentsRef = useRef<number>(0)
  // Ref so the rAF loop always reads the latest temperament without restarting
  const temperamentOffsetsRef = useRef<readonly number[]>(TEMPERAMENTS.equal.offsets)

  const setTemperament = useCallback((offsets: readonly number[]) => {
    temperamentOffsetsRef.current = offsets
    smoothedCentsRef.current = 0  // reset smoothing on switch
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setState(s => ({ ...s, listeningState: 'idle', note: null }))
  }, [])

  const start = useCallback(async () => {
    try {
      setState({ note: null, listeningState: 'listening', errorMessage: null })

      // Must happen inside user gesture for iOS Safari
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream

      const audioContext = new AudioContext()
      await audioContext.resume()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)

      const detector = PitchDetector.forFloat32Array(analyser.fftSize)
      const input = new Float32Array(detector.inputLength)

      const detect = () => {
        analyser.getFloatTimeDomainData(input)
        const [frequency, clarity] = detector.findPitch(input, audioContext.sampleRate)

        if (clarity > 0.9 && frequency > 60 && frequency < 4200) {
          const raw = frequencyToNote(frequency, temperamentOffsetsRef.current)

          // Smooth the cents value to avoid jittery display
          smoothedCentsRef.current =
            EMA_ALPHA * raw.cents + (1 - EMA_ALPHA) * smoothedCentsRef.current

          // Derive status from smoothed cents so it doesn't flicker with raw noise
          const sc = smoothedCentsRef.current
          const abs = Math.abs(sc)
          const status: TuningStatus = abs <= 10 ? 'in-tune' : abs <= 25 ? 'close' : 'out-of-tune'

          setState(s => ({
            ...s,
            note: { ...raw, cents: sc, status },
          }))
        }

        rafRef.current = requestAnimationFrame(detect)
      }

      rafRef.current = requestAnimationFrame(detect)
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone access and try again.'
          : 'Could not access microphone. Please check your device settings.'
      setState({ note: null, listeningState: 'error', errorMessage: message })
    }
  }, [])

  return { ...state, start, stop, setTemperament }
}
