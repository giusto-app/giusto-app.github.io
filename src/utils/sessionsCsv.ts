// Practice history as CSV, for anyone who wants to chart their own progress in
// a spreadsheet rather than in the Progress tab.
//
// One row per SESSION (the summary the tab already shows). Per-note data is a
// different, much larger export and would want its own file — see the note at
// the bottom of this file.

import type { PracticeSession } from './sessions'

const COLUMNS = [
  'date',
  'duration_seconds',
  'scale',
  'temperament',
  'total_notes',
  'in_tune',
  'close',
  'out_of_tune',
  'percent_in_tune',
  'avg_abs_cents',
] as const

/**
 * Escape one field per RFC 4180: quote it if it contains a quote, a comma or a
 * line break, and double any quote inside.
 *
 * Worth doing properly even though today's fields are slugs and numbers. A
 * naive join breaks silently and invisibly the first time a value contains a
 * comma — the file still opens, the columns just quietly shift.
 */
function escapeField(value: string | number): string {
  const text = String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Render sessions as CSV, oldest first.
 *
 * Storage keeps them newest-first for the UI, but a spreadsheet chart wants
 * time running left to right, and re-sorting a CSV by hand is a chore the
 * export can spare people.
 *
 * Returns just the header row when there are no sessions, so the file a user
 * downloads is always a valid CSV rather than an empty file that looks broken.
 */
export function sessionsToCsv(sessions: PracticeSession[]): string {
  const rows = [...sessions]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(session => [
      // ISO 8601: sortable, unambiguous, and the one format every spreadsheet
      // parses the same way regardless of the reader's locale.
      new Date(session.timestamp).toISOString(),
      Math.round(session.durationMs / 1000),
      session.scaleKey,
      session.temperamentKey,
      session.totalNotes,
      session.inTuneCount,
      session.closeCount,
      session.outOfTuneCount,
      session.percentInTune,
      session.avgAbsCents,
    ].map(escapeField).join(','))

  // CRLF per RFC 4180 — Excel is the fussiest consumer and it wants CRLF.
  return [COLUMNS.join(','), ...rows].join('\r\n')
}

/** Dated filename so repeated exports don't overwrite each other in Downloads. */
export function csvFilename(now: Date): string {
  return `giusto-sessions-${now.toISOString().slice(0, 10)}.csv`
}
