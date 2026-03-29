import { useCallback, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { frequencyToNote, type NoteInfo } from '../utils/noteUtils'
import { groupSamplesIntoNoteEvents, type PitchSample } from '../utils/noteGrouping'
import { buildSession, type PracticeSession } from '../utils/sessions'
import type { TemperamentKey } from '../utils/temperaments'
import type { ScaleKey } from '../utils/scaleDefinitions'

export type RecorderState = 'idle' | 'pre-countdown' | 'recording' | 'done'

// 0 means "free" — record until the user taps Stop
export type SessionDuration = 10 | 30 | 60 | 0

const PRE_COUNTDOWN_SECS = 3

export function useSessionRecorder() {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [preCountdown, setPreCountdown] = useState(PRE_COUNTDOWN_SECS)
  const [countdown, setCountdown] = useState(10)
  const [liveNote, setLiveNote] = useState<NoteInfo | null>(null)
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const samplesRef = useRef<PitchSample[]>([])
  const startTimeRef = useRef(0)
  const lastCountdownRef = useRef(10)
  const lastPreCountdownRef = useRef(PRE_COUNTDOWN_SECS)
  const inRecordingPhaseRef = useRef(false)
  // Store session params so stopRecording() can finish free-mode sessions
  const scaleKeyRef = useRef<ScaleKey>('d-major')
  const temperamentKeyRef = useRef<TemperamentKey>('equal')
  const durationSecsRef = useRef<SessionDuration>(10)

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

  // Stop a free-mode session and build results
  const stopRecording = useCallback(() => {
    if (!inRecordingPhaseRef.current) return
    const preDurationMs = PRE_COUNTDOWN_SECS * 1000
    const recordElapsed = performance.now() - startTimeRef.current - preDurationMs
    cleanup()
    const notes = groupSamplesIntoNoteEvents(samplesRef.current)
    const built = buildSession(
      notes,
      scaleKeyRef.current,
      temperamentKeyRef.current,
      Math.max(1000, recordElapsed),
    )
    setSession(built)
    setLiveNote(null)
    setRecorderState('done')
  }, [cleanup])

  const startRecording = useCallback(async (
    scaleKey: ScaleKey,
    temperamentKey: TemperamentKey,
    temperamentOffsets: readonly number[],
    durationSecs: SessionDuration = 10,
    concertPitchHz = 440,
  ) => {
    // Store params for free-mode stop
    scaleKeyRef.current = scaleKey
    temperamentKeyRef.current = temperamentKey
    durationSecsRef.current = durationSecs

    setErrorMessage(null)
    setSession(null)
    setLiveNote(null)
    samplesRef.current = []
    lastPreCountdownRef.current = PRE_COUNTDOWN_SECS
    inRecordingPhaseRef.current = false
    setPreCountdown(PRE_COUNTDOWN_SECS)
    setRecorderState('pre-countdown')

    const initialCountdown = durationSecs > 0 ? durationSecs : 0
    lastCountdownRef.current = initialCountdown
    setCountdown(initialCountdown)

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
      const recordDurationMs = durationSecs > 0 ? durationSecs * 1000 : Infinity

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

        // Update countdown display (fixed durations only)
        if (durationSecs > 0) {
          const newCountdown = Math.max(0, Math.ceil((recordDurationMs - recordElapsed) / 1000))
          if (newCountdown !== lastCountdownRef.current) {
            lastCountdownRef.current = newCountdown
            setCountdown(newCountdown)
          }
        }

        // Auto-stop when fixed recording time is up
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
          const noteInfo = frequencyToNote(frequency, temperamentOffsets, concertPitchHz)
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
    setCountdown(durationSecsRef.current > 0 ? durationSecsRef.current : 0)
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
    stopRecording,
    reset,
    cleanup,
  }
}
