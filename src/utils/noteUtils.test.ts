import { describe, it, expect } from 'bun:test'
import { midiNoteToInfo, keyToSharps } from './noteUtils'

describe('midiNoteToInfo', () => {
  it('returns sharps by default', () => {
    expect(midiNoteToInfo(61).noteName).toBe('C#')  // MIDI 61 = C#4/Db4
    expect(midiNoteToInfo(66).noteName).toBe('F#')  // MIDI 66 = F#4/Gb4
  })

  it('returns flats when sharps < 0', () => {
    expect(midiNoteToInfo(61, -1).noteName).toBe('Db')
    expect(midiNoteToInfo(66, -2).noteName).toBe('Gb')
    expect(midiNoteToInfo(70, -2).noteName).toBe('Bb')
  })

  it('returns naturals the same regardless of sharps', () => {
    expect(midiNoteToInfo(60, 0).noteName).toBe('C')
    expect(midiNoteToInfo(60, -3).noteName).toBe('C')
    expect(midiNoteToInfo(62, 2).noteName).toBe('D')
  })

  it('returns correct octave', () => {
    expect(midiNoteToInfo(60).octave).toBe(4)   // C4
    expect(midiNoteToInfo(69).octave).toBe(4)   // A4
    expect(midiNoteToInfo(72).octave).toBe(5)   // C5
    expect(midiNoteToInfo(48).octave).toBe(3)   // C3
  })

  it('returns correct pitchClass', () => {
    expect(midiNoteToInfo(60).pitchClass).toBe(0)   // C
    expect(midiNoteToInfo(69).pitchClass).toBe(9)   // A
    expect(midiNoteToInfo(71).pitchClass).toBe(11)  // B
  })
})

describe('keyToSharps', () => {
  it('sharp major keys', () => {
    expect(keyToSharps('C')).toBe(0)
    expect(keyToSharps('G')).toBe(1)
    expect(keyToSharps('D')).toBe(2)
    expect(keyToSharps('A')).toBe(3)
  })

  it('flat major keys', () => {
    expect(keyToSharps('F')).toBe(-1)
    expect(keyToSharps('Bb')).toBe(-2)
    expect(keyToSharps('Eb')).toBe(-3)
  })

  it('minor keys', () => {
    expect(keyToSharps('Am')).toBe(0)
    expect(keyToSharps('Em')).toBe(1)
    expect(keyToSharps('Dm')).toBe(-1)
  })

  it('unknown key defaults to 0', () => {
    expect(keyToSharps('X')).toBe(0)
    expect(keyToSharps('')).toBe(0)
  })

  it('D major gives F# not Gb for MIDI 66', () => {
    const sharps = keyToSharps('D')
    expect(midiNoteToInfo(66, sharps).noteName).toBe('F#')
  })

  it('Bb major gives Bb not A# for MIDI 70', () => {
    const sharps = keyToSharps('Bb')
    expect(midiNoteToInfo(70, sharps).noteName).toBe('Bb')
  })
})
