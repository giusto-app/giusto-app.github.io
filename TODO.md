# Giusto — TODO

Goal: Help violinists and bowed string players improve their intonation.

---

## ❓ Open decision — Play-Along start point (2026-08-09)

Raised while fixing the stale resume point on tune change (`PracticePlayback.tsx`,
`playFromResumePoint`). Full spec — state machine, the three bugs it also fixes, and
three decisions that need Marc: `PLAN_PLAYBACK_START_POINT.md`.

- [ ] clearing on start is what the space bar already did, and it means a take that plays
      through to the end leaves you back at the top rather than at the bar you once paused
      on. If you'd rather a bar you clicked on the score be sticky — so repeated plays keep
      restarting from bar 5 until you rewind — that's a different rule and I'd implement it
      by distinguishing a user-chosen start point from a pause point. Say the word if that's
      the feel you want.

---

## ✅ Recently shipped

### Play-Along: score + metronome + chord-change drones (2026-07-15)
LilyPond exercise rendered live with the modern `lilyjs` bundle; woodblock metronome +
gapless chord-following drone on one sample-accurate Web Audio clock. Plan and milestone
log: `../lilyJS/PLAN_GIUSTO_PRACTICE_PLAYBACK.md`. Remaining QA (needs a human ear /
devices):
- [ ] Listen: chord changes land on measures 1/3/5/7 of Practice Arpeggios, no clicks/gaps
- [ ] Drone tab manual regression: 3 sounds (Cello · Synth · Tanpura) × octave shift, and — on
      Synth — the now-INDEPENDENT 5th/8ve toggles (both on, either alone, both off = unison).
      The old "4 sounds × interval × octave" matrix is gone: Synth Wavy is no longer offered,
      the intervals stopped being mutually exclusive, and the default is Synth at octave 2 with
      5th + 8ve both on. Also check the space bar stops/restarts the drone on the Drone tab only.
- [ ] iOS Safari / Android Chrome (gesture-gated audio, wake lock, backgrounding)
- [ ] Follow-up: beat cursor on the score (expose `onSystemBeatX` via the vendored `lilyjs` surface)

---

## 🔴 Next Up

