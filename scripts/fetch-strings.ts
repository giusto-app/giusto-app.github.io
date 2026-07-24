// Download the string-ensemble backing samples.
//
// Source: FluidR3_GM `string_ensemble_1` per-note MP3s from
// gleitz/midi-js-soundfonts (soundfont licensed CC-BY 3.0). We self-host a
// spread of notes (thirds apart) in public/sounds/strings/; the runtime loader
// pitch-shifts to the nearest sample, exactly like the cello set.
//
// Run once (needs network):  bun run scripts/fetch-strings.ts
//
// Attribution (keep in the app credits): FluidR3_GM soundfont, CC-BY 3.0.

import { mkdir } from 'node:fs/promises'

const BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/string_ensemble_1-mp3'
const OUT = 'public/sounds/strings'

// Natural notes ~a third apart across C2–C6 — nearest-sample shift stays under
// ~1.5 semitones. All naturals (no #/b) to keep URLs simple.
const NOTES = ['C2', 'E2', 'G2', 'B2', 'D3', 'F3', 'A3', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6']

await mkdir(OUT, { recursive: true })

let ok = 0
for (const note of NOTES) {
  const url = `${BASE}/${note}.mp3`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`✗ ${note}: HTTP ${res.status}`)
      continue
    }
    await Bun.write(`${OUT}/${note}.mp3`, await res.arrayBuffer())
    ok++
    console.log(`✓ ${note}.mp3`)
  } catch (err) {
    console.error(`✗ ${note}: ${(err as Error).message}`)
  }
}

console.log(`\nDownloaded ${ok}/${NOTES.length} string samples into ${OUT}/`)
if (ok < NOTES.length) console.log('Some notes failed — re-run to retry the missing ones.')
console.log('Attribution (CC-BY 3.0): FluidR3_GM soundfont via gleitz/midi-js-soundfonts.')
