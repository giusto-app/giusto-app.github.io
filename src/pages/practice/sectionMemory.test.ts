import { describe, expect, it } from 'bun:test'
import { loadSection, saveSection, SECTION_STORAGE_KEY, type SectionStorage } from './sectionMemory'

const memory = (): SectionStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } }
}

describe('sectionMemory', () => {
  it('remembers each exercise\'s range on its own', () => {
    const s = memory()
    saveSection(s, 'jig', { start: 5, end: 12 })
    saveSection(s, 'waltz', { start: 3, end: null })
    expect(loadSection(s, 'jig', 32)).toEqual({ start: 5, end: 12 })
    expect(loadSection(s, 'waltz', 32)).toEqual({ start: 3, end: null })
    expect(loadSection(s, 'reel', 32)).toBeNull()
  })

  it('forgets a cleared range', () => {
    const s = memory()
    saveSection(s, 'jig', { start: 5, end: 12 })
    saveSection(s, 'jig', null)
    expect(loadSection(s, 'jig', 32)).toBeNull()
  })

  it('drops a range that no longer fits the tune, and trims one that overhangs', () => {
    const s = memory()
    saveSection(s, 'jig', { start: 20, end: 24 })
    expect(loadSection(s, 'jig', 16)).toBeNull()
    saveSection(s, 'jig', { start: 13, end: 24 })
    expect(loadSection(s, 'jig', 16)).toEqual({ start: 13, end: 16 })
  })

  it('survives corrupt storage and a storage that refuses writes', () => {
    const s = memory()
    s.data.set(SECTION_STORAGE_KEY, '{not json')
    expect(loadSection(s, 'jig', 16)).toBeNull()
    const full: SectionStorage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => saveSection(full, 'jig', { start: 1, end: 2 })).not.toThrow()
  })
})
