import { describe, expect, test } from 'bun:test'
import { parseSource, type Score } from 'lilyjs'
import { buildChordBackingSchedule, chordBlocksInWindow, voiceChord } from './chordBacking'

function scoreOf(chordmode: string, staff = 'c1 c1 c1 c1'): Score {
  const src = `\\language "english"
    chordNames = \\chordmode { ${chordmode} }
    \\score {
      <<
        \\new ChordNames { \\chordNames }
        \\new Staff { \\relative c' { ${staff} } }
      >>
    }`
  const doc = parseSource(src).document
  const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: Score } | undefined
  if (!block) throw new Error('no score block')
  return block.score
}

describe('voiceChord', () => {
  test('ascends from the C3 base, bumping octaves to stay ascending', () => {
    // G minor pitch classes [7,10,2] → G3 B♭3 D4.
    expect(voiceChord([7, 10, 2])).toEqual([55, 58, 62])
    // C major [0,4,7] → C3 E3 G3.
    expect(voiceChord([0, 4, 7])).toEqual([48, 52, 55])
  })
})

describe('buildChordBackingSchedule', () => {
  test('one voiced block per chord over Gm–Cm–F–B♭', () => {
    const blocks = buildChordBackingSchedule(scoreOf('g1:m c1:m f1 bf1'))
    expect(blocks).toHaveLength(4)
    expect(blocks[0]).toEqual({ startBeat: 0, durationBeats: 4, midis: [55, 58, 62], velocity: 64 })
    expect(blocks.map((b) => b.startBeat)).toEqual([0, 4, 8, 12])
    // Every block voices at least a triad.
    expect(blocks.every((b) => b.midis.length >= 3)).toBe(true)
  })

  test('no-chord spans are skipped', () => {
    const blocks = buildChordBackingSchedule(scoreOf('c1:m r1 f1', 'c1 c1 c1'))
    expect(blocks.map((b) => b.startBeat)).toEqual([0, 8])
  })

  test('no chord track → empty', () => {
    const doc = parseSource('\\score { \\relative c\' { c4 d e f } }').document
    const block = doc?.blocks.find((b: { type: string }) => b.type === 'score') as { score: Score }
    expect(buildChordBackingSchedule(block.score)).toEqual([])
  })
})

describe('chordBlocksInWindow', () => {
  const blocks = buildChordBackingSchedule(scoreOf('g1:m c1:m f1 bf1'))
  test('returns the block starting inside the beat window', () => {
    expect(chordBlocksInWindow(blocks, 0, 1).map((b) => b.startBeat)).toEqual([0])
    expect(chordBlocksInWindow(blocks, 4, 5).map((b) => b.startBeat)).toEqual([4])
    expect(chordBlocksInWindow(blocks, 1, 4)).toEqual([])
  })
})
