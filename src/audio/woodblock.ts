// Synthesized woodblock click for the metronome — no sample file needed.
//
// Recipe: a short square-wave burst through a high-Q bandpass filter with an
// exponential decay envelope. The bandpass ring at the strike frequency is
// what reads as "wood"; total length stays under 100 ms so clicks never smear
// at fast tempos.

const ACCENT_FREQ_HZ = 1200 // downbeat strike
const NORMAL_FREQ_HZ = 800 // other beats
const DECAY_S = 0.06
const STOP_S = 0.08
const BANDPASS_Q = 8

/**
 * Schedule one woodblock click at `atTime` (AudioContext time, seconds).
 * Safe to call ahead of time from a lookahead scheduler.
 */
export function playWoodblock(
  ctx: AudioContext,
  destination: AudioNode,
  atTime: number,
  accent: boolean,
  volume = 1,
): void {
  const freq = accent ? ACCENT_FREQ_HZ : NORMAL_FREQ_HZ

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = freq
  bandpass.Q.value = BANDPASS_Q

  const envelope = ctx.createGain()
  // Instant attack, exponential decay. exponentialRamp cannot reach 0, so ramp
  // to a floor and then hard-zero it.
  const peak = (accent ? 1.0 : 0.7) * volume
  envelope.gain.setValueAtTime(peak, atTime)
  envelope.gain.exponentialRampToValueAtTime(0.001, atTime + DECAY_S)
  envelope.gain.setValueAtTime(0, atTime + DECAY_S + 0.005)

  osc.connect(bandpass)
  bandpass.connect(envelope)
  envelope.connect(destination)

  osc.start(atTime)
  osc.stop(atTime + STOP_S)
  // One-shot nodes disconnect themselves once stopped.
  osc.onended = () => {
    osc.disconnect()
    bandpass.disconnect()
    envelope.disconnect()
  }
}
