# Giusto — Functional Requirements

Detailed specifications for each feature. For a high-level overview see [README.md](README.md).

---

## R1 — Real-Time Tuner

- App accesses the device microphone with explicit user permission
- Pitch detection via the McLeod Pitch Method (Pitchy library)
- Displays note name + octave (e.g. A4, C#5), frequency in Hz, cents deviation, and concert pitch indicator (e.g. "A = 442")
- Visual tuner bar: centered fill extends left (flat) or right (sharp), color-coded by deviation magnitude
- Color thresholds:
  - **Green** ±0–10¢ (in tune)
  - **Amber** ±10–25¢ (close)
  - **Red** >±25¢ (out of tune)
- EMA smoothing (α=0.08) eliminates jitter from a steady tone
- Works on iOS Safari (AudioContext started inside a user-gesture tap)
- Sympathetic resonance indicator: when a note is within ±5¢ of a violin open string pitch class (G, D, A, E — any octave), an amber badge appears: "[string] string rings"

---

## R2 — Drone Generator

- Sustained reference tone using Web Audio API (sawtooth oscillator → lowpass filter at 1200 Hz → gain node)
- Pitch selectable across all 12 chromatic notes
- Interval modes: unison (root only), octave (root + octave above), fifth (root + perfect fifth)
- Volume adjustable via slider (0–1, default 0.35)
- Tap a note pill to start the drone on that note; tap again to stop; tap a different note to switch
- ON/OFF button for quick stop without changing note
- Drone control collapses to a single header row when inactive; expands when active
- Drone stops automatically when the tuner is stopped
- Available in both Tuner and Practice tabs
- In Practice tab, drone tonic auto-updates to the root of the selected scale

---

## R3 — Practice Recording Sessions

- User selects a scale (or Free Play), duration, and taps Record
- Duration options: 10s · 30s · 60s · Free (manual stop)
- 3-second pre-countdown (3→2→1) before recording begins
- During recording: full real-time tuner display is shown (note, Hz, meter, cents)
- Pitch samples are grouped into discrete note events:
  - Consecutive samples of the same MIDI note = one event
  - Minimum 5 samples / 100 ms to count as a note
  - Silence gap >200 ms breaks the group
- Results screen displays:
  - Score badge: overall % in tune (0–100%)
  - Summary chips: total notes, in-tune/close/off counts, avg ¢ deviation
  - Music staff (custom SVG treble clef, Bravura SMuFL font) with one colored notehead per event
  - Notehead color = smooth HSL gradient from green (0¢) to red (50+¢)
  - Cents deviation below each notehead
  - Note-by-note results table with avg ¢, duration, and deviation bar
- User can Save (stored in localStorage) or Discard
- After saving, app navigates to the Progress tab

---

## R4 — Scale Library

- Free Play / Scales top-level toggle
- Three sub-tabs when Scales is selected:

**Common** (default) — curated for open-string resonance and orchestral frequency:
- Major: G · D · A · E · C · F · Bb
- Minor: Gm · Dm · Am · Em · Cm · Bm · Fm

**Full Circle** — all 15 key signatures, horizontally scrollable:
- Sharp side (0→7 sharps): C/Am · G/Em · D/Bm · A/F#m · E/C#m · B/G#m · F#/D#m · C#/A#m
- Flat side (1→7 flats): F/Dm · Bb/Gm · Eb/Cm · Ab/Fm · Db/Bbm · Gb/Ebm · Cb/Abm

**Gypsy & Pentatonic**:
- Pentatonic major: G · D · A
- Pentatonic minor: Am · Dm · Em
- Hungarian/Gypsy minor and major, Double Harmonic

---

## R5 — Progress Tracking

- Every saved session persisted to localStorage (up to 50 sessions)
- Progress tab shows:
  - Summary stats: session count, best %, latest %, trend vs. previous
  - SVG bar chart of last 20 sessions (bar height = % in tune, colored green→red)
  - Session history list: date, scale, temperament, % in tune, avg ¢
- Sessions can be cleared individually

---

## R6 — Adjustable Concert Pitch

- Presets: A = 415, 432, 440, 441, 442, 443, 444 Hz
- Default: 440 Hz
- Affects all pitch detection and drone frequency generation
- Shown in Tuner tab as "A = {hz}" next to the frequency display
- Persisted in localStorage

---

## R7 — Temperament Selection

- 4 temperaments, switchable without restarting audio:
  - **Equal** — 12-TET; use with piano and fixed-pitch instruments
  - **Pythagorean** — pure perfect fifths (3:2); natural for melodic string playing and open strings
  - **Just** — pure thirds (5:4) and fifths (3:2); use for double stops and chamber music chords
  - **Meantone** — quarter-comma; pure major thirds; use for Baroque repertoire
- 0¢ always means in tune for the selected system
- In the Practice tab, displayed as a collapsible row showing the current selection

---

## R8 — Screen Wake Lock

- Toggle in the Tuner settings panel
- Uses the Screen Wake Lock API to prevent screen dimming during practice
- Re-acquired automatically if the page regains visibility
- Hidden if the browser does not support the API

---

## R9 — UX / UI

- Dark theme (bg-gray-950) throughout
- Mobile-first responsive layout; tablet-optimized at md: (768px+)
- Bottom tab bar: Tuner · Practice · Progress · Guide
- All tap targets ≥ 44×44 px
- iOS home-bar safe-area padding on tab bar
- Installable as a PWA (web app manifest + Workbox service worker)
- Secondary controls (Temperament, Concert Pitch, Wake Lock) collapsed behind a gear icon in the Tuner tab
- Drone control collapses to a header row when inactive

---

## R10 — Guide Tab

Educational content grounded in violin pedagogy research (Galamian, Fischer, Flesch, Zabanal 2019):

- Recommended 5-step practice workflow
- Temperament context cards explaining when to use each system
- Sympathetic resonance explanation with key resonance notes table
- Common intonation problems with fixes
- How to read practice results (notehead color meaning)

---

## Project Structure

```
src/
  hooks/
    usePitchDetection.ts      # Real-time tuner (Web Audio + Pitchy)
    useSessionRecorder.ts     # Configurable-duration practice session
    useDrone.ts               # Drone oscillator (Web Audio)
    useWakeLock.ts            # Screen wake lock API wrapper
  utils/
    noteUtils.ts              # Frequency → note + cents; resonance detection
    temperaments.ts           # 4 temperament offset tables
    concertPitch.ts           # Concert pitch presets + localStorage persistence
    colorUtils.ts             # HSL gradient from cents deviation
    scaleDefinitions.ts       # 40+ scale definitions
    sessions.ts               # Session data model + localStorage helpers
    noteGrouping.ts           # Groups pitch samples into note events
  components/
    TabBar.tsx
    DroneControl.tsx
    TemperamentSelector.tsx
    ConcertPitchSelector.tsx
    TunerMeter.tsx
    NoteDisplay.tsx / CentsDisplay.tsx / FrequencyDisplay.tsx
    StartButton.tsx / WakeLockToggle.tsx
    tuner/TunerTab.tsx
    practice/
      PracticeTab.tsx
      ScaleSelector.tsx
      RecordButton.tsx
      SessionResults.tsx
      StaffView.tsx           # Custom SVG staff (Bravura SMuFL font)
      NoteResultsTable.tsx
    progress/
      ProgressTab.tsx
      SessionBarChart.tsx
      SessionHistoryList.tsx
    guide/GuideTab.tsx
```

---

## Musical Background

### Cents and Intonation Thresholds
A cent is 1/100th of a semitone. The Just Noticeable Difference for trained ears is ~5–6¢. The app uses:
- **In tune**: ±10¢
- **Close**: ±10–25¢
- **Out of tune**: >±25¢

### Sympathetic Resonance
Violin open strings (G3, D4, A4, E5) vibrate sympathetically when a stopped note matches their pitch or a strong overtone. Practicing to "find the ring" trains exceptional precision — emphasized by all major violin pedagogues.

### Temperament Choice
- **Pythagorean** for melodic scale passages — the violin's natural system (open strings are pure 3:2 fifths)
- **Just** for double stops and sustained chords — eliminates acoustic beating
- **Equal** when playing with piano or fixed-pitch instruments
- No single temperament is correct for all situations; great string players switch contextually.
