import { describe, expect, test } from 'bun:test'
import { nextSection, resolveStartBeat, takeWindow, TakeTimeline, type Section } from './section'

// 4/4 throughout: bar N spans beats [(N-1)*4, N*4).
const bar = (n: number) => ({ start: (n - 1) * 4, end: n * 4 })
const click = (current: Section | null, n: number) => nextSection(current, bar(n).start, bar(n).end)

describe('nextSection', () => {
  test('a click selects that bar alone — nothing waits for a second click', () => {
    expect(click(null, 5)).toEqual({ startBeat: 16, endBeat: 20 })
  })

  test('a click on the bar right after or right before the selection extends it', () => {
    expect(click(click(null, 5), 6)).toEqual({ startBeat: 16, endBeat: 24 })
    expect(click({ startBeat: 16, endBeat: 24 }, 4)).toEqual({ startBeat: 12, endBeat: 24 })
  })

  test('a click on a bar that is not next to the selection starts over on that bar', () => {
    expect(click({ startBeat: 16, endBeat: 24 }, 9)).toEqual({ startBeat: 32, endBeat: 36 })
    expect(click({ startBeat: 16, endBeat: 24 }, 2)).toEqual({ startBeat: 4, endBeat: 8 })
  })

  test('a click inside a selection of several bars keeps it', () => {
    expect(click({ startBeat: 16, endBeat: 48 }, 9)).toEqual({ startBeat: 16, endBeat: 48 })
    expect(click({ startBeat: 16, endBeat: 48 }, 5)).toEqual({ startBeat: 16, endBeat: 48 })
  })

  test('a click on the one selected bar clears it', () => {
    expect(click(click(null, 5), 5)).toBeNull()
  })

  test('a section armed by an earlier version counts as its start bar', () => {
    expect(click({ startBeat: 16, endBeat: null }, 6)).toEqual({ startBeat: 16, endBeat: 24 })
    expect(click({ startBeat: 16, endBeat: null }, 5)).toBeNull()
  })

  test('a 9/8 bar of 4.5 quarter notes extends on its exact bounds', () => {
    // Bars of 4.5 QN: bar 2 is [4.5, 9), bar 3 is [9, 13.5).
    expect(nextSection({ startBeat: 4.5, endBeat: 9 }, 9, 13.5)).toEqual({ startBeat: 4.5, endBeat: 13.5 })
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

describe('TakeTimeline', () => {
  const whole = takeWindow(null, 64)
  const section = takeWindow({ startBeat: 16, endBeat: 48 }, 64)
  const fixed = (w: typeof section, looping = true) => new TakeTimeline(w, looping, () => w)

  test('counts passes from zero at the take start', () => {
    const t = fixed(section)
    expect([16, 47, 48, 80].map((b) => t.passIndex(b))).toEqual([0, 0, 1, 2])
  })

  test('a 9/8 bar is 4.5 quarter notes — an equality test on the boundary would never fire', () => {
    // Eight bars of 9/8 = 36 QN. The clock only ever reports whole beats, so
    // (beat - start) % 36 is never exactly 0 once the start is fractional.
    const jig = takeWindow({ startBeat: 18, endBeat: 54 }, 90) // bars 5-12 of a 9/8 tune
    expect(jig).toEqual({ startBeat: 18, lengthBeats: 36 })
    const t = fixed(jig)
    // The beat the clock actually lands on after a wrap is not the boundary
    // itself, and the pass count still advances exactly once.
    expect([53, 54, 55, 90].map((b) => t.passIndex(b))).toEqual([0, 1, 1, 2])
  })

  test('not looping passes the raw beat straight through', () => {
    expect(fixed(whole, false).tuneBeat(70)).toBe(70)
    expect(fixed(section, false).tuneBeat(70)).toBe(70)
  })

  test('with no section it reduces to the old whole-tune modulo', () => {
    const t = fixed(whole)
    expect([64, 70].map((b) => t.tuneBeat(b))).toEqual([0, 6])
  })

  test('a section wraps back to its own start, not to the top of the tune', () => {
    const t = fixed(section)
    expect([16, 47.5, 48, 50].map((b) => t.tuneBeat(b))).toEqual([16, 47.5, 16, 18])
  })

  test('a take resumed mid-section still wraps to the section start', () => {
    // Paused at bar 7 (beat 24) inside a 5–12 loop: the window is fixed by the
    // SECTION, so the wrap goes to 16, never back to 24.
    expect(fixed(section).tuneBeat(80)).toBe(16)
  })

  test('a zero-length window cannot divide by zero', () => {
    const t = fixed({ startBeat: 4, lengthBeats: 0 })
    expect([t.tuneBeat(9), t.passIndex(9)]).toEqual([9, 0])
  })

  test('a range moved mid-pass takes effect on the NEXT pass', () => {
    // Looping bars 5-12; during the first pass the range is dragged to 9-10.
    let current = section
    const t = new TakeTimeline(section, true, () => current)
    expect(t.tuneBeat(40)).toBe(40)               // bar 11, first pass
    current = takeWindow({ startBeat: 32, endBeat: 40 }, 64)
    expect(t.tuneBeat(47)).toBe(47)               // the first pass finishes on 5-12
    expect(t.tuneBeat(48)).toBe(32)               // the second starts at bar 9
    expect(t.windowAt(48)).toEqual({ startBeat: 32, lengthBeats: 8 })
    expect(t.tuneBeat(55)).toBe(39)
    expect(t.tuneBeat(56)).toBe(32)               // and loops 9-10 from then on
    expect(t.passIndex(56)).toBe(2)
  })

  test('the cursor, behind the scheduler, reads the window its pass was played with', () => {
    let current = section
    const t = new TakeTimeline(section, true, () => current)
    current = takeWindow({ startBeat: 32, endBeat: 40 }, 64)
    expect(t.tuneBeat(49)).toBe(33)               // the scheduler reaches pass 2
    current = takeWindow({ startBeat: 0, endBeat: 8 }, 64)
    expect(t.tuneBeat(46)).toBe(46)               // the cursor is still in pass 1
    expect(t.tuneBeat(50)).toBe(34)               // pass 2 kept its window
  })
})
