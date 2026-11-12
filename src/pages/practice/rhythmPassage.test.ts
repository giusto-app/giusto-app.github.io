import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import { RHYTHM_EXERCISES, rhythmPassage } from './rhythmPassage'

// Two bars of eighths and a landing quarter: the eighths are the drilled value.
const SOURCE = `\\version "2.24.0" \\language "english"
\\score { { \\time 2/4 c''8 d'' e'' f'' | g''8 a'' b''4 } }`

function scoreOf(source: string): Score {
  return (parseSource(source).document!.blocks.find((b) => b.type === 'score') as { score: Score }).score
}

describe('rhythmPassage', () => {
  const score = scoreOf(SOURCE)

  test('long-short under the written bars; the quarter stays a quarter', () => {
    const passage = rhythmPassage(score, { start: 1, end: 2 }, { kind: 'dotted', pattern: 'long-short' })
    expect(passage?.label).toBe('Long-short, m.1–2')
    expect(passage?.source.match(/\\new Staff/g)).toHaveLength(2)
    expect(passage?.source).toContain("c''8. d''16 e''8. f''16")
    expect(passage?.source).toContain("b''4")
  })

  test('every exercise answers, and no range is nothing', () => {
    for (const { exercise } of RHYTHM_EXERCISES) expect(rhythmPassage(score, { start: 1, end: 2 }, exercise)?.source).toContain('\\new Staff')
    expect(rhythmPassage(score, null, RHYTHM_EXERCISES[0]!.exercise)).toBeNull()
  })
})
