import { type LearnCard, daysUntilReview } from '../../utils/spaceRepetition'

interface QueueCardProps {
  card: LearnCard
  onPress: (card: LearnCard) => void
}

export default function QueueCard({ card, onPress }: QueueCardProps) {
  const days = daysUntilReview(card)
  const isNew = card.lastReview === null

  const dueLabel = isNew
    ? 'New'
    : days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
        ? 'Due today'
        : `Due in ${days}d`

  const dueLabelColor = isNew
    ? 'text-blue-400'
    : days <= 0
      ? 'text-amber-400'
      : 'text-[color:var(--neu-fg2)]'

  // Stability dots: filled up to log2(stability+1) out of 5
  const filledDots = Math.min(5, Math.round(Math.log2(card.stability + 1)))

  return (
    <button
      onClick={() => onPress(card)}
      className="neu-surface rounded-2xl px-4 py-3 w-full text-left flex items-center gap-3"
    >
      <BookIcon />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[color:var(--neu-fg)] truncate">{card.tuneTitle}</p>
        <p className="text-xs text-[color:var(--neu-fg2)]">{card.sectionLabel}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-xs font-medium ${dueLabelColor}`}>{dueLabel}</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < filledDots ? 'bg-emerald-400' : 'bg-[color:var(--neu-fg2)] opacity-30'}`}
            />
          ))}
        </div>
      </div>
    </button>
  )
}

function BookIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="var(--neu-fg2)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
