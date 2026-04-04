// Offline pitch analysis: runs pitchy across a decoded AudioBuffer to extract
// a sequence of detected notes. No real-time constraints — analyzes the full
// buffer after recording completes.

import { PitchDetector } from 'pitchy'

export interface DetectedNote {
  midiNote: number
  avgFrequency: number
  avgCents: number     // deviation from nearest equal-temperament semitone (±50¢)
  startMs: number
  endMs: number
}

interface PitchFrame {
  frequency: number
  clarity: number
  timeMs: number
}

// Violin practical range: G3 (55) to E6 (88)
const MIDI_MIN = 43 // G3 with some slack
const MIDI_MAX = 92 // E6 with some slack

function freqToMidi(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440))
}

function freqToCents(frequency: number, midiNote: number): number {
  const expectedFreq = 440 * Math.pow(2, (midiNote - 69) / 12)
  return 1200 * Math.log2(frequency / expectedFreq)
}

export function analyzeBuffer(
  audioBuffer: AudioBuffer,
  windowSize = 2048,
  hopSamples = 256,
): DetectedNote[] {
  const sampleRate = audioBuffer.sampleRate
  const channelData = audioBuffer.getChannelData(0) // use first channel

  const detector = PitchDetector.forFloat32Array(windowSize)
  const input = new Float32Array(windowSize)
  const frames: PitchFrame[] = []

  for (let offset = 0; offset + windowSize <= channelData.length; offset += hopSamples) {
    input.set(channelData.subarray(offset, offset + windowSize))
    const [frequency, clarity] = detector.findPitch(input, sampleRate)
    const timeMs = (offset / sampleRate) * 1000
    frames.push({ frequency, clarity, timeMs })
  }

  return segmentNotes(frames, sampleRate, hopSamples)
}

// State machine: SILENCE ↔ NOTE
// SILENCE→NOTE: clarity > 0.85 sustained ≥ 3 frames
// NOTE→SILENCE: clarity < 0.70 for ≥ 7 frames
// NOTE→NOTE: pitch shifts > 1.5 semitones for ≥ 3 frames
function segmentNotes(
  frames: PitchFrame[],
  sampleRate: number,
  hopSamples: number,
): DetectedNote[] {
  const msPerFrame = (hopSamples / sampleRate) * 1000
  const CONFIRM_FRAMES = Math.max(3, Math.round(15 / msPerFrame))   // ~15ms to confirm note start
  const SILENCE_FRAMES = Math.max(7, Math.round(40 / msPerFrame))   // ~40ms silence to end note
  const PITCH_SHIFT_FRAMES = Math.max(3, Math.round(15 / msPerFrame)) // ~15ms to confirm pitch change

  type State = 'silence' | 'note'
  let state: State = 'silence'

  // Counters for state transitions
  let pendingClarityCount = 0
  let pendingPitchShiftCount = 0
  let silenceCount = 0

  // Accumulator for the current note
  let noteStartMs = 0
  let noteFreqSum = 0
  let noteFreqCount = 0
  let runningMidi = 0

  const notes: DetectedNote[] = []

  function commitNote(endMs: number) {
    if (noteFreqCount === 0) return
    const avgFrequency = noteFreqSum / noteFreqCount
    const midiNote = freqToMidi(avgFrequency)
    if (midiNote < MIDI_MIN || midiNote > MIDI_MAX) return
    const avgCents = freqToCents(avgFrequency, midiNote)
    notes.push({ midiNote, avgFrequency, avgCents, startMs: noteStartMs, endMs })
    noteFreqSum = 0
    noteFreqCount = 0
  }

  for (let i = 0; i < frames.length; i++) {
    const { frequency, clarity, timeMs } = frames[i]
    const isVoiced = clarity > 0.85 && frequency > 55 && frequency < 5000
    const currentMidi = isVoiced ? freqToMidi(frequency) : 0

    if (state === 'silence') {
      if (isVoiced) {
        pendingClarityCount++
        if (pendingClarityCount >= CONFIRM_FRAMES) {
          // Transition to NOTE — back-date start to when clarity first appeared
          state = 'note'
          noteStartMs = timeMs - (pendingClarityCount - 1) * msPerFrame
          runningMidi = currentMidi
          silenceCount = 0
          pendingPitchShiftCount = 0
          noteFreqSum = frequency
          noteFreqCount = 1
        }
      } else {
        pendingClarityCount = 0
      }
    } else {
      // state === 'note'
      if (!isVoiced) {
        silenceCount++
        if (silenceCount >= SILENCE_FRAMES) {
          commitNote(timeMs - (silenceCount - 1) * msPerFrame)
          state = 'silence'
          pendingClarityCount = 0
          silenceCount = 0
        }
      } else {
        silenceCount = 0
        // Check for pitch shift > 1.5 semitones
        if (Math.abs(currentMidi - runningMidi) >= 2) {
          pendingPitchShiftCount++
          if (pendingPitchShiftCount >= PITCH_SHIFT_FRAMES) {
            // Commit current note and start new one
            commitNote(timeMs - pendingPitchShiftCount * msPerFrame)
            noteStartMs = timeMs - (pendingPitchShiftCount - 1) * msPerFrame
            runningMidi = currentMidi
            pendingPitchShiftCount = 0
          }
          // Still accumulate during the transition window
          noteFreqSum += frequency
          noteFreqCount++
        } else {
          pendingPitchShiftCount = 0
          runningMidi = currentMidi
          noteFreqSum += frequency
          noteFreqCount++
        }
      }
    }
  }

  // Close any open note
  if (state === 'note' && noteFreqCount > 0) {
    const lastFrame = frames.at(-1)
    commitNote(lastFrame ? lastFrame.timeMs : 0)
  }

  return notes
}
