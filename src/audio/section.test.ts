import { describe, expect, test } from 'bun:test'
import { beatInTake, nextSection, passIndex, resolveStartBeat, takeWindow, type Section } from './section'

// 4/4 throughout: bar N spans beats [(N-1)*4, N*4).
const bar = (n: number) => ({ start: (n - 1) * 4, end: n * 4 })
const click = (current: Section | null, n: number) => nextSection(current, bar(n).start, bar(n).end)

describe('nextSection', () => {
  test('the first click arms a section with no end — it plays to the end of the tune', () => {
    expect(click(null, 5)).toEqual({ startBeat: 16, endBeat: null })
  })

  test('a second click forward closes the span through the end of that bar', () => {
    // Bars 5–12 -> beats [16, 48): the end is EXCLUSIVE and covers all of bar 12.
    expect(click(click(null, 5), 12)).toEqual({ startBeat: 16, endBeat: 48 })
  })

  test('a second click backward means the same span — click order does not matter', () => {
    expect(click(click(null, 12), 5)).toEqual({ startBeat: 16, endBeat: 48 })
  })

  test('a ONE-BAR section is unreachable by clicking — the same bar clears instead', () => {
    // Consequence of the clear-on-reclick rule, not an oversight. If drilling a
    // single bar turns out to matter, the second click on the armed bar has to
    // close a one-bar span and clearing has to move elsewhere.
    expect(nextSection({ startBeat: 16, endBeat: null }, 16, 20)).toBeNull()
  })

  test('clicking the start bar again clears an armed selection', () => {
    expect(click(click(null, 5), 5)).toBeNull()
  })

  test('clicking the start bar again clears a complete selection', () => {
    expect(click({ startBeat: 16, endBeat: 48 }, 5)).toBeNull()
  })

  test('clicking elsewhere in a complete selection starts fresh, never extends it', () => {
    // Mis-clicking an end should leave you re-aiming, not holding a wider drill.
    expect(click({ startBeat: 16, endBeat: 48 }, 9)).toEqual({ startBeat: 32, endBeat: null })
    expect(click({ startBeat: 16, endBeat: 48 }, 3)).toEqual({ startBeat: 8, endBeat: null })
  })
})

describe('resolveStartBeat', () => {
  test('no pause and no section starts from the top', () => {
    expect(resolveStartBeat(null, null)).toBeUndefined()
  })

  test('a section with no pause starts at the section', () => {
    expect(resolveStartBeat(null, { startBeat: 16, endBeat: 48 })).toBe(16)
  })

  test('a pause outranks the section — you asked to continue', () => {
    expect(resolveStartBeat(26.5, { startBeat: 16, endBeat: 48 })).toBe(26.5)
  })

  test('a pause with no section resumes where it stopped', () => {
    expect(resolveStartBeat(26.5, null)).toBe(26.5)
  })

  test('a section starting at bar 1 resolves to beat 0, not to "from the top"', () => {
    expect(resolveStartBeat(null, { startBeat: 0, endBeat: 16 })).toBe(0)
  })
})

describe('takeWindow', () => {
  test('no section is the whole tune', () => {
    expect(takeWindow(null, 64)).toEqual({ startBeat: 0, lengthBeats: 64 })
  })

  test('a complete section is its own span', () => {
    expect(takeWindow({ startBeat: 16, endBeat: 48 }, 64)).toEqual({ startBeat: 16, lengthBeats: 32 })
  })

  test('an armed section runs to the end of the tune', () => {
    expect(takeWindow({ startBeat: 16, endBeat: null }, 64)).toEqual({ startBeat: 16, lengthBeats: 48 })
  })
})

describe('passIndex', () => {
  const section = takeWindow({ startBeat: 16, endBeat: 48 }, 64)

  test('counts passes from zero at the take start', () => {
    expect(passIndex(16, section)).toBe(0)
    expect(passIndex(47, section)).toBe(0)
    expect(passIndex(48, section)).toBe(1)
    expect(passIndex(80, section)).toBe(2)
  })

  test('a 9/8 bar is 4.5 quarter notes — an equality test on the boundary would never fire', () => {
    // Eight bars of 9/8 = 36 QN. The clock only ever reports whole beats, so
    // (beat - start) % 36 is never exactly 0 once the start is fractional.
    const jig = takeWindow({ startBeat: 18, endBeat: 54 }, 90) // bars 5-12 of a 9/8 tune
    expect(jig).toEqual({ startBeat: 18, lengthBeats: 36 })
    expect(passIndex(53, jig)).toBe(0)
    expect(passIndex(54, jig)).toBe(1)
    // The beat the clock actually lands on after a wrap is not the boundary
    // itself, and the pass count still advances exactly once.
    expect(passIndex(55, jig)).toBe(1)
    expect(passIndex(90, jig)).toBe(2)
  })

  test('a zero-length window cannot divide by zero', () => {
    expect(passIndex(9, { startBeat: 4, lengthBeats: 0 })).toBe(0)
  })
})

describe('beatInTake', () => {
  const whole = takeWindow(null, 64)
  const section = takeWindow({ startBeat: 16, endBeat: 48 }, 64)

  test('not looping passes the raw beat straight through', () => {
    expect(beatInTake(70, whole, false)).toBe(70)
    expect(beatInTake(70, section, false)).toBe(70)
  })

  test('with no section it reduces to the old whole-tune modulo', () => {
    expect(beatInTake(64, whole, true)).toBe(0)
    expect(beatInTake(70, whole, true)).toBe(6)
  })

  test('a section wraps back to its own start, not to the top of the tune', () => {
    expect(beatInTake(16, section, true)).toBe(16)
    expect(beatInTake(47.5, section, true)).toBe(47.5)
    expect(beatInTake(48, section, true)).toBe(16)
    expect(beatInTake(50, section, true)).toBe(18)
  })

  test('a take resumed mid-section still wraps to the section start', () => {
    // Paused at bar 7 (beat 24) inside a 5–12 loop: the window is fixed by the
    // SECTION, so the wrap goes to 16, never back to 24.
    expect(beatInTake(80, section, true)).toBe(16)
  })

  test('a zero-length window cannot divide by zero', () => {
    expect(beatInTake(9, { startBeat: 4, lengthBeats: 0 }, true)).toBe(9)
  })
})
