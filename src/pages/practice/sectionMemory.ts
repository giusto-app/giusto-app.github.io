/**
 * The loop range remembered per exercise across sessions (PLAN_LOOP_RANGE.md,
 * LR7, decision D1). Stored in BARS, not beats: bars are what the player
 * shows, and they survive a change of key. One entry per exercise, under a
 * single key so clearing site data clears them together.
 */
import type { SectionSpan } from './rangeOverlayGeometry'

export const SECTION_STORAGE_KEY = 'giusto-loop-ranges'

/** The slice of `Storage` used here, so tests pass a plain object. */
export type SectionStorage = Pick<Storage, 'getItem' | 'setItem'>

function readAll(storage: SectionStorage): Record<string, SectionSpan> {
  try {
    const parsed = JSON.parse(storage.getItem(SECTION_STORAGE_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SectionSpan>) : {}
  } catch {
    return {}
  }
}

/**
 * The saved range for an exercise, if it still fits a tune of `barCount` bars
 * (a re-published exercise can be shorter than when the range was set).
 */
export function loadSection(storage: SectionStorage, exerciseId: string, barCount: number): SectionSpan | null {
  const span = readAll(storage)[exerciseId]
  if (!span || !Number.isInteger(span.start) || span.start < 1 || span.start > barCount) return null
  if (span.end === null) return { start: span.start, end: null }
  if (!Number.isInteger(span.end) || span.end < span.start) return null
  return { start: span.start, end: Math.min(span.end, barCount) }
}

/** Save an exercise's range; null forgets it. Private mode just does not remember. */
export function saveSection(storage: SectionStorage, exerciseId: string, span: SectionSpan | null): void {
  const all = readAll(storage)
  if (span) all[exerciseId] = { start: span.start, end: span.end }
  else delete all[exerciseId]
  try { storage.setItem(SECTION_STORAGE_KEY, JSON.stringify(all)) } catch { /* private mode, quota */ }
}
