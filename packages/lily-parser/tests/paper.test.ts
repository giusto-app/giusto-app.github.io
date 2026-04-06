import { describe, it, expect } from 'bun:test'
import { extractPaper, parseLy } from '../src/parser.js'

// ── extractPaper ──────────────────────────────────────────────────────────────

describe('extractPaper — ragged-last', () => {
  it('returns empty object when no \\paper block', () => {
    const result = extractPaper('\\key c \\major c4 d e f')
    expect(result.raggedLast).toBeUndefined()
  })

  it('parses ragged-last = ##f as false (last row stretched)', () => {
    const src = '\\paper { ragged-last = ##f }'
    expect(extractPaper(src).raggedLast).toBe(false)
  })

  it('parses ragged-last = ##t as true (last row natural width)', () => {
    const src = '\\paper { ragged-last = ##t }'
    expect(extractPaper(src).raggedLast).toBe(true)
  })

  it('handles whitespace and newlines inside the block', () => {
    const src = '\\paper {\n  ragged-last = ##f\n}'
    expect(extractPaper(src).raggedLast).toBe(false)
  })

  it('returns undefined when ragged-last is absent from block', () => {
    const src = '\\paper { indent = 0 }'
    expect(extractPaper(src).raggedLast).toBeUndefined()
  })

  it('ignores ragged-last outside \\paper block', () => {
    // This string has no \paper block at all — should not match
    const src = 'ragged-last = ##f c4 d e f'
    expect(extractPaper(src).raggedLast).toBeUndefined()
  })
})

describe('extractPaper — indent', () => {
  it('returns undefined when no \\paper block', () => {
    expect(extractPaper('c4 d e f').indent).toBeUndefined()
  })

  it('parses indent = 0 as 0', () => {
    const src = '\\paper { indent = 0 }'
    expect(extractPaper(src).indent).toBe(0)
  })

  it('parses positive integer indent', () => {
    const src = '\\paper { indent = 20 }'
    expect(extractPaper(src).indent).toBe(20)
  })

  it('parses decimal indent', () => {
    const src = '\\paper { indent = 15.5 }'
    expect(extractPaper(src).indent).toBe(15.5)
  })

  it('returns undefined when indent is absent from block', () => {
    const src = '\\paper { ragged-last = ##f }'
    expect(extractPaper(src).indent).toBeUndefined()
  })
})

describe('extractPaper — combined settings', () => {
  it('parses both ragged-last and indent from the same block', () => {
    const src = '\\paper {\n  ragged-last = ##f\n  indent = 0\n}'
    const result = extractPaper(src)
    expect(result.raggedLast).toBe(false)
    expect(result.indent).toBe(0)
  })

  it('works with other paper settings in the block (ignores unknown keys)', () => {
    const src = '\\paper { top-margin = 10\n  ragged-last = ##t\n  left-margin = 15\n  indent = 5\n}'
    const result = extractPaper(src)
    expect(result.raggedLast).toBe(true)
    expect(result.indent).toBe(5)
  })
})

// ── parseLy integration ───────────────────────────────────────────────────────

describe('parseLy — \\paper propagation', () => {
  const minimal = (paper: string) =>
    `\\paper { ${paper} }\n\\key c \\major\nmelody = \\relative c' { c4 d e f }\n\\score { \\new Staff { \\melody } }`

  it('raggedLast is undefined when no \\paper block', () => {
    const tune = parseLy('melody = \\relative c\' { c4 d } \\score { \\new Staff { \\melody } }')
    expect(tune.raggedLast).toBeUndefined()
  })

  it('raggedLast = false when ragged-last = ##f', () => {
    const tune = parseLy(minimal('ragged-last = ##f'))
    expect(tune.raggedLast).toBe(false)
  })

  it('raggedLast = true when ragged-last = ##t', () => {
    const tune = parseLy(minimal('ragged-last = ##t'))
    expect(tune.raggedLast).toBe(true)
  })

  it('firstIndent = 0 when indent = 0', () => {
    const tune = parseLy(minimal('indent = 0'))
    expect(tune.firstIndent).toBe(0)
  })

  it('firstIndent is undefined when no indent setting', () => {
    const tune = parseLy(minimal('ragged-last = ##f'))
    expect(tune.firstIndent).toBeUndefined()
  })

  it('notes are still parsed correctly alongside \\paper block', () => {
    const tune = parseLy(minimal('ragged-last = ##f  indent = 0'))
    expect(tune.notes.length).toBe(4)
    expect(tune.key).toBe('C')
  })
})
