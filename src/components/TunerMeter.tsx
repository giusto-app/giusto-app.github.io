import { type TuningStatus, statusStrokeColor } from '../utils/noteUtils'

interface TunerMeterProps {
  cents: number       // -50 to +50
  status: TuningStatus
}

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2 + 20  // shift center down slightly so arc has more room
const RADIUS = 110
const ARC_START_DEG = 210  // degrees from 3 o'clock (SVG convention)
const ARC_END_DEG = 330    // total span = 120 degrees

// Convert polar degrees (0 = right, clockwise) to SVG x,y
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180) // SVG 0° is top
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

// Map cents (-50..+50) to degrees on the arc
function centsToDeg(cents: number) {
  const clamped = Math.max(-50, Math.min(50, cents))
  // 0 cents = midpoint of arc (270°)
  return 270 + (clamped / 50) * 60
}

export default function TunerMeter({ cents, status }: TunerMeterProps) {
  const needleDeg = centsToDeg(cents)
  const needleTip = polar(CX, CY, RADIUS - 10, needleDeg)
  const needleBase1 = polar(CX, CY, 14, needleDeg + 90)
  const needleBase2 = polar(CX, CY, 14, needleDeg - 90)
  const color = statusStrokeColor(status)

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      className="w-full max-w-xs mx-auto select-none"
      aria-label={`Tuning meter: ${Math.round(cents)} cents`}
    >
      {/* Background arc track */}
      <path
        d={describeArc(CX, CY, RADIUS, ARC_START_DEG, ARC_END_DEG)}
        fill="none"
        stroke="#1f2937"
        strokeWidth={18}
        strokeLinecap="round"
      />

      {/* Red zone — flat side */}
      <path
        d={describeArc(CX, CY, RADIUS, ARC_START_DEG, 240)}
        fill="none"
        stroke="#7f1d1d"
        strokeWidth={18}
        strokeLinecap="round"
      />

      {/* Red zone — sharp side */}
      <path
        d={describeArc(CX, CY, RADIUS, 300, ARC_END_DEG)}
        fill="none"
        stroke="#7f1d1d"
        strokeWidth={18}
        strokeLinecap="round"
      />

      {/* Yellow zone — flat side */}
      <path
        d={describeArc(CX, CY, RADIUS, 240, 258)}
        fill="none"
        stroke="#78350f"
        strokeWidth={18}
      />

      {/* Yellow zone — sharp side */}
      <path
        d={describeArc(CX, CY, RADIUS, 282, 300)}
        fill="none"
        stroke="#78350f"
        strokeWidth={18}
      />

      {/* Green center zone */}
      <path
        d={describeArc(CX, CY, RADIUS, 258, 282)}
        fill="none"
        stroke="#064e3b"
        strokeWidth={18}
      />

      {/* Tick marks: flat, center, sharp */}
      {[-50, -25, 0, 25, 50].map(tick => {
        const deg = centsToDeg(tick)
        const inner = polar(CX, CY, RADIUS - 14, deg)
        const outer = polar(CX, CY, RADIUS + 4, deg)
        const isCenter = tick === 0
        return (
          <line
            key={tick}
            x1={inner.x} y1={inner.y}
            x2={outer.x} y2={outer.y}
            stroke={isCenter ? '#6ee7b7' : '#9ca3af'}
            strokeWidth={isCenter ? 3 : 1.5}
          />
        )
      })}

      {/* Labels */}
      {[
        { label: '♭', deg: ARC_START_DEG, offset: -12 },
        { label: '♯', deg: ARC_END_DEG, offset: 12 },
      ].map(({ label, deg, offset }) => {
        const pos = polar(CX, CY, RADIUS + 28, deg)
        return (
          <text
            key={label}
            x={pos.x + offset}
            y={pos.y + 5}
            fill="#9ca3af"
            fontSize={20}
            textAnchor="middle"
            fontFamily="serif"
          >
            {label}
          </text>
        )
      })}

      {/* Needle — animated via CSS transition on transform */}
      <g
        style={{
          transform: `rotate(${needleDeg - 270}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: 'transform 80ms ease-out',
        }}
      >
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill={color}
          opacity={0.95}
        />
      </g>

      {/* Center pivot dot */}
      <circle cx={CX} cy={CY} r={8} fill={color} />
      <circle cx={CX} cy={CY} r={4} fill="#030712" />
    </svg>
  )
}
