import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import { openStringPassage } from './openStringPassage'

// A violin in first position: g' and b' are on the D and A strings, e'' is the open E.
const SOURCE = `\\version "2.24.0" \\language "english"
\\score { { \\time 2/4 g'8 b' e''4 | c''8( d'') a'4 | g2 } }`

function scoreOf(source: string): Score {
  return (parseSource(source).document!.blocks.find((b) => b.type === 'score') as { score: Score }).score
}

describe('openStringPassage', () => {
  const score = scoreOf(SOURCE)

  test('answers the selected bars over their open strings', () => {
    const passage = openStringPassage(score, { start: 1, end: 2 })
    expect(passage?.label).toBe('Open strings, m.1–2')
    // Two staves: the bars as written, then d' a' e''; c'' and d'' are both on the
    // A string under one slur, so they are tied (one bow), and a' is the open A again.
    expect(passage?.source.match(/\\new Staff/g)).toHaveLength(2)
    expect(passage?.source).toContain("d'8 a'8 e''4")
    expect(passage?.source).toContain("a'8~ a'8 a'4")
    expect(passage?.source).not.toContain('g2')
  })

  test('takes a range with no end as its first bar, and no range as nothing', () => {
    expect(openStringPassage(score, { start: 3, end: null })?.label).toBe('Open strings, m.3–3')
    expect(openStringPassage(score, null)).toBeNull()
  })

  test('takes the position from the score\'s fingerings', () => {
    // c''-4 is the D string's fourth finger only in third position, so the hand
    // is there: d'' is the A string's first finger and a' the D string's second.
    const fingered = scoreOf(SOURCE.replace("c''8( d'')", "c''8-4( d'')"))
    expect(openStringPassage(fingered, { start: 2, end: 2 })?.source).toContain("d'8( a'8) d'4")
  })
})
