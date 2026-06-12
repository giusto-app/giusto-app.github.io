import { type DTWResult, computeOverallScore } from '../../utils/dtw'

interface ScoreDisplayProps {
  dtwResult: DTWResult
  onGrade: (grade: 1 | 2 | 3 | 4) => void
  showGradeButtons?: boolean
}

const GRADES: Array<{ grade: 1 | 2 | 3 | 4; label: string; desc: string; color: string; active: string }> = [
  { grade: 1, label: 'Again', desc: "Couldn't play it", color: 'text-red-400',    active: 'border-red-500/50' },
  { grade: 2, label: 'Hard',  desc: 'Many errors',      color: 'text-amber-400',  active: 'border-amber-500/50' },
  { grade: 3, label: 'Good',  desc: 'Mostly there',     color: 'text-blue-400',   active: 'border-blue-500/50' },
  { grade: 4, label: 'Easy',  desc: 'Clean and solid',  color: 'text-emerald-400', active: 'border-emerald-500/50' },
]

export default function ScoreDisplay({ dtwResult, onGrade, showGradeButtons = true }: ScoreDisplayProps) {
  const overall = computeOverallScore(dtwResult)
  const matchPct = dtwResult.totalExpected > 0
    ? Math.round((dtwResult.matchedCount / dtwResult.totalExpected) * 100)
    : 0

  const scoreColor =
    overall >= 80 ? '#34d399' :
    overall >= 55 ? '#f59e0b' :
    '#f87171'

  return (
    <div className="flex flex-col gap-5">
      {/* Score badge */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="w-24 h-24 rounded-full neu-inset flex items-center justify-center"
          style={{ boxShadow: `inset 0 0 0 3px ${scoreColor}40, inset -3px -3px 8px var(--neu-hl), inset 3px 3px 8px var(--neu-sh)` }}
        >
          <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor }}>
            {overall}
          </span>
        </div>
        <p className="text-xs text-[color:var(--neu-fg2)] tracking-widest uppercase">Score</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 justify-center">
        <StatChip label="Notes matched" value={`${dtwResult.matchedCount}/${dtwResult.totalExpected}`} />
        <StatChip label="Match rate" value={`${matchPct}%`} />
        <StatChip label="Intonation" value={`${dtwResult.intonationScore}/100`} />
      </div>

      {/* Note match bar */}
      {dtwResult.totalExpected > 0 && (
        <div className="neu-inset rounded-xl px-3 py-2">
          <p className="text-xs text-[color:var(--neu-fg2)] mb-2">Note alignment</p>
          <div className="flex gap-0.5 flex-wrap">
            {Array.from({ length: dtwResult.totalExpected }, (_, i) => {
              const matched = i < dtwResult.matchedCount
              return (
                <div
                  key={i}
                  className={`h-4 flex-1 min-w-[6px] rounded-sm ${matched ? 'bg-emerald-500/70' : 'bg-red-500/40'}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Grade buttons — shown only on last section or standalone use */}
      {showGradeButtons && <div>
        <p className="text-xs text-[color:var(--neu-fg2)] text-center mb-3 tracking-widest uppercase">
          How did it go?
        </p>
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(({ grade, label, desc, color, active }) => (
            <button
              key={grade}
              onClick={() => onGrade(grade)}
              className={`neu-btn rounded-xl py-3 flex flex-col items-center gap-1 border ${active}`}
            >
              <span className={`text-sm font-bold ${color}`}>{grade}</span>
              <span className={`text-xs font-semibold ${color}`}>{label}</span>
              <span className="text-[10px] text-[color:var(--neu-fg2)] text-center leading-tight">{desc}</span>
            </button>
          ))}
        </div>
      </div>}
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-inset rounded-xl px-3 py-2 flex flex-col items-center gap-0.5">
      <span className="text-sm font-bold text-[color:var(--neu-fg)]">{value}</span>
      <span className="text-[10px] text-[color:var(--neu-fg2)] whitespace-nowrap">{label}</span>
    </div>
  )
}
