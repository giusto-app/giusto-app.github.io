import { statusColor, type TuningStatus } from '../utils/noteUtils'

interface NoteDisplayProps {
  noteName: string
  octave: number
  status: TuningStatus
}

export default function NoteDisplay({ noteName, octave, status }: NoteDisplayProps) {
  return (
    <div className="flex items-end justify-center gap-1 leading-none">
      <span className={`text-9xl font-bold tracking-tight transition-colors duration-150 ${statusColor(status)}`}>
        {noteName}
      </span>
      <span className="text-4xl font-semibold text-gray-300 mb-4">
        {octave}
      </span>
    </div>
  )
}
