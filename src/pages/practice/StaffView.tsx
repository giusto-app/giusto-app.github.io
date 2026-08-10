import { useEffect, useState } from 'react'
import { centsToHsl } from '../../utils/colorUtils'
import { formatCents } from '../../utils/noteUtils'
import { ensureMusicFont } from '../../musicFont'
import type { NoteEvent } from '../../utils/sessions'

// ── Staff geometry ────────────────────────────────────────────────────────────
const STAFF_TOP        = 24   // y of top staff line (F5)
const LINE_SPACING     = 10   // px between staff lines (= Tables.STAVE_LINE_DISTANCE)
const STEP_HEIGHT      = LINE_SPACING / 2   // px per diatonic half-step
const BOTTOM_LINE_Y    = STAFF_TOP + 4 * LINE_SPACING  // E4 = y 64
const LEFT_MARGIN      = 44   // x where notes start (space for clef)
const NOTE_SPACING     = 42   // horizontal px between note centres
const SVG_HEIGHT       = 120  // total SVG height (staff + labels)

// G4 line = 2nd staff line from bottom, 3rd from top (0-indexed).
// In treble clef the gClef glyph's baseline anchors here.
// G is 2 diatonic steps above E: BOTTOM_LINE_Y - 2 * STEP_HEIGHT = 64 - 10 = 54
const G4_LINE_Y = BOTTOM_LINE_Y - 2 * STEP_HEIGHT   // = 54

// ── Bravura / SMuFL glyph constants (matching VexFlow exactly) ────────────────
// VexFlow source: Tables.NOTATION_FONT_SCALE = 39 (pt), Tables.STEM_HEIGHT = 35,
// Tables.STEM_WIDTH = 1.5.  Clef uses Metrics.fontSize = 30 (pt).
// All pt sizes are set as CSS "pt" strings so the browser applies the 4/3 conversion.
const NOTEHEAD_GLYPH = '\uE0A4'   // SMuFL noteheadBlack
const NOTEHEAD_SIZE  = '39pt'     // = VexFlow NOTATION_FONT_SCALE (browser → ~52 px)
const ACC_SIZE       = '39pt'     // accidentals at the same scale
const CLEF_SIZE      = '30pt'     // = VexFlow Metrics.fontSize (browser → 40 px)

// Half of the notehead advance width at 39pt.
// SMuFL: noteheadBlack = 1.18 staff spaces; 1 space = 0.25 em; 39pt ≈ 52 px
// → width ≈ 1.18 × 0.25 × 52 ≈ 15.3 px → halfW ≈ 7.65 px
const NOTEHEAD_HALF_W = 7.65

// VexFlow stem X is inset by half the stem width from the glyph edge
// (Tables.STEM_WIDTH / 2 = 0.75 px)
const STEM_X_INSET = 0.75

// VexFlow: stem starts at noteY exactly (yTop = yBottom = noteY for a single notehead)
const STEM_HEIGHT = 35         // px — Tables.STEM_HEIGHT
const STEM_WIDTH  = 1.5        // px — Tables.STEM_WIDTH
const STEM_COLOR  = '#9ca3af'

// Fallback ellipse (shown while Bravura font is still loading)
const NOTE_RX   = 5.5
const NOTE_RY   = 3.8
const NOTE_TILT = -27

// ── Diatonic helpers ──────────────────────────────────────────────────────────
const NOTE_BASE_TO_DIATONIC: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}
// E4 diatonic index: octave 4 × 7 + diatonic 2 = 30
const E4_DIATONIC = 30

function noteNameToStaffStep(noteName: string, octave: number): number {
  const base = noteName[0]!.toUpperCase()
  const diatonicClass = NOTE_BASE_TO_DIATONIC[base] ?? 0
  return octave * 7 + diatonicClass - E4_DIATONIC
}

function staffStepToY(step: number): number {
  return BOTTOM_LINE_Y - step * STEP_HEIGHT
}

// Even steps that need ledger lines when a note sits at `step`
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
  showCentsLabels?: boolean
  showNoteLabels?: boolean
  noteColor?: string
}

