# Giusto — TODO

Goal: Help violinists and bowed string players improve their intonation.

---

## 🔴 Next Up

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

## 🟡 In Progress / Pending

### Staff Rendering Comparison (`/?compare`)
- [ ] **Verify Option C — lily-viewer (LilyPond parser)**: confirm notation renders correctly at full width, intonation colors match Options A and B, and the parser handles bare `\relative` source without requiring a `\score` wrapper

---

### Drone Audio — Permission Emails
- [ ] Send permission request to **carnaticmusicexams.in** for tanpura WAV files
      → Draft ready in `PERMISSION-EMAILS.md`
- [ ] Send permission request to **mynoise.net** (Stéphane Pigeon) for Shruti Box + Tanpura + Indian Drone samples
      → Draft ready in `PERMISSION-EMAILS.md`

### Drone Audio — mynoise Tanpura (local testing)
- [ ] Download mynoise tanpura files for local dev/testing (not for production until permission granted)
      URLs: `https://mynoise.world/Data/TANPURA/{0-9}{a|b}.mp3`
      Note: fixed C# pitch instrument — not chromatic. Use as texture/reference only.

---

## 🟢 Feature Backlog

### Learn Tab — Spaced Repetition Practice Queue
Full research and implementation plan in `LEARN-TAB-RESEARCH.md`.

**Phase 1 — MVP**
- [ ] Tune browser: fetch catalog from violin-music.github.io, filter by difficulty/genre
- [ ] Tune detail: display SVG score, MIDI reference playback, "add to queue" button
- [ ] Practice view: SVG score + live pitch meter + self-grade 1–4
- [ ] FSRS-simplified scheduling algorithm (`src/utils/spaceRepetition.ts`)
- [ ] localStorage CRUD for learn items (`src/utils/learnStorage.ts`)
- [ ] Add Learn tab to TabBar

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
