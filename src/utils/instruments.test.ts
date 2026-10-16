import { describe, expect, it } from 'bun:test'
import { INSTRUMENTS, centsFrom, nearestString, openStringTargets } from './instruments'

const byName = (targets: ReturnType<typeof openStringTargets>) =>
  Object.fromEntries(targets.map((t) => [t.name, t]))

describe('open-string targets', () => {
  it('tunes a violin in pure fifths from A', () => {
    const t = byName(openStringTargets(INSTRUMENTS.violin, 440))
    expect(t.A!.frequency).toBeCloseTo(440, 6)
    expect(t.E!.frequency).toBeCloseTo(660, 6)          // 440 × 3/2
    expect(t.D!.frequency).toBeCloseTo(293.3333, 3)     // 440 × 2/3
    expect(t.G!.frequency).toBeCloseTo(195.5556, 3)     // 440 × 4/9
    // A pure fifth is 1.955 ¢ wider than an equal-tempered one.
    expect(t.E!.centsFromEqual).toBeCloseTo(1.955, 2)
    expect(t.D!.centsFromEqual).toBeCloseTo(-1.955, 2)
    expect(t.G!.centsFromEqual).toBeCloseTo(-3.910, 2)
  })

  it('follows the reference pitch', () => {
    const t = byName(openStringTargets(INSTRUMENTS.violin, 442))
    expect(t.A!.frequency).toBeCloseTo(442, 6)
    expect(t.E!.frequency).toBeCloseTo(663, 6)
  })

  it('puts a cello C three pure fifths below A3', () => {
    const t = byName(openStringTargets(INSTRUMENTS.cello, 440))
    expect(t.A!.frequency).toBeCloseTo(220, 6)
    expect(t.C!.centsFromEqual).toBeCloseTo(-5.865, 2)
  })

  it('tunes a double bass in pure fourths', () => {
    const t = byName(openStringTargets(INSTRUMENTS.bass, 440))
    expect(t.A!.frequency).toBeCloseTo(55, 6)
    expect(t.D!.frequency).toBeCloseTo(55 * 4 / 3, 6)
    expect(t.E!.frequency).toBeCloseTo(55 * 3 / 4, 6)
  })

  it('uses equal temperament with a piano and on guitar', () => {
    for (const t of openStringTargets(INSTRUMENTS.violin, 440, true)) expect(t.centsFromEqual).toBeCloseTo(0, 6)
    for (const t of openStringTargets(INSTRUMENTS.guitar, 440)) expect(t.centsFromEqual).toBeCloseTo(0, 6)
  })
})

describe('string detection', () => {
  const targets = openStringTargets(INSTRUMENTS.violin, 440)

  it('finds the nearest string and its cents offset', () => {
    const d = nearestString(661, targets)
    expect(targets[d!.index]!.name).toBe('E')
    expect(d!.cents).toBeCloseTo(centsFrom(661, 660), 6)
  })

  it('still recognises a string a semitone flat', () => {
    const d = nearestString(440 * Math.pow(2, -1 / 12), targets)
    expect(targets[d!.index]!.name).toBe('A')
    expect(d!.cents).toBeCloseTo(-100, 1)
  })

  it('ignores pitches far from every string', () => {
    expect(nearestString(1000, targets)).toBeNull()
  })
})
