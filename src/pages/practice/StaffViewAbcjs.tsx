import { useEffect, useId, useRef } from 'react'
import abcjs from 'abcjs'
import { centsToHsl } from '../../utils/colorUtils'

interface NoteData {
  midiNote: number
  noteName: string
  octave: number
  pitchClass: number
  avgCents: number
  absCentsAvg: number
}

interface StaffViewAbcjsProps {
  noteEvents: NoteData[]
}

function toAbcNote(noteName: string, octave: number): string {
  const isSharp = noteName.includes('#')
  const isFlat = noteName.at(1) === 'b'
  const prefix = isSharp ? '^' : isFlat ? '_' : ''
  const base = noteName[0]!  // just the letter: 'B' from 'Bb', 'F' from 'F#'

  // ABC: octave 4 = C D E F G A B (uppercase)
  //      octave 5 = c d e f g a b (lowercase)
  //      octave 3 = C, D, E, ... (comma suffix)
  //      octave 6 = c' d' e' ...
  if (octave === 5) return prefix + base.toLowerCase()
  if (octave === 4) return prefix + base.toUpperCase()
  if (octave === 6) return prefix + base.toLowerCase() + "'"
  if (octave === 3) return prefix + base.toUpperCase() + ','
  return prefix + base.toUpperCase()
}

export default function StaffViewAbcjs({ noteEvents }: StaffViewAbcjsProps) {
  const divId = useId().replace(/:/g, '-')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || noteEvents.length === 0) return

    // Build ABC notation string — each note as a quarter note (default length L:1/4)
    const noteStr = noteEvents.map(e => toAbcNote(e.noteName, e.octave)).join(' ')
    const staffWidth = Math.max(360, noteEvents.length * 55)
    const abc = [
      'X:1',
      'M:none',
      'L:1/4',
      'K:C treble',
      noteStr,
    ].join('\n')

    abcjs.renderAbc(divId, abc, {
      add_classes: true,
      staffwidth: staffWidth,
      scale: 1.15,
      responsive: 'resize',
    })

    // Post-render: color noteheads by intonation, fix dark-theme visibility
    const svg = el.querySelector('svg')
    if (!svg) return

    // Make staff lines and clef visible on dark background
    svg.style.background = 'transparent'
    svg.querySelectorAll('path, ellipse, rect, polygon').forEach(el => {
      const svgEl = el as SVGElement
      if (!svgEl.classList.contains('abcjs-notehead')) {
        svgEl.style.fill = '#4b5563'
        svgEl.style.stroke = '#4b5563'
      }
    })

    // Color each notehead
    const noteheads = svg.querySelectorAll('.abcjs-notehead')
    noteheads.forEach((el, i) => {
      const event = noteEvents[i]
      if (!event) return
      const color = centsToHsl(event.absCentsAvg)
      ;(el as SVGElement).style.fill = color
      ;(el as SVGElement).style.stroke = color
    })
  }, [noteEvents, divId])

  return <div id={divId} ref={containerRef} className="overflow-x-auto" />
}
