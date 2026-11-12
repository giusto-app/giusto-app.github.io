// The selected bars in a practice rhythm (lilyjs `rhythmStudy`, P3 · RP2):
// dotted pairs, two fast one slow, and the regroupings of the Strad article.
// lilyJS reads the written rhythm and drills only the fast notes; Giusto
// supplies the passage (the loop range) and draws the answer, ordinary
// LilyPond source for LilyScore, as the open-string study does.
import { RHYTHM_EXERCISES, rhythmStudy, type RhythmExercise, type Score } from 'lilyjs'

export { RHYTHM_EXERCISES, type RhythmExercise }

export interface RhythmPassage {
  source: string
  label: string
  warnings: string[]
  /** The passage is a poor fit for the drill (few fast notes, none at all). */
  alerts: string[]
}

/** `span` as the range overlay holds it (`end` null: its start bar alone). Null when there is no passage or lilyJS cannot build it. */
export function rhythmPassage(
  score: Score,
  span: { start: number; end: number | null } | null,
  exercise: RhythmExercise,
): RhythmPassage | null {
  if (!span) return null
  try {
    const study = rhythmStudy(score, { from: span.start, to: span.end ?? span.start }, exercise)
    return { source: study.source, label: study.label, warnings: study.warnings, alerts: study.alerts }
  } catch (err) {
    console.error('rhythm study failed', err)
    return null
  }
}
