import { useCallback, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { frequencyToNote, type NoteInfo } from '../utils/noteUtils'
import { groupSamplesIntoNoteEvents, type PitchSample } from '../utils/noteGrouping'
import { buildSession, type PracticeSession } from '../utils/sessions'
import type { TemperamentKey } from '../utils/temperaments'
import type { ScaleKey } from '../utils/scaleDefinitions'

export type RecorderState = 'idle' | 'pre-countdown' | 'recording' | 'done'

const PRE_COUNTDOWN_SECS = 3
const RECORDING_SECS = 10

export function useSessionRecorder() {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [preCountdown, setPreCountdown] = useState(PRE_COUNTDOWN_SECS)
  const [countdown, setCountdown] = useState(RECORDING_SECS)
  const [liveNote, setLiveNote] = useState<NoteInfo | null>(null)
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const samplesRef = useRef<PitchSample[]>([])
  const startTimeRef = useRef(0)
  const lastCountdownRef = useRef(RECORDING_SECS)
  const lastPreCountdownRef = useRef(PRE_COUNTDOWN_SECS)
  const inRecordingPhaseRef = useRef(false)

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
  }, [])

  const startRecording = useCallback(async (
    scaleKey: ScaleKey,
    temperamentKey: TemperamentKey,
    temperamentOffsets: readonly number[],
  ) => {
    setErrorMessage(null)
    setSession(null)
    setLiveNote(null)
    samplesRef.current = []
    lastCountdownRef.current = RECORDING_SECS
    lastPreCountdownRef.current = PRE_COUNTDOWN_SECS
    inRecordingPhaseRef.current = false
    setCountdown(RECORDING_SECS)
    setPreCountdown(PRE_COUNTDOWN_SECS)
    setRecorderState('pre-countdown')

    try {
      // getUserMedia must be the first await inside a user-gesture handler (iOS Safari)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      await audioCtx.resume()
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)

      const detector = PitchDetector.forFloat32Array(analyser.fftSize)
      const input = new Float32Array(detector.inputLength)

      startTimeRef.current = performance.now()
      const preDurationMs = PRE_COUNTDOWN_SECS * 1000
      const recordDurationMs = RECORDING_SECS * 1000

      const detect = () => {
        const elapsed = performance.now() - startTimeRef.current

        if (elapsed < preDurationMs) {
          // Pre-countdown phase — count 3 → 2 → 1, don't collect samples
          const newPre = Math.max(1, Math.ceil((preDurationMs - elapsed) / 1000))
          if (newPre !== lastPreCountdownRef.current) {
            lastPreCountdownRef.current = newPre
            setPreCountdown(newPre)
          }
          rafRef.current = requestAnimationFrame(detect)
          return
        }

        // Transition to recording phase
        if (!inRecordingPhaseRef.current) {
          inRecordingPhaseRef.current = true
          setRecorderState('recording')
        }

        const recordElapsed = elapsed - preDurationMs

        // Update recording countdown
        const newCountdown = Math.max(0, Math.ceil((recordDurationMs - recordElapsed) / 1000))
        if (newCountdown !== lastCountdownRef.current) {
          lastCountdownRef.current = newCountdown
          setCountdown(newCountdown)
        }

        // Stop when recording time is up
        if (recordElapsed >= recordDurationMs) {
          cleanup()
          const notes = groupSamplesIntoNoteEvents(samplesRef.current)
          const built = buildSession(notes, scaleKey, temperamentKey, recordDurationMs)
          setSession(built)
          setLiveNote(null)
          setRecorderState('done')
          return
        }

        // Detect pitch and collect samples
        analyser.getFloatTimeDomainData(input)
        const [frequency, clarity] = detector.findPitch(input, audioCtx.sampleRate)

        if (clarity > 0.9 && frequency > 60 && frequency < 4200) {
          const noteInfo = frequencyToNote(frequency, temperamentOffsets)
          setLiveNote(noteInfo)

          samplesRef.current.push({
            midiNote: noteInfo.midiNote,
            pitchClass: noteInfo.pitchClass,
            noteName: noteInfo.noteName,
            octave: noteInfo.octave,
            cents: noteInfo.cents,
            timestamp: recordElapsed,
          })
        }

        rafRef.current = requestAnimationFrame(detect)
      }

      rafRef.current = requestAnimationFrame(detect)
    } catch (err) {
      cleanup()
      setRecorderState('idle')
      setErrorMessage(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow access and try again.'
          : 'Could not access microphone. Check your device settings.',
      )
    }
  }, [cleanup])

  const reset = useCallback(() => {
    cleanup()
    setRecorderState('idle')
    setCountdown(RECORDING_SECS)
    setPreCountdown(PRE_COUNTDOWN_SECS)
    setLiveNote(null)
    setSession(null)
    setErrorMessage(null)
    samplesRef.current = []
  }, [cleanup])

  return {
    recorderState,
    preCountdown,
    countdown,
    liveNote,
    session,
    errorMessage,
    startRecording,
    reset,
    cleanup,
  }
}