export default function StaffView({ noteEvents, showCentsLabels = true, showNoteLabels = true, noteColor }: StaffViewProps) {
  // ASK for the font rather than waiting to see whether something else loads
  // it. The comment here used to credit VexFlow with injecting Bravura; that
  // stopped being true when the app moved to lilyjs, and the 100 ms poll it
  // justified ran forever on any page where the font never arrived — which,
  // on the Learn tab, was every page. See src/musicFont.ts.
  const [bravuraReady, setBravuraReady] = useState(() =>
    typeof document !== 'undefined' && document.fonts.check('1em Bravura')
  )
  useEffect(() => {
    if (bravuraReady) return
    let cancelled = false
    void ensureMusicFont().then(ok => {
      if (ok && !cancelled) setBravuraReady(true)
    })
    return () => { cancelled = true }
  }, [bravuraReady])

  if (noteEvents.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-4">
        No notes detected
      </div>
    )
  }

  const noteCount  = noteEvents.length
  const svgWidth   = LEFT_MARGIN + noteCount * NOTE_SPACING + 20
  const svgH       = showCentsLabels ? SVG_HEIGHT : showNoteLabels ? 112 : 96
  const staffLeft  = 8
  const staffRight = svgWidth - 8
  const staffLines = [0, 1, 2, 3, 4].map(i => STAFF_TOP + i * LINE_SPACING)

  // Notehead half-width used for ledger lines and stem attachment
  const halfW = bravuraReady ? NOTEHEAD_HALF_W : NOTE_RX

  return (
    <div className="overflow-x-auto w-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgH}`}
        width={svgWidth}
        height={svgH}
        className="block"
        aria-label="Music staff showing played notes"
      >
        {/* ── Staff lines ── */}
        {staffLines.map((y, i) => (
          <line key={i} x1={staffLeft} y1={y} x2={staffRight} y2={y}
            stroke="#374151" strokeWidth={1.2} />
        ))}

        {/* ── Opening bar line ── */}
        <line x1={staffLeft} y1={STAFF_TOP} x2={staffLeft} y2={BOTTOM_LINE_Y}
          stroke="#374151" strokeWidth={1.2} />

        {/* ── Closing bar line ── */}
        <line x1={staffRight} y1={STAFF_TOP} x2={staffRight} y2={BOTTOM_LINE_Y}
          stroke="#374151" strokeWidth={1.2} />

        {/* ── Treble clef — gClef (U+E050) anchored on the G4 line ── */}
        {bravuraReady ? (
          <text
            x={10}
            y={G4_LINE_Y}
            fill="#6b7280"
            fontSize={CLEF_SIZE}
            fontFamily="Bravura"
          >
            {'\uE050'}
          </text>
        ) : (
          <text
            x={6} y={G4_LINE_Y + 12}
            fill="#6b7280"
            fontSize={58}
            fontFamily="serif"
            dominantBaseline="auto"
          >
            𝄞
          </text>
        )}

        {/* ── Notes ── */}
        {noteEvents.map((event, idx) => {
          const step  = noteNameToStaffStep(event.noteName, event.octave)
          const noteY = staffStepToY(step)
          const noteX = LEFT_MARGIN + idx * NOTE_SPACING + NOTE_SPACING / 2
          const color = noteColor ?? centsToHsl(event.absCentsAvg)

          const isSharp = event.noteName.includes('#')
          const isFlat  = event.noteName.at(1) === 'b'
          const hasAcc  = isSharp || isFlat

          const lLines = ledgerLines(step)

          // VexFlow: stem UP for notes below the middle line (B4 = step 4)
          const stemUp = step < 4

          // VexFlow stem X: right edge − 0.75 for UP, left edge + 0.75 for DOWN
          const stemX = stemUp
            ? noteX + halfW - STEM_X_INSET
            : noteX - halfW + STEM_X_INSET

          // VexFlow stem Y: starts exactly at noteY (yTop = yBottom = noteY),
          // extends STEM_HEIGHT px in the stem direction
          const stemY1 = noteY
          const stemY2 = stemUp ? noteY - STEM_HEIGHT : noteY + STEM_HEIGHT

          return (
            <g key={idx}>
              {/* Ledger lines */}
              {lLines.map(ls => {
                const ly = staffStepToY(ls)
                return (
                  <line key={ls}
                    x1={noteX - halfW - 4} y1={ly}
                    x2={noteX + halfW + 4} y2={ly}
                    stroke="#374151" strokeWidth={1.2}
                  />
                )
              })}

              {/* Accidental — SMuFL glyphs when Bravura is ready */}
              {hasAcc && (
                bravuraReady ? (
                  <text
                    x={noteX - halfW - 1}
                    y={noteY}
                    fill={color}
                    fontSize={ACC_SIZE}
                    textAnchor="end"
                    fontFamily="Bravura"
                  >
                    {isFlat ? '\uE260' : '\uE262'}
                  </text>
                ) : (
                  <text
                    x={noteX - NOTE_RX - 3}
                    y={noteY + 5}
                    fill={color}
                    fontSize={22}
                    textAnchor="end"
                    fontFamily="Bravura, Leland, serif"
                  >
                    {isFlat ? '♭' : '♯'}
                  </text>
                )
              )}

              {/* Stem */}
              <line
                x1={stemX} y1={stemY1}
                x2={stemX} y2={stemY2}
                stroke={STEM_COLOR}
                strokeWidth={STEM_WIDTH}
              />

              {/* Note head */}
              {bravuraReady ? (
                <text
                  x={noteX}
                  y={noteY}
                  fontSize={NOTEHEAD_SIZE}
                  fontFamily="Bravura"
                  fill={color}
                  textAnchor="middle"
                >
                  {NOTEHEAD_GLYPH}
                </text>
              ) : (
                <ellipse
                  cx={noteX} cy={noteY}
                  rx={NOTE_RX} ry={NOTE_RY}
                  fill={color}
                  transform={`rotate(${NOTE_TILT}, ${noteX}, ${noteY})`}
                />
              )}

              {/* Note name label */}
              {showNoteLabels && (
                <text
                  x={noteX} y={107}
                  fill="#9ca3af"
                  fontSize={9}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {event.noteName}{event.octave}
                </text>
              )}
              {/* Cents label */}
              {showCentsLabels && (
                <text
                  x={noteX} y={SVG_HEIGHT - 2}
                  fill={color}
                  fontSize={9}
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {formatCents(event.avgCents)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
