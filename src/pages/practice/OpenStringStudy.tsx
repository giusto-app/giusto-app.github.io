import { useMemo, useState } from 'react'
import type { Score } from 'lilyjs'
import LilyScore from './LilyScore'
import { openStringPassage } from './openStringPassage'

const POSITIONS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th']

interface Props {
  score: Score
  /** The selected passage in bar numbers; null when nothing is selected. */
  span: { start: number; end: number | null } | null
}

/**
 * "Open strings" for the selected passage: a toggle, the position the player
 * is in, and the passage drawn over its open strings right under the score.
 * It follows the selection, so dragging the range redraws it.
 */
export default function OpenStringStudy({ score, span }: Props) {
  const [shown, setShown] = useState(false)
  const [position, setPosition] = useState(1)
  const [followFingerings, setFollowFingerings] = useState(false)
  const passage = useMemo(
    () => (shown ? openStringPassage(score, span, { position, followFingerings }) : null),
    [shown, score, span, position, followFingerings],
  )

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
        <select
          aria-label="Position"
          value={followFingerings ? 'fingerings' : String(position)}
          onChange={(e) => {
            const fingerings = e.target.value === 'fingerings'
            setFollowFingerings(fingerings)
            if (!fingerings) setPosition(Number(e.target.value))
          }}
          className="rounded-lg border border-gray-600 bg-gray-900 px-2 py-1"
        >
          {POSITIONS.map((name, i) => <option key={name} value={i + 1}>{name} position</option>)}
          <option value="fingerings">From fingerings</option>
        </select>
      </div>
      {shown && passage && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-2 overflow-x-auto" data-testid="open-string-study">
          <div className="px-1 pb-1 text-xs text-gray-400">{passage.label}</div>
          <LilyScore source={passage.source} />
          {passage.warnings.map((w) => <div key={w} className="px-1 text-xs text-amber-400">{w}</div>)}
        </div>
      )}
    </div>
  )
}
