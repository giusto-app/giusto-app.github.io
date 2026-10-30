import { describe, expect, it } from 'bun:test'
import { LONG_SCORE_BARS, splitsSystems, viewBoxAspectRatio } from './longScore'

describe('longScore', () => {
  it('splits only scores longer than the threshold', () => {
    expect(splitsSystems(8)).toBe(false)
    expect(splitsSystems(LONG_SCORE_BARS)).toBe(false)
    expect(splitsSystems(LONG_SCORE_BARS + 1)).toBe(true)
  })

  it('reads a system wrapper\'s aspect ratio from its viewBox', () => {
    expect(viewBoxAspectRatio('0 120.5 720 86')).toBe('720 / 86')
    expect(viewBoxAspectRatio('0,0,720,86')).toBe('720 / 86')
    expect(viewBoxAspectRatio('0 0 720 0')).toBeNull()
    expect(viewBoxAspectRatio(null)).toBeNull()
  })
})
