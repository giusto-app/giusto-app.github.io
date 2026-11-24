import { useEffect, useMemo, useRef, useState } from 'react'
import { attachPieMenu, practiceIcon, studyFamily, type PieMenu, type Score } from 'lilyjs'
import LilyScore from './LilyScore'
import { openStringPassage } from './openStringPassage'
import { RHYTHM_EXERCISES, rhythmPassage, type RhythmExercise } from './rhythmPassage'

interface Props {
  score: Score
  /** The selected passage in bar numbers; null when nothing is selected. */
  span: { start: number; end: number | null } | null
}

type Study = 'open-strings' | RhythmExercise

/** Every study, in the pie's order: Open strings, then the rhythms (keys 1-8). */
const STUDIES: ReadonlyArray<{ id: string; name: string; study: Study }> = [
  { id: 'open-strings', name: 'Open strings', study: 'open-strings' },
  ...RHYTHM_EXERCISES.map(({ exercise, name }) => ({
    id: exercise.kind === 'dotted' ? `dotted:${exercise.pattern}` : exercise.kind, name, study: exercise as Study,
  })),
]

/**
 * Practice the selected passage: one chip opens lilyJS's pie menu of studies
 * (USER 2026-11-23, the menu Nota uses: lilyjs `attachPieMenu`), and the chosen
 * study is drawn right under the score. One study at a time; it follows the
 * selection, so dragging the range redraws it.
 */
export default function PracticeStudy({ score, span }: Props) {
  const [chosen, setChosen] = useState<string | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const chip = useRef<HTMLButtonElement>(null)
  const pie = useRef<PieMenu | null>(null)

  useEffect(() => {
    if (!anchor.current) return
    pie.current = attachPieMenu(anchor.current, { onChoose: (id) => setChosen(id) })
    return () => { pie.current?.destroy(); pie.current = null }
  }, [])
  // The selection cleared: hide the study and the menu.
  const spanKey = span ? `${span.start}-${span.end ?? span.start}` : ''
  useEffect(() => { if (!span) { setChosen(null); pie.current?.close() } }, [spanKey])

  const study = STUDIES.find((s) => s.id === chosen) ?? null
  const passage = useMemo(() => {
    if (!study) return null
    return study.study === 'open-strings' ? openStringPassage(score, span) : rhythmPassage(score, span, study.study)
  }, [study, score, span])

  const open = () => {
    if (!span || !chip.current || !anchor.current) return
    const box = chip.current.getBoundingClientRect(), origin = anchor.current.getBoundingClientRect()
    const bars = span.end != null && span.end !== span.start ? `bars ${span.start}–${span.end}` : `bar ${span.start}`
    pie.current?.open(
      { x: box.left - origin.left + box.width / 2, y: box.bottom - origin.top + 8 + 156 },
      STUDIES.map(({ id, name, study: s }) => ({
        id, label: name, family: studyFamily(s), icon: (doc: Document) => practiceIcon(doc, s), current: id === chosen,
      })),
      bars,
    )
  }

  return (
    <div className="space-y-2">
      <div ref={anchor} className="relative flex flex-wrap items-center gap-2 text-sm text-gray-300">
        <button
          ref={chip}
          type="button"
          aria-haspopup="menu"
          disabled={!span}
          title={span ? 'Choose how to practise the selected bars' : 'Select bars on the score first'}
          onClick={open}
          className={`rounded-lg border px-3 py-1 transition ${study ? 'border-purple-400 bg-purple-500/25 text-white' : 'border-gray-600 hover:border-gray-400'} disabled:opacity-40`}
        >
          {study ? study.name : 'Practice'} ▾
        </button>
        {study && (
          <button type="button" onClick={() => setChosen(null)} className="text-xs text-gray-400 hover:text-gray-200" title="Hide the study">
            ✕
          </button>
        )}
      </div>
      {study && passage && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-2 overflow-x-auto" data-testid="practice-study">
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
