// Shared AudioContext singleton.
//
// Browsers limit the number of AudioContexts and each context has its own
// clock, so every sound source in the app (drone, metronome, chord drone)
// must share this one — otherwise scheduled events can drift apart.
//
// The context starts suspended until a user gesture; call `resumeAudioContext()`
// from inside a click/tap handler before scheduling anything.

let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  return ctx
}

export async function resumeAudioContext(): Promise<AudioContext> {
  const c = getAudioContext()
  if (c.state === 'suspended') {
    await c.resume()
  }
  return c
}
