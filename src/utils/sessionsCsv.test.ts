import { describe, expect, test } from 'bun:test'
import { csvFilename, sessionsToCsv } from './sessionsCsv'
import type { PracticeSession } from './sessions'

function session(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: 'a', timestamp: Date.parse('2026-08-09T10:00:00.000Z'), durationMs: 30_000,
    scaleKey: 'd-major', temperamentKey: 'equal', noteEvents: [],
    totalNotes: 10, inTuneCount: 7, closeCount: 2, outOfTuneCount: 1,
    percentInTune: 70, avgAbsCents: 8.5,
    ...overrides,
  } as PracticeSession
}

const rows = (csv: string) => csv.split('\r\n')

describe('sessionsToCsv', () => {
  test('emits a header even with no sessions — an empty file looks broken', () => {
    const csv = sessionsToCsv([])
    expect(rows(csv)).toHaveLength(1)
    expect(rows(csv)[0]).toBe(
      'date,duration_seconds,scale,temperament,total_notes,in_tune,close,out_of_tune,percent_in_tune,avg_abs_cents',
    )
  })

  test('one row per session, with the summary the Progress tab shows', () => {
    const csv = sessionsToCsv([session()])
    expect(rows(csv)[1]).toBe('2026-08-09T10:00:00.000Z,30,d-major,equal,10,7,2,1,70,8.5')
  })

  test('oldest first, so a spreadsheet chart reads left to right', () => {
    // Storage keeps newest-first for the UI; the export flips it.
    const csv = sessionsToCsv([
      session({ id: 'new', timestamp: Date.parse('2026-08-09T10:00:00Z') }),
      session({ id: 'old', timestamp: Date.parse('2026-08-01T10:00:00Z') }),
    ])
    const dates = rows(csv).slice(1).map(r => r.split(',')[0])
    expect(dates).toEqual(['2026-08-01T10:00:00.000Z', '2026-08-09T10:00:00.000Z'])
  })

  test('does not reorder the caller\'s array', () => {
    const input = [
      session({ id: 'new', timestamp: 2000 }),
      session({ id: 'old', timestamp: 1000 }),
    ]
    sessionsToCsv(input)
    expect(input.map(s => s.id)).toEqual(['new', 'old'])
  })

  test('duration is rounded to whole seconds', () => {
    const csv = sessionsToCsv([session({ durationMs: 30_600 })])
    expect(rows(csv)[1].split(',')[1]).toBe('31')
  })

  test('a field containing a comma is quoted, not left to shift the columns', () => {
    // The silent-corruption case: without quoting the row gains a column and
    // every value after it lands under the wrong heading.
    const csv = sessionsToCsv([session({ scaleKey: 'a,b' as PracticeSession['scaleKey'] })])
    expect(rows(csv)[1]).toContain('"a,b"')
    expect(rows(csv)[1].split(',')).toHaveLength(11) // 10 columns + the split inside quotes
  })

  test('quotes inside a field are doubled', () => {
    const csv = sessionsToCsv([session({ scaleKey: 'say "hi"' as PracticeSession['scaleKey'] })])
    expect(rows(csv)[1]).toContain('"say ""hi"""')
  })

  test('a newline inside a field is quoted rather than breaking the row', () => {
    const csv = sessionsToCsv([session({ scaleKey: 'a\nb' as PracticeSession['scaleKey'] })])
    expect(csv).toContain('"a\nb"')
    // Still one data row: the embedded newline is inside quotes, not a row break.
    expect(csv.split('\r\n')).toHaveLength(2)
  })

  test('rows are CRLF-separated, which is what Excel expects', () => {
    const csv = sessionsToCsv([session(), session({ timestamp: 1 })])
    expect(csv.split('\r\n')).toHaveLength(3)
  })
})

describe('csvFilename', () => {
  test('is dated so repeated exports do not overwrite each other', () => {
    expect(csvFilename(new Date('2026-08-09T23:59:00Z'))).toBe('giusto-sessions-2026-08-09.csv')
  })
})
