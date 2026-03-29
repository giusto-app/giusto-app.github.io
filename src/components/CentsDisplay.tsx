import { formatCents, statusColor, type TuningStatus } from '../utils/noteUtils'

interface CentsDisplayProps {
  cents: number
  status: TuningStatus
}

export default function CentsDisplay({ cents, status }: CentsDisplayProps) {
  return (
    <div className={`text-4xl font-mono font-semibold tabular-nums transition-colors duration-150 ${statusColor(status)}`}>
      {formatCents(cents)}
    </div>
  )
}
