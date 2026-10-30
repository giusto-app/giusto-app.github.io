import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import { melodyNotes, partGains } from './melodySchedule'

const score = (body: string): Score => {
  const doc = parseSource(`\\version "2.24.0"\n\\language "english"\n\\score { \\new Staff { \\time 4/4 ${body} } }`).document!
  return (doc.blocks.find((b) => b.type === 'score') as { score: Score }).score
}

describe('melodyNotes', () => {
  test('sounds each note at its beat, a tie as one note, a chord as its pitches, and skips rests', () => {
    const notes = melodyNotes(score("c'2 d'2 ~ | d'4 e'4 <f' a'>2 | r1"))
    expect(notes.map((n) => [n.midi, n.startBeat, n.durationBeats])).toEqual([
      [60, 0, 2],
      [62, 2, 3],     // d' tied over the bar line: one 3-beat note
      [64, 5, 1],
      [69, 6, 2],
      [65, 6, 2],
    ])
  })
})

describe('partGains', () => {
  test('backing is today\'s sound; violin-only mutes the backing', () => {
    expect(partGains('backing')).toEqual({ melody: false, backing: true })
    expect(partGains('both')).toEqual({ melody: true, backing: true })
    expect(partGains('violin')).toEqual({ melody: true, backing: false })
  })
})
