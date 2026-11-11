import { useMemo, useState } from 'react'
import type { Score } from 'lilyjs'
import LilyScore from './LilyScore'
import { openStringPassage } from './openStringPassage'

interface Props {
  score: Score
  /** The selected passage in bar numbers; null when nothing is selected. */
  span: { start: number; end: number | null } | null
}

/**
 * "Open strings" for the selected passage: a toggle, and the passage drawn over
 * its open strings right under the score, in the position the score's
 * fingerings put the player in. When the score does not say enough (no
 * fingering sets the position), an alert says so. It follows the selection,
 * so dragging the range redraws it.
 */
export default function OpenStringStudy({ score, span }: Props) {
  const [shown, setShown] = useState(false)
  const passage = useMemo(() => (shown ? openStringPassage(score, span) : null), [shown, score, span])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
        <button
          type="button"
          aria-pressed={shown}
          disabled={!span}
          title={span ? 'Show the selected bars on open strings' : 'Select bars on the score first'}
          onClick={() => setShown((on) => !on)}
          className={`rounded-lg border px-3 py-1 transition ${shown ? 'border-purple-400 bg-purple-500/25 text-white' : 'border-gray-600 hover:border-gray-400'} disabled:opacity-40`}
        >
          Open strings
        </button>
      </div>
      {shown && passage && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-2 overflow-x-auto" data-testid="open-string-study">
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
