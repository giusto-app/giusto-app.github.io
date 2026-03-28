import { centsToHsl } from '../../utils/colorUtils'
import type { PracticeSession } from '../../utils/sessions'

interface SessionBarChartProps {
  sessions: PracticeSession[]  // expects newest-first; will reverse for display
}

const VIEW_W = 300
const VIEW_H = 110
const CHART_TOP = 16
const CHART_BOTTOM = 82
const CHART_H = CHART_BOTTOM - CHART_TOP  // 66px usable height
const AXIS_Y = 88

export default function SessionBarChart({ sessions }: SessionBarChartProps) {
  if (sessions.length === 0) return null

  // Show up to 20 most recent, oldest on left
  const displayed = [...sessions].slice(0, 20).reverse()
  const n = displayed.length
  const barW = Math.max(6, (VIEW_W - (n - 1) * 3) / n)
  const step = barW + 3

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        className="block"
        aria-label="Intonation progress chart"
      >
        {/* Grid lines at 25/50/75/100% */}
        {[25, 50, 75, 100].map(pct => {
          const y = CHART_BOTTOM - (pct / 100) * CHART_H
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2={VIEW_W} y2={y}
                stroke="#1f2937" strokeWidth={1} strokeDasharray="3 3" />
              <text x={VIEW_W - 2} y={y - 2}
                fill="#4b5563" fontSize={7} textAnchor="end">
                {pct}%
              </text>
            </g>
          )
        })}

        {/* X axis */}
        <line x1={0} y1={AXIS_Y} x2={VIEW_W} y2={AXIS_Y} stroke="#374151" strokeWidth={1} />

        {/* Bars */}
        {displayed.map((s, i) => {
          const barH = Math.max(2, (s.percentInTune / 100) * CHART_H)
          const x = i * step
          const y = CHART_BOTTOM - barH
          const color = centsToHsl(s.avgAbsCents)
          const dateStr = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' })
            .format(new Date(s.timestamp))

          return (
            <g key={s.id}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx={2} />
              <text
                x={x + barW / 2} y={AXIS_Y + 10}
                fill="#4b5563" fontSize={6} textAnchor="middle"
              >
                {dateStr}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
