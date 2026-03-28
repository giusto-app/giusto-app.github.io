import { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow'
import { centsToHsl } from '../../utils/colorUtils'

interface NoteData {
  midiNote: number
  noteName: string
  octave: number
  pitchClass: number
  avgCents: number
  absCentsAvg: number
}

interface StaffViewVexFlowProps {
  noteEvents: NoteData[]
}

function toVFKey(noteName: string, octave: number): string {
  // VexFlow key format: "c/4", "d#/5", "bb/3"
  return `${noteName.toLowerCase().replace('#', '#')}/${octave}`
}

export default function StaffViewVexFlow({ noteEvents }: StaffViewVexFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || noteEvents.length === 0) return
    el.innerHTML = ''

    const staveX = 10
    const staveY = 30
    const staveWidth = Math.max(300, 50 + noteEvents.length * 55)
    const svgHeight = 170

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(staveWidth + 20, svgHeight)

    const context = renderer.getContext()
    // Style staff lines and clef to be visible on dark background
    context.setFillStyle('#9ca3af')
    context.setStrokeStyle('#6b7280')

    const stave = new Stave(staveX, staveY, staveWidth)
    stave.addClef('treble')
    stave.setContext(context).draw()

    const vfNotes = noteEvents.map(event => {
      const key = toVFKey(event.noteName, event.octave)
      const note = new StaveNote({ keys: [key], duration: 'q' })
      const color = centsToHsl(event.absCentsAvg)
      note.setStyle({ fillStyle: color, strokeStyle: color })
      if (event.noteName.includes('#')) {
        const acc = new Accidental('#')
        acc.setFontSize(20)
        note.addModifier(acc)
      } else if (event.noteName.at(1) === 'b') {
        const acc = new Accidental('b')
        acc.setFontSize(20)
        note.addModifier(acc)
      }
      return note
    })

    const voice = new Voice({ numBeats: noteEvents.length, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables(vfNotes)
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 80)
    voice.draw(context, stave)

    // Tint staff lines/clef for dark background; hide stems for cleaner look
    const svg = el.querySelector('svg')
    if (svg) {
      svg.style.background = 'transparent'
      // Color non-note paths (staff lines, clef) to gray
      svg.querySelectorAll('path:not([style*="fill"])').forEach(p => {
        ;(p as SVGElement).style.stroke = '#4b5563'
        ;(p as SVGElement).style.fill = '#4b5563'
      })
      // Tint stems to match their notehead color (already set via setStyle)
      svg.querySelectorAll('.vf-stem').forEach(s => {
        ;(s as SVGElement).style.stroke = '#9ca3af'
      })
    }
  }, [noteEvents])

  return <div ref={containerRef} className="overflow-x-auto" />
}
