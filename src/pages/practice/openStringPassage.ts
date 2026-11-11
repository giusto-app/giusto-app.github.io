// The selected bars over the open strings they are played on (lilyjs >= 0.81,
// `openStringStudy`): what the right arm does in the passage, without the left
// hand. lilyJS decides the strings from the position; Giusto supplies the
// passage (the loop range) and draws the answer, which is ordinary LilyPond
// source for LilyScore.
import { openStringStudy, type Score } from 'lilyjs'

export interface OpenStringChoice {
  /** 1 = first position. */
  position: number
  /** Let a fingering that is impossible in the position move it. */
  followFingerings: boolean
}

export interface OpenStringPassage {
  source: string
  label: string
  warnings: string[]
}

/**
 * `span` is the selected passage in bar numbers, as the range overlay holds it
 * (`end` null: armed with no end yet, which is its start bar alone).
 * Null when there is no passage or lilyJS cannot reduce it.
 */
export function openStringPassage(
  score: Score,
  span: { start: number; end: number | null } | null,
  choice: OpenStringChoice,
): OpenStringPassage | null {
  if (!span) return null
  try {
    const study = openStringStudy(score, { from: span.start, to: span.end ?? span.start }, {
      position: choice.position,
      followFingerings: choice.followFingerings,
    })
    return { source: study.source, label: study.variant.label, warnings: study.warnings }
  } catch (err) {
    console.error('open-string study failed', err)
    return null
  }
}
