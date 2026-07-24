// Download the backing instrument samples.
//
// Source: FluidR3_GM per-note MP3s from gleitz/midi-js-soundfonts (soundfont
// licensed CC-BY 3.0). We self-host a spread of notes per instrument in
// public/sounds/<dir>/; the runtime loader pitch-shifts to the nearest sample.
//
// Run once (needs network):  bun run scripts/fetch-samples.ts
//
// Attribution (keep in the app credits): FluidR3_GM soundfont, CC-BY 3.0.

import { mkdir } from 'node:fs/promises'

const BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM'

// Natural notes only (no #/b) so URLs stay simple; the loader pitch-shifts to
// the nearest. Spreads chosen to keep shifts small across each instrument's range.
const INSTRUMENTS: { soundfont: string; dir: string; notes: string[] }[] = [
  {
    soundfont: 'string_ensemble_1',
    dir: 'strings',
    notes: ['C2', 'E2', 'G2', 'B2', 'D3', 'F3', 'A3', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6'],
  },
  {
    soundfont: 'acoustic_bass',
    dir: 'bass',
    notes: ['E1', 'G1', 'C2', 'E2', 'G2', 'C3', 'E3', 'G3'],
  },
  {
    soundfont: 'acoustic_guitar_steel',
    dir: 'guitar',
    notes: ['E2', 'G2', 'C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5', 'E5'],
  },
]

for (const { soundfont, dir, notes } of INSTRUMENTS) {
  const out = `public/sounds/${dir}`
  await mkdir(out, { recursive: true })
  let ok = 0
  for (const note of notes) {
    try {
      const res = await fetch(`${BASE}/${soundfont}-mp3/${note}.mp3`)
      if (!res.ok) {
        console.error(`✗ ${dir}/${note}: HTTP ${res.status}`)
        continue
      }
      await Bun.write(`${out}/${note}.mp3`, await res.arrayBuffer())
      ok++
    } catch (err) {
      console.error(`✗ ${dir}/${note}: ${(err as Error).message}`)
    }
  }
  console.log(`${dir}: ${ok}/${notes.length} samples (${soundfont})`)
}

console.log('\nAttribution (CC-BY 3.0): FluidR3_GM soundfont via gleitz/midi-js-soundfonts.')
