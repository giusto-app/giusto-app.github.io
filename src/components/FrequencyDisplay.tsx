interface FrequencyDisplayProps {
  frequency: number
}

export default function FrequencyDisplay({ frequency }: FrequencyDisplayProps) {
  return (
    <div className="text-sm font-mono text-gray-400 tabular-nums">
      {frequency.toFixed(1)} Hz
    </div>
  )
}
