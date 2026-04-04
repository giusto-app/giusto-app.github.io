import { type TuneCatalogEntry, svgUrl } from '../../hooks/useTuneCatalog'
import { type LearnCard } from '../../utils/spaceRepetition'

interface TuneDetailProps {
  tune: TuneCatalogEntry
  isAdded: boolean
  existingCard: LearnCard | undefined
  onBack: () => void
  onAdd: () => void
  onPractice: () => void
  onRemove: () => void
}

export default function TuneDetail({ tune, isAdded, existingCard: _existingCard, onBack, onAdd, onPractice, onRemove }: TuneDetailProps) {
  return (
    <div className="min-h-full flex flex-col px-4 py-6 gap-5">
      <header className="flex items-center gap-3">
        <button onClick={onBack} className="neu-btn rounded-full p-2 text-[color:var(--neu-fg2)]">
          <ChevronLeft />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-[color:var(--neu-fg)] truncate">{tune.title}</h1>
          <p className="text-xs text-[color:var(--neu-fg2)]">
            {tune.composer} · {tune.type} · {tune.key} · {tune.time_sig}
          </p>
        </div>
        <DifficultyBadge difficulty={tune.difficulty} />
      </header>

      {/* Sheet music */}
      <div className="neu-inset rounded-2xl p-2 overflow-hidden">
        <img
          src={svgUrl(tune)}
          alt={`Sheet music for ${tune.title}`}
          className="w-full rounded-xl"
          loading="lazy"
        />
      </div>

      {/* Metadata row */}
      <div className="flex gap-2 flex-wrap">
        {[tune.key, tune.time_sig, tune.type, tune.category].filter(Boolean).map(tag => (
          <span key={tag} className="neu-inset text-xs px-2.5 py-1 rounded-full text-[color:var(--neu-fg2)]">
            {tag}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {isAdded ? (
          <>
            <button
              onClick={onPractice}
              className="w-full py-3 rounded-2xl neu-btn text-sm font-semibold text-emerald-400"
            >
              Practice now
            </button>
            <button
              onClick={onRemove}
              className="w-full py-2 rounded-2xl text-xs text-red-400/70 hover:text-red-400 transition-colors"
            >
              Remove from queue
            </button>
          </>
        ) : (
          <button
            onClick={onAdd}
            className="w-full py-3 rounded-2xl neu-btn text-sm font-semibold text-[color:var(--neu-fg)]"
          >
            Add to practice queue
          </button>
        )}
      </div>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === 'Beginner'     ? 'text-emerald-400 border-emerald-500/30' :
    difficulty === 'Elementary'   ? 'text-blue-400    border-blue-500/30'    :
    difficulty === 'Intermediate' ? 'text-amber-400   border-amber-500/30'   :
    difficulty === 'Advanced'     ? 'text-orange-400  border-orange-500/30'  :
    'text-red-400 border-red-500/30'

  return (
    <span className={`shrink-0 text-[10px] font-semibold neu-inset px-2 py-1 rounded-full border ${color}`}>
      {difficulty}
    </span>
  )
}

function ChevronLeft() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
