// Playback speed (PLAN_LOOP_RANGE.md, LR8): a multiplier over whatever tempo
// the transport is at — the slider, or the trainer's current step — so slowing
// a hard passage to 75 % keeps the tempo you set and the ramp you planned.

/** The speeds offered, as fractions of the transport tempo. */
export const PLAYBACK_SPEEDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.2] as const

/** The tempo the clock actually runs at. */
export function effectiveBpm(bpm: number, speed: number): number {
  return bpm * (speed > 0 ? speed : 1)
}

/** `75 %` for the menu and the readout. */
export function speedLabel(speed: number): string {
  return `${Math.round(speed * 100)} %`
}
