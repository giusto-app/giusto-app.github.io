// The selected bars over the open strings they are played on (lilyjs >= 0.81,
// `openStringStudy`): what the right arm does in the passage, without the left
// hand. lilyJS decides the strings from the position in force, which the
// score's fingerings set (no position menu, USER 2026-11-11); Giusto supplies
// the passage (the loop range) and draws the answer, which is ordinary
// LilyPond source for LilyScore.
import { openStringStudy, type Score } from 'lilyjs'

export interface OpenStringPassage {
  source: string
  label: string
  warnings: string[]
  /** The score does not say enough to place the passage (no fingering sets the position, or a note is out of reach). */
  alerts: string[]
}

/**
 * `span` is the selected passage in bar numbers, as the range overlay holds it
 * (`end` null: armed with no end yet, which is its start bar alone).
 * Null when there is no passage or lilyJS cannot reduce it.
 */
export function openStringPassage(
  score: Score,
  span: { start: number; end: number | null } | null,
): OpenStringPassage | null {
  if (!span) return null
  try {
    const study = openStringStudy(score, { from: span.start, to: span.end ?? span.start }, { followFingerings: true })
    const alerts = (study as { alerts?: string[] }).alerts ?? []
    return { source: study.source, label: study.variant.label, warnings: study.warnings.filter((w) => !alerts.includes(w)), alerts }
  } catch (err) {
    console.error('open-string study failed', err)
    return null
  }
}
