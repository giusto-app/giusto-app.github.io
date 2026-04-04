import { useCallback, useRef, useState } from 'react'
import { analyzeBuffer, type DetectedNote } from '../utils/audioAnalysis'

export type MeasureRecorderState = 'idle' | 'recording' | 'analyzing' | 'done' | 'error'

export interface MeasureRecorderResult {
  recorderState: MeasureRecorderState
  startRecording: () => Promise<void>
  stopRecording: () => void
  detectedNotes: DetectedNote[]
  errorMessage: string | null
  reset: () => void
}

function chooseMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/webm',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function useMeasureRecorder(): MeasureRecorderResult {
  const [recorderState, setRecorderState] = useState<MeasureRecorderState>('idle')
  const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const cleanup = useCallback(() => {
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    chunksRef.current = []
  }, [])

  const startRecording = useCallback(async () => {
    try {
      setErrorMessage(null)
      setDetectedNotes([])
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream

      const mimeType = chooseMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        cleanup()
        setRecorderState('analyzing')
        try {
          const arrayBuffer = await blob.arrayBuffer()
          const audioCtx = new AudioContext()
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
          await audioCtx.close()
          const notes = analyzeBuffer(audioBuffer)
          setDetectedNotes(notes)
          setRecorderState('done')
        } catch (err) {
          setErrorMessage('Could not analyze recording: ' + String(err))
          setRecorderState('error')
        }
      }

      recorder.start()
      setRecorderState('recording')
    } catch (err) {
      cleanup()
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow access and try again.'
          : 'Could not access microphone. Check your device settings.'
      setErrorMessage(msg)
      setRecorderState('error')
    }
  }, [cleanup])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
    setRecorderState('idle')
    setDetectedNotes([])
    setErrorMessage(null)
  }, [cleanup])

  return { recorderState, startRecording, stopRecording, detectedNotes, errorMessage, reset }
}
