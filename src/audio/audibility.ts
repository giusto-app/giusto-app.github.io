// "Why can't I hear anything?" — the passive half of the answer.
//
// No browser exposes the system volume, the output device's mute state, or the
// iOS ringer switch to a page, so nothing here can read the hardware slider.
// What it can do is catch every silence the page *can* observe, and say so:
//
//   blocked      the context is suspended — the browser's autoplay policy is
//                holding the sound back until a gesture
//   interrupted  Safari parked the context after a call or another app took
//                over the audio route
//   silent       the app is playing, but the mix leaving the master bus is
//                flat — an app volume slider is at zero, or a backing track
//                never loaded
//
// The remaining case — device volume down or muted — is handled where it can
// be, not detected: audioSession.ts declares the app as media playback so the
// iOS ringer switch stops muting Web Audio in the first place.
//
// A "claim" marks the spans where sound is expected. Without one, silence is
// just silence and nothing is reported.

import { getOutputAnalyser, peekAudioContext } from './audioContext'

export type AudibilityIssue = 'blocked' | 'interrupted' | 'silent'

/** Peak sample amplitude below which the master bus counts as flat (~ -62 dBFS). */
export const SILENCE_FLOOR = 0.0008

/**
 * How long the bus may read flat before we call it silent. Has to outlast the
 * gap between metronome clicks at the slowest tempo the app offers and the
 * lull while a cold sample voice fetches its notes — a false "you won't hear
 * this" is worse than a late one.
 */
export const SILENCE_GRACE_MS = 5000

export interface AudibilitySample {
  /** Is a sound source claiming to be playing right now? */
  expectingSound: boolean
  /** AudioContext.state — 'interrupted' is Safari-only and outside the TS type. */
  contextState: string
  /** Peak absolute sample on the master bus since the previous sample. */
  peak: number
  /** Monotonic-ish wall clock, milliseconds. */
  now: number
}

export interface AudibilityState {
  issue: AudibilityIssue | null
  /** When the bus was last heard above the floor — the silence grace runs from here. */
  lastAudibleAt: number
}

export function initialAudibilityState(now = 0): AudibilityState {
  return { issue: null, lastAudibleAt: now }
}

/**
 * Pure step: previous state + one observation -> next state. Kept separate
 * from the timer and the analyser so the rules are testable without audio.
 */
export function nextAudibilityState(prev: AudibilityState, s: AudibilitySample): AudibilityState {
  // Nothing is meant to be playing: no verdict, and the grace window restarts
  // so the next take is judged on its own silence, not on the quiet before it.
  if (!s.expectingSound || s.contextState === 'closed') {
    return { issue: null, lastAudibleAt: s.now }
  }

  if (s.contextState === 'interrupted') {
    return { issue: 'interrupted', lastAudibleAt: s.now }
  }
  if (s.contextState !== 'running') {
    return { issue: 'blocked', lastAudibleAt: s.now }
  }

  if (s.peak >= SILENCE_FLOOR) {
    return { issue: null, lastAudibleAt: s.now }
  }

  const flatFor = s.now - prev.lastAudibleAt
  return {
    issue: flatFor >= SILENCE_GRACE_MS ? 'silent' : prev.issue === 'silent' ? 'silent' : null,
    lastAudibleAt: prev.lastAudibleAt,
  }
}

// ── Runtime monitor ─────────────────────────────────────────────────────────

type Listener = (issue: AudibilityIssue | null) => void

const POLL_MS = 100

const listeners = new Set<Listener>()
const claims = new Set<string>()

let state = initialAudibilityState(0)
let timer: ReturnType<typeof setInterval> | null = null
let samples: Float32Array | null = null

function emit(issue: AudibilityIssue | null): void {
  for (const listener of listeners) listener(issue)
}

function readPeak(): number {
  const analyser = getOutputAnalyser()
  if (!samples || samples.length !== analyser.fftSize) {
    samples = new Float32Array(analyser.fftSize)
  }
  analyser.getFloatTimeDomainData(samples)
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] < 0 ? -samples[i] : samples[i]
    if (v > peak) peak = v
  }
  return peak
}

function tick(): void {
  const ctx = peekAudioContext()
  const now = Date.now()
  // A hidden tab throttles this timer to ~1 Hz and may suspend the context on
  // its own; measurements there mean nothing, so treat it as "not playing".
  const visible = typeof document === 'undefined' || !document.hidden
  const expectingSound = claims.size > 0 && ctx !== null && visible

  const sample: AudibilitySample = {
    expectingSound,
    contextState: ctx?.state ?? 'closed',
    peak: expectingSound && ctx !== null && ctx.state === 'running' ? readPeak() : 0,
    now,
  }

  const before = state.issue
  state = nextAudibilityState(state, sample)
  if (state.issue !== before) emit(state.issue)
}

function startMonitor(): void {
  if (timer !== null) return
  state = initialAudibilityState(Date.now())
  timer = setInterval(tick, POLL_MS)
}

function stopMonitor(): void {
  if (timer === null) return
  clearInterval(timer)
  timer = null
  samples = null
  const had = state.issue
  state = initialAudibilityState(Date.now())
  if (had !== null) emit(null)
}

/**
 * Mark the start of a span where `id` expects to be heard (drone on, playback
 * running). Idempotent — re-claiming an id that is already playing is a no-op.
 */
export function claimPlayback(id: string): void {
  claims.add(id)
  startMonitor()
}

export function releasePlayback(id: string): void {
  claims.delete(id)
  if (claims.size === 0) stopMonitor()
}

export function currentAudibilityIssue(): AudibilityIssue | null {
  return state.issue
}

export function subscribeAudibility(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
