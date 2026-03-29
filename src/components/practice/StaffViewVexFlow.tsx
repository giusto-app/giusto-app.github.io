import { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow'
import { centsToHsl } from '../../utils/colorUtils'
import { formatCents } from '../../utils/noteUtils'

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
  return `${noteName.toLowerCase().replace('#', '#')}/${octave}`
}

export default function StaffViewVexFlow({ noteEvents }: StaffViewVexFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || noteEvents.length === 0) return
    el.innerHTML = ''

    const staveX = 10
    const staveY = 40
    const staveWidth = Math.max(300, 50 + noteEvents.length * 55)
    const svgHeight = 140

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(staveWidth + 20, svgHeight)

    const context = renderer.getContext()
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

    const svg = el.querySelector('svg')
    if (svg) {
      svg.style.background = 'transparent'
      svg.querySelectorAll('path:not([style*="fill"])').forEach(p => {
        ;(p as SVGElement).style.stroke = '#4b5563'
        ;(p as SVGElement).style.fill = '#4b5563'
      })
      svg.querySelectorAll('.vf-stem').forEach(s => {
        ;(s as SVGElement).style.stroke = '#9ca3af'
      })
    }

    // ── Labels: separate SVG appended after VexFlow's SVG ────────────────────
    // We must NOT modify VexFlow's SVG because it sets its own viewBox.
    // Instead we create a sibling SVG sized to the same width, only tall enough
    // for the two label rows.
    const labelSvgH = 30
    const ns = 'http://www.w3.org/2000/svg'
    const labelSvg = document.createElementNS(ns, 'svg')
    labelSvg.setAttribute('width', String(staveWidth + 20))
    labelSvg.setAttribute('height', String(labelSvgH))
    labelSvg.setAttribute('viewBox', `0 0 ${staveWidth + 20} ${labelSvgH}`)
    labelSvg.style.display = 'block'
    labelSvg.style.marginTop = '-4px'  // close the gap between the two SVGs

    vfNotes.forEach((vfNote, i) => {
      const event = noteEvents[i]!
      const x = vfNote.getAbsoluteX()
      const color = centsToHsl(event.absCentsAvg)

      const nameEl = document.createElementNS(ns, 'text')
      nameEl.setAttribute('x', String(x))
      nameEl.setAttribute('y', '11')
      nameEl.setAttribute('fill', '#9ca3af')
      nameEl.setAttribute('font-size', '9')
      nameEl.setAttribute('text-anchor', 'middle')
      nameEl.setAttribute('font-family', 'sans-serif')
      nameEl.textContent = `${event.noteName}${event.octave}`
      labelSvg.appendChild(nameEl)

      const centsEl = document.createElementNS(ns, 'text')
      centsEl.setAttribute('x', String(x))
      centsEl.setAttribute('y', '24')
      centsEl.setAttribute('fill', color)
      centsEl.setAttribute('font-size', '9')
      centsEl.setAttribute('font-weight', '600')
      centsEl.setAttribute('text-anchor', 'middle')
      centsEl.setAttribute('font-family', 'monospace')
      centsEl.textContent = formatCents(event.avgCents)
      labelSvg.appendChild(centsEl)
    })

    el.appendChild(labelSvg)
  }, [noteEvents])

  return <div ref={containerRef} className="overflow-x-auto" />
}
