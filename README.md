# Giusto — Practice & Intonation trainer for bowed string players

A web app that helps violinists, violists, cellists, and double bassists improve their pitch accuracy in real time. Play your instrument — the app listens, detects the pitch, and tells you how close you are to being in tune.

Works on iPhone, Android, and desktop. No install required. Installable as a PWA.

---

## Features

**Tuner**
Real-time pitch detection with a centered bar meter, note name, frequency, and cents deviation. Color-coded green/amber/red feedback. Sympathetic resonance indicator lights up when a stopped note causes an open string to ring.

**Drone**
Sustained reference tone in any of the 12 chromatic pitches. Choose unison, octave, or perfect fifth intervals — like a teacher's drone bow. Tap a note to start it; tap again to stop.

**Practice**
Record a 10s/30s/60s/Free session while playing a scale. After recording, review your results on a music staff and note table showing average deviation per note.

**Play-Along** (Practice tab)
Open a LilyPond exercise (e.g. Practice Arpeggios), rendered live with the lilyJS engine, and press Play: a synthesized woodblock metronome clicks every beat (accented downbeats, optional 1-bar count-in) while a drone sounds each chord's root + fifth and crossfades gaplessly on every chord change — all scheduled sample-accurately on one Web Audio clock. Tempo 40–208 BPM live, loop mode, per-voice volumes, three drone sounds (synth/shruti/cello). Key files: `src/audio/{playbackClock,woodblock,chordDrone,chordSchedule,droneVoices,audioContext}.ts`, `src/pages/practice/{PracticePlayback,LilyScore}.tsx`, exercise in `public/exercises/`.

**Scales**
40+ scales organized by Common (open-string keys), Full Circle of Fifths, and Gypsy & Pentatonic. Drone tonic auto-follows the selected scale.

**Progress**
Every session is saved locally. A bar chart shows your in-tune percentage over time. Track which sessions you're improving.

**Temperaments**
Switch between Equal, Pythagorean, Just, and Meantone. 0¢ always means in tune for the selected system.

**Concert Pitch**
Configurable A from 415 Hz (Baroque) to 444 Hz. Affects tuner and drone. Persisted between sessions.

---

## Who It's For

- Beginners learning to hear and correct their intonation
- Intermediate players working on consistent left-hand frame
- Advanced players fine-tuning temperament for different contexts
- Teachers who want students practicing independently with objective feedback

---

## How to Practice

1. **Tune your instrument** — Tuner tab, long tones on each open string
2. **Play a drone** — set it to your scale's tonic, play scales above it and listen for beating
3. **Record a scale** — Practice tab, 30s or 60s for a full scale
4. **Study the results** — which notes are consistently amber or red?
5. **Track over time** — save every session, watch the Progress chart

---

## Running Locally

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). For mobile testing:

```bash
bun run dev --host
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Build | Vite 6 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 4 |
| Pitch Detection | Pitchy 4 (McLeod Pitch Method) |
| Audio | Web Audio API |
| Persistence | localStorage |
| Staff / Charts | Custom SVG |
| PWA | vite-plugin-pwa + Workbox |

See [REQUIREMENTS.md](REQUIREMENTS.md) for detailed functional specifications.

---

## Monorepo Structure

`lily-parser` and `lily-viewer` are developed as sibling directories alongside this app and vendored into `packages/` so CI (GitHub Actions) has everything it needs in a single checkout.

```
giusto-app/
└── packages/
    ├── lily-parser/   # LilyPond parser (vendored copy)
    └── lily-viewer/   # SVG notation renderer (vendored copy)
```

Vite and TypeScript resolve `lily-parser` and `lily-viewer` from their compiled dist files in `packages/`.

### ⚠️ Keeping packages in sync

The source of truth for `lily-parser` **and** `lilyjs` is the **lilyJS repo** (`../lilyJS`,
parser source in `src/music-input/lilypond/`). After changing lilyJS, rebuild and re-vendor:

```bash
# Modern bundle (parseSource → music-model, renderLily — used by Play-Along):
bash scripts/sync-lilyjs.sh   # builds lilyJS, copies packages/lilyjs + public/lilyjs/fonts
# packages/lilyjs/index.d.ts is hand-maintained — extend it if you use more of the API.

# Legacy ParsedTune bundle (used by StaffViewLilyPond):
cd ../lilyJS && bun run build:lily-parser && cd -
rm -rf packages/lily-parser
cp -r ../lilyJS/dist/lily-parser packages/lily-parser
```

`lily-viewer` is still a frozen vendored build (its original sibling source directory no
longer exists); its `StaffView` consumes the `ParsedTune` produced by `lily-parser`.
Longer term it should also be rebuilt from lilyJS's renderer.

**Longer term:** publish `lily-parser`/`lily-viewer` from lilyJS CI so the manual re-vendor step disappears.
