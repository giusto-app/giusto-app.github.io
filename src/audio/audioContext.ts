// Shared AudioContext singleton.
//
// Browsers limit the number of AudioContexts and each context has its own
// clock, so every sound source in the app (drone, metronome, chord drone)
// must share this one — otherwise scheduled events can drift apart.
//
// The context starts suspended until a user gesture; call `resumeAudioContext()`
// from inside a click/tap handler before scheduling anything.
//
// Sound sources connect to `getOutputNode()`, never to `ctx.destination`
// directly: that master bus carries the analyser the audibility monitor taps
// (src/audio/audibility.ts). A source wired straight to `destination` is
// audible but invisible to the "you won't hear this" banner.

import { configureAudioSession } from './audioSession'

// ~186 ms of history at 44.1 kHz — longer than the monitor's poll interval, so
// consecutive reads overlap and a short metronome click cannot slip between two
// samples and read as silence.
const MONITOR_FFT_SIZE = 8192

let ctx: AudioContext | null = null
let output: GainNode | null = null
let outputAnalyser: AnalyserNode | null = null

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
    output = null
    outputAnalyser = null
    // Opt out of the iOS ringer switch as early as the context exists.
    configureAudioSession()
  }
  return ctx
}

/** The live context, or null when nothing has made sound yet. */
export function peekAudioContext(): AudioContext | null {
  return ctx && ctx.state !== 'closed' ? ctx : null
}

/** Master bus. Every audible node connects here instead of ctx.destination. */
export function getOutputNode(): GainNode {
  const c = getAudioContext()
  if (!output) {
    output = c.createGain()
    outputAnalyser = c.createAnalyser()
    outputAnalyser.fftSize = MONITOR_FFT_SIZE
    output.connect(outputAnalyser)
    outputAnalyser.connect(c.destination)
  }
  return output
}

/**
 * Analyser sitting on the master bus, after every app-side gain and before the
 * device. It sees what Giusto sends the operating system — not what the
 * speaker actually produces, which no browser API exposes.
 */
export function getOutputAnalyser(): AnalyserNode {
  getOutputNode()
  return outputAnalyser as AnalyserNode
}

export async function resumeAudioContext(): Promise<AudioContext> {
  const c = getAudioContext()
  configureAudioSession()
  // Safari parks the context in 'interrupted' after a phone call; resume()
  // is what brings it back, same as from 'suspended'.
  if (c.state !== 'running') {
    await c.resume()
  }
  return c
}
