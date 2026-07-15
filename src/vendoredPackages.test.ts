import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
// Regression tests for the two vendored lilyJS artifacts. These import the
// built files directly (bun test doesn't apply the Vite aliases) and parse the
// shipped Play-Along exercise, so a bad re-vendor or a broken exercise file
// fails CI here rather than at runtime.
import { parseDocument } from '../packages/lily-parser/index.js'
import { parseSource } from '../packages/lilyjs/lilyjs.esm.js'
import type { ScoreLike } from 'lilyjs'

const exercise = readFileSync(
  new URL('../public/exercises/practice-arpeggios.ly', import.meta.url),
  'utf8',
)

describe('vendored lily-parser (legacy ParsedTune API)', () => {
  test('parses the Play-Along exercise with chord names from \\new ChordNames { \\chordNames }', () => {
    const blocks = parseDocument(exercise)
    const score = blocks.find((b: { type: string }) => b.type === 'score') as
      | { tune: { title?: string; timeSig: string; notes: unknown[]; chordNames?: Array<{ name: string; duration: number }> } }
      | undefined
    expect(score).toBeDefined()
    const tune = score!.tune
    expect(tune.title).toBe('Practice Arpeggios')
    expect(tune.timeSig).toBe('4/4')
    expect(tune.notes).toHaveLength(32)
    expect(tune.chordNames?.map(c => c.name)).toEqual([
      'Gm', 'Gm', 'Cm', 'Cm', 'F', 'F', 'Bb', 'Bb',
    ])
    // Duration unit contract: quarter-note beats (whole note = 4).
    expect(tune.chordNames?.every(c => c.duration === 4)).toBe(true)
  })
})

describe('vendored lilyjs (modern music-model API)', () => {
  test('parses the Play-Along exercise into measures with offset chord symbols', () => {
    const doc = parseSource(exercise).document
    const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as
      | { score: ScoreLike }
      | undefined
    expect(block).toBeDefined()
    const measures = block!.score.parts[0].measures
    expect(measures).toHaveLength(8)
    const labels = measures.map(m => m.chordSymbols.find(s => s.eventId === null)?.text)
    expect(labels).toEqual(['Gm', 'Gm', 'Cm', 'Cm', 'F', 'F', 'Bb', 'Bb'])
    expect(measures[0].timeSignature).toMatchObject({ beats: 4, beatUnit: 4 })
  })
})
