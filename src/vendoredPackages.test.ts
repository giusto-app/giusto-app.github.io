import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
// Regression test for the vendored lilyjs bundle, imported by package name
// through Bun workspaces. The legacy lily-parser block was removed when lilyJS
// retired that API surface (2026-08-10, a473c5a3) and the package was deleted.
import { parseSource } from 'lilyjs'
import type { ScoreLike } from 'lilyjs'

const exercise = readFileSync(
  new URL('../public/exercises/practice-arpeggios-Gm-Cm-F-Bb.ly', import.meta.url),
  'utf8',
)

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
