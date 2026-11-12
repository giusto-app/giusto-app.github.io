import { useMemo, useState } from 'react'
import type { Score } from 'lilyjs'
import LilyScore from './LilyScore'
import { RHYTHM_EXERCISES, rhythmPassage } from './rhythmPassage'

interface Props {
  score: Score
  /** The selected passage in bar numbers; null when nothing is selected. */
  span: { start: number; end: number | null } | null
}

/**
 * Practice rhythms for the selected passage, drawn like the open-string study
 * (OpenStringStudy.tsx): one toggle per exercise, and the passage in that
 * rhythm right under the score. One exercise at a time; it follows the
 * selection, so dragging the range redraws it.
 */
export default function RhythmStudy({ score, span }: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  const exercise = chosen == null ? null : RHYTHM_EXERCISES[chosen]?.exercise ?? null
  const passage = useMemo(() => (exercise ? rhythmPassage(score, span, exercise) : null), [exercise, score, span])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
        <span className="text-xs text-gray-400">Rhythms</span>
        {RHYTHM_EXERCISES.map(({ name }, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={chosen === i}
            disabled={!span}
            title={span ? `Play the selected bars as "${name}"` : 'Select bars on the score first'}
            onClick={() => setChosen((on) => (on === i ? null : i))}
            className={`rounded-lg border px-3 py-1 transition ${chosen === i ? 'border-purple-400 bg-purple-500/25 text-white' : 'border-gray-600 hover:border-gray-400'} disabled:opacity-40`}
          >
            {name}
          </button>
        ))}
      </div>
      {exercise && passage && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-2 overflow-x-auto" data-testid="rhythm-study">
          <div className="px-1 pb-1 text-xs text-gray-400">{passage.label}</div>
          {passage.alerts.length > 0 && (
            <div role="alert" className="mx-1 mb-2 rounded-lg border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
              {passage.alerts.map((a) => <div key={a}>{a}</div>)}
            </div>
          )}
          <LilyScore source={passage.source} />
          {passage.warnings.map((w) => <div key={w} className="px-1 text-xs text-amber-400">{w}</div>)}
        </div>
      )}
    </div>
  )
}
