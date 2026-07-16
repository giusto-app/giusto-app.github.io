// Tempo Trainer plan — pure math, no audio, no React. Two ramp modes:
//
//   perLoop: each repetition of the looped exercise bumps the tempo by a
//            fixed step until the target ("play it again, a bit faster").
//   timed:   the tempo ramps linearly from start to target over a wall-clock
//            duration ("40 → 240 BPM over 7 minutes"), applied stepwise at
//            bar starts so changes land musically.
//
// Descending ramps (endBpm < startBpm) work in both modes — useful for
// "start fast, slow down to control" drills.

export interface TempoPlanBase {
  startBpm: number
  endBpm: number
}

export type TempoPlan =
  | (TempoPlanBase & { mode: 'perLoop'; stepBpm: number })
  | (TempoPlanBase & { mode: 'timed'; durationMin: number })

/** BPM for the given 0-based loop iteration (iteration 0 = startBpm). */
export function bpmForLoop(plan: TempoPlanBase & { stepBpm: number }, loopIndex: number): number {
  const dir = Math.sign(plan.endBpm - plan.startBpm) || 1
  const raw = plan.startBpm + dir * Math.abs(plan.stepBpm) * Math.max(0, loopIndex)
  return dir > 0 ? Math.min(plan.endBpm, raw) : Math.max(plan.endBpm, raw)
}

/** BPM after `elapsedSec` of playback (clamped linear ramp, integer BPM). */
export function bpmAtElapsed(plan: TempoPlanBase & { durationMin: number }, elapsedSec: number): number {
  const durationSec = plan.durationMin * 60
  if (durationSec <= 0) return plan.endBpm
  const t = Math.min(1, Math.max(0, elapsedSec / durationSec))
  return Math.round(plan.startBpm + (plan.endBpm - plan.startBpm) * t)
}

/** 0..1 position of `currentBpm` along the ramp (for the progress viz). */
export function rampFraction(plan: TempoPlanBase, currentBpm: number): number {
  const span = plan.endBpm - plan.startBpm
  if (span === 0) return 1
  return Math.min(1, Math.max(0, (currentBpm - plan.startBpm) / span))
}

/** The BPM values the ramp visits, for the stepped-bars viz. perLoop yields
 *  one bar per iteration; timed is sampled. Long ramps are downsampled to
 *  `maxBars` so the viz stays readable. */
export function plannedSteps(plan: TempoPlan, maxBars = 32): number[] {
  if (plan.mode === 'perLoop') {
    const span = Math.abs(plan.endBpm - plan.startBpm)
    const step = Math.abs(plan.stepBpm)
    const count = step > 0 ? Math.floor(span / step) + 1 + (span % step !== 0 ? 1 : 0) : 1
    const steps = Array.from({ length: count }, (_, i) => bpmForLoop(plan, i))
    if (steps.length <= maxBars) return steps
    // Downsample evenly, always keeping the final target value.
    return Array.from({ length: maxBars }, (_, i) =>
      steps[Math.round((i * (steps.length - 1)) / (maxBars - 1))],
    )
  }
  const bars = Math.min(maxBars, 24)
  return Array.from({ length: bars }, (_, i) =>
    Math.round(plan.startBpm + ((plan.endBpm - plan.startBpm) * i) / (bars - 1)),
  )
}