### Tempo Trainer · Exercise Library · Tune Memorization (planned 2026-07-15)
Full decisions + phases: `PLAN_PRACTICE_FEATURES.md`.
- [x] Phase 1: exercises-catalog.json pipeline (violin-music_private → violin-music.github.io) + Play-Along exercise picker (2026-07-15 — public-site push pending Marc's review)
- [x] Phase 1b: curated existing Practice/*.ly + authored 6 new standards — Major/Minor Arpeggios & Major Scales (circle of fifths), Dominant 7ths (circle of fourths), Minuet in G (Petzold), Ode to Joy; catalog now 33 entries (2026-07-15 — public-site push pending Marc's review)
- [x] Phase 2: Tempo Trainer — step-per-loop AND timed ramp, stepped-bars progress viz (2026-07-15)
- [ ] Phase 3: Anki-style tune memorization in Learn tab — segment cards (4-bar + chained), self-graded, publish tune .ly in catalog
- [ ] Follow-up: mic-assisted review grading — record the attempt, score vs notes.json with pitch detection + DTW, pre-select the suggested grade
- [ ] Follow-up: Tempo Trainer saved sessions (named presets with last-practiced dates, like the reference metronome app)
- [x] Push violin-music.github.io exercise assets (or just push violin-music_private and let CI regenerate) so the catalog goes live (2026-07-15)
- [x] ExercisePicker: search box across titles/keys/categories + subtitle, key, meter, bars and chord-drone badges (verified 2026-08-09)
- [ ] Exercise curation leftovers: Violin-Harmonics.ly (nine 1-bar score blocks — needs per-entry titles), Gypsy-scales.ly (WIP placeholders), Practice_All.ly (include-based aggregator); give Jig-Pulse/Practice_Shifts explicit per-score titles instead of auto "Part N"
- [x] Compound meter: metronome now clicks the meter's felt pulse via `src/audio/meter.ts` — dotted quarters for 6/8–12/8 (2 per jig bar, count-in included), halves for 2/2; also fixed \tempo unit conversion (\tempo 8 = 120 → ♩ = 60) in chordSchedule AND the catalog generator (2026-07-15)
- [ ] lilyJS parser: dotted tempo units lose their dot (\tempo 4. = 120 parses as quarter = 120, \tempo 1. = 84 as whole → Jig-Pulse part 4 shows bpm 336) — fix in ../lilyJS emit phase, re-vendor, then drop the workaround notes in chordSchedule.ts / generate-exercises-catalog.mjs
- [ ] ChordDrone.setVolume during an in-progress crossfade appends a ramp that can bend the fade curve — harden (re-anchor or cancel-and-hold)
- [ ] QA (human ear): new circle-of-fifths exercises in flat keys (Gb/Db/Ab), Minuet 3/4 downbeat accent, Ode to Joy mid-bar A→D drone change lands on beat 3

### Practice Programs
Structured scale/exercise routines the user can run with the drone playing underneath.

**MVP: Scale + Drone mode**
- User picks a scale (e.g. C major) and a drone note (e.g. C) — drone starts automatically
- App displays the scale on screen: note names in order, one highlighted at a time
- As the tuner detects each note, it advances the highlight (or user taps manually)
- At the end: intonation score per note, same color-coded display as existing Practice tab
- Preset programs to ship first:
  - One octave ascending + descending (e.g. C major)
  - Two octaves
  - Slow bow (long tones only, no rhythm)
  - Double stop perfect fifths (open strings: G-D, D-A, A-E)

**Other program ideas (later):**
- Drone on 5th (D drone while playing G scale) — trains hearing against the dominant
- Chromatic scale (all 12 notes, one octave)
- Shifting exercise (same note, different positions)
- Scales in thirds

---

## ⚠️ Important Workflow Notes

### Syncing lily-parser before committing
`lily-parser` is vendored into `packages/` for CI (GitHub Actions only checks out this repo). Its source of truth is the **lilyJS repo** (`../lilyJS/src/music-input/lilypond/`). After changing the parser there, rebuild and re-vendor:

```bash
cd ../lilyJS && bun run build:lily-parser && cd -
rm -rf packages/lily-parser
cp -r ../lilyJS/dist/lily-parser packages/lily-parser
```

`lily-viewer` is a frozen vendored build (its original sibling source no longer exists); longer term rebuild it from lilyJS's renderer, or publish both packages from lilyJS CI to eliminate the manual step.

---

## 🟡 In Progress / Pending

### Staff Rendering Comparison (`/?compare`)
- [ ] **Verify Option C — lily-viewer (LilyPond parser)**: confirm notation renders correctly at full width, intonation colors match Options A and B, and the parser handles bare `\relative` source without requiring a `\score` wrapper

---



### Drone Audio — mynoise Tanpura (local testing)
- [ ] Download mynoise tanpura files for local dev/testing (not for production until permission granted)
      URLs: `https://mynoise.world/Data/TANPURA/{0-9}{a|b}.mp3`
      Note: fixed C# pitch instrument — not chromatic. Use as texture/reference only.

---

## 🟢 Feature Backlog

### Learn Tab — Spaced Repetition Practice Queue
Full research and implementation plan in `LEARN-TAB-RESEARCH.md`.

**Phase 1 — MVP** ✅ shipped (ticked 2026-08-09 — the boxes lagged the code)
- [x] Tune browser: fetch catalog from violin-music.github.io, filter by difficulty/genre
- [x] Tune detail: display SVG score, MIDI reference playback, "add to queue" button
- [x] Practice view: SVG score + live pitch meter + self-grade 1–4
- [x] FSRS-simplified scheduling algorithm (`src/utils/spaceRepetition.ts`)
- [x] localStorage CRUD for learn items (`src/utils/learnStorage.ts`)
- [x] Add Learn tab to TabBar

**Phase 2 — Measure highlighting**
- [ ] Parse MIDI to extract measure timestamps → overlay highlight on SVG

**Phase 3 — Automated grading**
- [ ] Run pitch detection during attempt → suggest grade based on % in tune

---

### Tuner Improvements
- [ ] **Vibrato detection**: detect and display vibrato width in cents and rate in Hz
- [ ] **Interval detection**: when playing double stops, identify the interval (fifth, third, etc.) and show whether it's in tune for the selected temperament
- [ ] **Drone + Tuner together**: show how far the played note is from the drone pitch (not just from equal temperament)

### Drone Improvements
- [ ] **Second tanpura octave**: add pitch-shifted "octave up" version (playbackRate × 2) for female voice / higher register
- [ ] **Ma tuning option for tanpura**: download and add `mc.wav`-style Ma-Sa-Sa-Sa set as alternate tanpura tuning
- [ ] **Indian Drone (mynoise)**: add as 5th sound type once permission granted (spectral bands, not note-specific)

### Practice Tab Improvements
- [ ] **Drone tonic display**: show which note the drone is on alongside the scale name
- [ ] **Long tone exercise**: specialized mode — hold each scale note for N seconds, score only if sustained cleanly

### Progress Tab Improvements
- [ ] **Per-note trend**: track intonation tendency per pitch class over time (e.g. "your F# is consistently 12¢ sharp")
- [ ] **Export**: export session history as CSV

### Guide Tab
- [ ] **Practice program guide**: explain what each practice program trains and why
- [ ] **Drone usage guide**: when to use tanpura vs cello vs synth, what to listen for

---

## ✅ Completed (this session)

- Drone: fixed F note octave drop bug
- Drone: octave shift buttons (▼ oct / ▲ oct)
- Drone: ON/OFF toggle switch
- Drone: note display with octave number (e.g. D#4)
- Drone: meaningful IDs on all elements
- Drone: Sound type selector (Synth Pure · Synth Wavy · Tanpura · Cello)
- Drone: Shruti Box synthesis (reed waveform, chorus, tremolo) — renamed to Synth Wavy
- Drone: Cello sample engine — VSCO2 CE CC0 samples, 13 pitches C2–F5
- Drone: Tanpura sample engine — 12 chromatic WAV files, octave 3
- Drone: auto-set octave 2 when switching to Cello
- Drone: labeled samples with octave notation (01_C3.wav, 01_C2_forte.wav, etc.)
- Drone: permission email drafts for carnaticmusicexams.in and mynoise.net
