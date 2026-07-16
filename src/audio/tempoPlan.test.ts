import { describe, expect, test } from 'bun:test'
import { bpmAtElapsed, bpmForLoop, plannedSteps, rampFraction, type TempoPlan } from './tempoPlan'

describe('bpmForLoop (per-loop mode)', () => {
  const plan = { startBpm: 60, endBpm: 120, stepBpm: 8 }

  test('iteration 0 is the start tempo, each loop adds one step', () => {
    expect(bpmForLoop(plan, 0)).toBe(60)
    expect(bpmForLoop(plan, 1)).toBe(68)
    expect(bpmForLoop(plan, 5)).toBe(100)
  })

  test('caps at the target and stays there', () => {
    expect(bpmForLoop(plan, 8)).toBe(120) // 60 + 64 → capped
    expect(bpmForLoop(plan, 50)).toBe(120)
  })

  test('descending ramps step downward and cap at the target', () => {
    const down = { startBpm: 120, endBpm: 80, stepBpm: 10 }
    expect(bpmForLoop(down, 0)).toBe(120)
    expect(bpmForLoop(down, 2)).toBe(100)
    expect(bpmForLoop(down, 10)).toBe(80)
  })
})

describe('bpmAtElapsed (timed mode)', () => {
  const plan = { startBpm: 40, endBpm: 240, durationMin: 5 }

  test('linear ramp: start, midpoint, end', () => {
    expect(bpmAtElapsed(plan, 0)).toBe(40)
    expect(bpmAtElapsed(plan, 150)).toBe(140) // halfway through 5 min
    expect(bpmAtElapsed(plan, 300)).toBe(240)
  })

  test('clamps beyond the duration and before the start', () => {
    expect(bpmAtElapsed(plan, 9999)).toBe(240)
    expect(bpmAtElapsed(plan, -5)).toBe(40)
  })

  test('descending timed ramp', () => {
    expect(bpmAtElapsed({ startBpm: 200, endBpm: 100, durationMin: 1 }, 30)).toBe(150)
  })
})

describe('plannedSteps + rampFraction (viz)', () => {
  test('perLoop yields one bar per iteration ending at the target', () => {
    const plan: TempoPlan = { mode: 'perLoop', startBpm: 60, endBpm: 90, stepBpm: 10 }
    expect(plannedSteps(plan)).toEqual([60, 70, 80, 90])
  })

  test('non-divisible span still ends exactly at the target', () => {
    const plan: TempoPlan = { mode: 'perLoop', startBpm: 60, endBpm: 75, stepBpm: 10 }
    expect(plannedSteps(plan)).toEqual([60, 70, 75])
  })

  test('long ramps are downsampled but keep first and last values', () => {
    const plan: TempoPlan = { mode: 'perLoop', startBpm: 40, endBpm: 240, stepBpm: 2 }
    const steps = plannedSteps(plan)
    expect(steps.length).toBe(32)
    expect(steps[0]).toBe(40)
    expect(steps[steps.length - 1]).toBe(240)
  })

  test('timed mode samples a fixed-size ramp', () => {
    const plan: TempoPlan = { mode: 'timed', startBpm: 77, endBpm: 220, durationMin: 12 }
    const steps = plannedSteps(plan)
    expect(steps.length).toBe(24)
    expect(steps[0]).toBe(77)
    expect(steps[steps.length - 1]).toBe(220)
  })

  test('rampFraction tracks progress and clamps', () => {
    const base = { startBpm: 60, endBpm: 120 }
    expect(rampFraction(base, 60)).toBe(0)
    expect(rampFraction(base, 90)).toBe(0.5)
    expect(rampFraction(base, 200)).toBe(1)
    expect(rampFraction({ startBpm: 80, endBpm: 80 }, 80)).toBe(1) // zero-span guard
  })
})
