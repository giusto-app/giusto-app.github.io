import { centsToHsl } from '../../utils/colorUtils'
import { formatCents } from '../../utils/noteUtils'
import type { NoteEvent } from '../../utils/sessions'

// ── Staff geometry ────────────────────────────────────────────────────────────
const STAFF_TOP = 24       // y of the top staff line (F5)
const LINE_SPACING = 10    // px between adjacent staff lines (matches VexFlow default)
const STEP_HEIGHT = LINE_SPACING / 2   // px per diatonic step
const BOTTOM_LINE_Y = STAFF_TOP + 4 * LINE_SPACING  // E4 = y 64
const LEFT_MARGIN = 48     // space for treble clef
const NOTE_SPACING = 42    // horizontal px between note centers
const NOTE_RX = 7          // note head ellipse x-radius
const NOTE_RY = 4          // note head ellipse y-radius
const NOTE_TILT = -20      // degrees — matches LilyPond/Bravura notehead tilt
const STEM_WIDTH = 1.5
const SVG_HEIGHT = 115     // total height (notes + labels below)

// Diatonic step from C (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
const NOTE_BASE_TO_DIATONIC: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}

// E4 diatonic reference (bottom staff line)
// E = diatonic 2, octave 4 → 4*7+2 = 30
const E4_DIATONIC = 30

// Use noteName (e.g. 'Bb', 'F#', 'E') so sharps and flats land on the correct line
function noteNameToStaffStep(noteName: string, octave: number): number {
  const base = noteName[0]!.toUpperCase()
  const diatonicClass = NOTE_BASE_TO_DIATONIC[base] ?? 0
  return octave * 7 + diatonicClass - E4_DIATONIC
}

function staffStepToY(step: number): number {
  return BOTTOM_LINE_Y - step * STEP_HEIGHT
}

// Which even steps need ledger lines for a note at `step`
function ledgerLines(step: number): number[] {
  const lines: number[] = []
  if (step <= -2) {
    const limit = step % 2 === 0 ? step : step + 1
    for (let s = -2; s >= limit; s -= 2) lines.push(s)
  } else if (step >= 10) {
    const limit = step % 2 === 0 ? step : step - 1
    for (let s = 10; s <= limit; s += 2) lines.push(s)
  }
  return lines
}

// ── Component ─────────────────────────────────────────────────────────────────

interface StaffViewProps {
  noteEvents: NoteEvent[]
}

export default function StaffView({ noteEvents }: StaffViewProps) {
  if (noteEvents.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-4">
        No notes detected
      </div>
    )
  }

  const noteCount = noteEvents.length
  const svgWidth = LEFT_MARGIN + noteCount * NOTE_SPACING + 20
  const staffRight = svgWidth - 8

  // Staff line y positions
  const staffLines = [0, 1, 2, 3, 4].map(i => STAFF_TOP + i * LINE_SPACING)

  return (
    <div className="overflow-x-auto w-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${SVG_HEIGHT}`}
        width={svgWidth}
        height={SVG_HEIGHT}
        className="block"
        aria-label="Music staff showing played notes"
      >
        {/* ── Staff lines ── */}
        {staffLines.map((y, i) => (
          <line key={i} x1={8} y1={y} x2={staffRight} y2={y}
            stroke="#374151" strokeWidth={1.2} />
        ))}

        {/* ── Treble clef glyph ── */}
        {/* Scale and position to match the 10px line-spacing staff */}
        <text
          x={4} y={72}
          fill="#6b7280"
          fontSize={86}
          fontFamily="serif"
          dominantBaseline="auto"
        >
          𝄞
        </text>

        {/* ── Notes ── */}
        {noteEvents.map((event, idx) => {
          const step = noteNameToStaffStep(event.noteName, event.octave)
          const noteY = staffStepToY(step)
          const noteX = LEFT_MARGIN + idx * NOTE_SPACING + NOTE_SPACING / 2
          const color = centsToHsl(event.absCentsAvg)

          const isSharp = event.noteName.includes('#')
          const isFlat = event.noteName.at(1) === 'b'
          const hasAcc = isSharp || isFlat

          const lLines = ledgerLines(step)

          // Stem: up when below middle line (B4 = step 4), down otherwise.
          // At -20° tilt the ellipse boundary at y=noteY is x=noteX±6.72.
          // NOTE_RX-2 = 5 keeps the stem 1.72px inside that boundary (clear of the
          // antialiased edge), so the notehead drawn on top fully covers the junction.
          const stemUp = step < 4
          const stemX = stemUp ? noteX + NOTE_RX - 2 : noteX - NOTE_RX + 2
          const stemY2 = stemUp
            ? noteY - 3.5 * LINE_SPACING
            : noteY + 3.5 * LINE_SPACING

          return (
            <g key={idx}>
              {/* Ledger lines */}
              {lLines.map(ls => {
                const ly = staffStepToY(ls)
                return (
                  <line key={ls}
                    x1={noteX - NOTE_RX - 4} y1={ly}
                    x2={noteX + NOTE_RX + 4} y2={ly}
                    stroke="#374151" strokeWidth={1.2}
                  />
                )
              })}

              {/* Accidental symbol */}
              {hasAcc && (
                <text
                  x={noteX - NOTE_RX - 4}
                  y={noteY + (isFlat ? 3 : 4)}
                  fill={color}
                  fontSize={16}
                  textAnchor="end"
                  fontFamily="Bravura, Leland, serif"
                >
                  {isFlat ? '♭' : '♯'}
                </text>
              )}

              {/* Stem */}
              <line
                x1={stemX} y1={noteY}
                x2={stemX} y2={stemY2}
                stroke={color}
                strokeWidth={STEM_WIDTH}
              />

              {/* Note head — tilted oval like real music notation */}
              <ellipse
                cx={noteX} cy={noteY}
                rx={NOTE_RX} ry={NOTE_RY}
                fill={color}
                transform={`rotate(${NOTE_TILT}, ${noteX}, ${noteY})`}
              />

              {/* Note name label below staff */}
              <text
                x={noteX} y={SVG_HEIGHT - 22}
                fill="#9ca3af"
                fontSize={9}
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {event.noteName}{event.octave}
              </text>

              {/* Cents label */}
              <text
                x={noteX} y={SVG_HEIGHT - 8}
                fill={color}
                fontSize={9}
                fontWeight="600"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {formatCents(event.avgCents)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
