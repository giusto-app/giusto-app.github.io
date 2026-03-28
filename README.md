# Intonation Trainer

A web app that helps musicians improve their pitch accuracy in real time. Play your instrument, and the app listens, detects the pitch, and tells you how close you are to being in tune — down to the cent.

Works on iPhone, Android, and desktop. No install required.

---

## Requirements

### R1 — Real-Time Tuner
- App accesses the device microphone (with explicit user permission)
- Detects the played pitch in real time using the McLeod Pitch Method (Pitchy library)
- Displays:
  - **Note name + octave** (e.g. A4, C#5) in large, readable text
  - **Frequency in Hz** (e.g. 441.2 Hz)
  - **Cents deviation** (e.g. +3¢ or −12¢) from the target pitch
  - **Visual tuner needle** — SVG semicircular arc, needle rotates to show sharp/flat
- Color feedback:
  - 🟢 Green: within ±10 cents (in tune)
  - 🟡 Amber: ±10–25 cents (close)
  - 🔴 Red: >±25 cents (out of tune)
- Needle uses exponential moving average (EMA) smoothing to reduce jitter
- Works on iOS Safari (AudioContext started inside user-gesture tap)

### R2 — Temperament Selection
- User can switch between 4 temperaments without restarting audio:
  - **Equal** — 12-TET; universal modern standard (piano, guitar, winds)
  - **Pythagorean** — pure perfect fifths (3:2); preferred by violin, viola, cello, double bass (open strings tune in Pythagorean fifths)
  - **Just** — 5-limit; pure thirds (5:4) and fifths (3:2); used by string quartets, choirs, brass ensembles
  - **Meantone** — quarter-comma; pure major thirds (5:4); used by Baroque violin, viol da gamba, lute, recorder, early keyboards
- 0¢ always means "perfectly in tune" for the selected system
- Displayed as a pill segmented control with one-line description

### R3 — Practice Mode (10-Second Recording Sessions)
- User selects a **scale** (or Free Play) and taps **Record**
- A **3-second pre-countdown** (3→2→1) gives the player time to get ready before samples are collected
- App records for exactly **10 seconds** with a countdown ring animation
- During recording: full real-time tuner display is shown (note, Hz, meter, cents)
- After 10 seconds, pitch samples are grouped into discrete **note events** by:
  - Consecutive samples of the same MIDI note → one event
  - Minimum 5 samples / 100 ms to count as a note
  - Silence gap >200 ms breaks the group
- **Results screen** displays:
  - Score badge: overall % in tune (0–100%)
  - Summary chips: total notes, in-tune count, close count, off count, avg ¢ deviation
  - **Music staff** (custom SVG treble clef) with one colored note head per event
  - Note head color = smooth HSL gradient from green (0¢ = in tune) to red (50+¢ = off)
  - Cents deviation shown below each note head
  - **Note-by-note results table** with avg ¢, duration, and a visual deviation bar; note names colored by intonation quality
- User can **Save** the session (stored in localStorage) or **Discard**
- After saving, app navigates to the Progress tab

### R4 — Scale Practice
- Practice tab includes a **Free Play / Scales** top-level toggle
- When **Scales** is selected, three sub-tabs organize the full library:

#### Common tab (default)
Curated for open-string resonance and orchestral frequency — no scrolling needed:
- **Major**: G · D · A · E (open strings) · C · F · Bb (orchestral)
- **Minor**: G · D · A · E · C · B · F

#### Full Circle tab
Complete Circle of Fifths — all 15 key signatures, horizontally scrollable:
- **Sharp side** (0 → 7 sharps): C/Am · G/Em · D/Bm · A/F#m · E/C#m · B/G#m · F#/D#m · C#/A#m
- **Flat side** (1 → 7 flats): F/Dm · Bb/Gm · Eb/Cm · Ab/Fm · Db/Bbm · Gb/Ebm · Cb/Abm
- Major key on top, relative minor below in each cell

#### Gypsy & Pentatonic tab
- **Pentatonic** (major): G · D · A — 5 notes, no semitones, ideal for ear training
- **Pentatonic** (minor): Am · Dm · Em — bluesy minor pentatonic patterns
- **Gypsy / Hungarian** — scales with augmented 2nd intervals:
  - **A Hungarian Minor** / **C Hungarian Minor** — used in Romani violin, klezmer, Eastern European folk
  - **D Gypsy Major** / **C Gypsy Major** (Double Harmonic) — Middle Eastern and flamenco character
- Pentatonic scales shown in violet, Gypsy scales in amber to distinguish scale families

Selected scale's description is always shown below the grid. Scale name appears in the recording header.

### R5 — Progress Tracking
- Every saved session is persisted to **localStorage** (up to 50 sessions)
- Progress tab shows:
  - Summary stats: session count, best %, latest %, trend vs. previous session
  - **SVG bar chart** of last 20 sessions — bar height = % in tune, bars colored green→red
  - **Session history list** with date, scale, temperament, % in tune, avg ¢
- Sessions can be cleared from the history list

### R6 — Keep Screen Awake
- A **"Keep awake"** toggle button appears in the Tuner tab header
- When enabled, uses the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) to prevent the screen from dimming or locking while playing
- Toggle label changes to **"Awake"** (amber) when active
- If the browser hides the page (e.g. tab switch), the lock is automatically re-acquired when the page becomes visible again
- Hidden automatically when the browser does not support the Wake Lock API

### R8 — UI / UX
- **Dark theme** (bg-gray-950) throughout
- **Mobile-first** responsive layout (max-width capped, centered on desktop)
- **Bottom tab bar** with 3 tabs: Tuner · Practice · Progress
- All tap targets ≥ 48×48 px, no hover-only interactions
- iOS home-bar safe-area padding on tab bar
- **Text readability**: all labels use gray-300 or brighter on the dark background
- Temperament can be changed in both Tuner and Practice tabs (shared state)
- After saving a session, app navigates automatically to the Progress tab

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime / Package Manager | Bun |
| Build tool | Vite 6 |
| UI Framework | React 18 + TypeScript |
| Pitch Detection | Pitchy 4 (McLeod Pitch Method) |
| Styling | Tailwind CSS 4 |
| Audio | Web Audio API (built-in) |
| Persistence | localStorage |
| Charts / Staff | Custom SVG (no external library) |

Bundle size: ~200 KB JS (gzipped ~62 KB). No heavy charting or notation libraries.

---

## Running Locally

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in a browser.

For mobile testing, expose with:
```bash
bun run dev --host
```

Then open the local network URL on your phone (microphone access requires HTTPS or localhost).

---

## Project Structure

```
src/
  hooks/
    usePitchDetection.ts      # Real-time tuner hook (Web Audio + Pitchy)
    useSessionRecorder.ts     # 10-second practice session hook
  utils/
    noteUtils.ts              # Frequency → note name + cents conversion
    temperaments.ts           # 4 temperament offset tables
    colorUtils.ts             # HSL color gradient from cents deviation
    scaleDefinitions.ts       # 40+ scale definitions: diatonic, pentatonic, gypsy/Hungarian
    sessions.ts               # Session data model + localStorage helpers
    noteGrouping.ts           # Groups raw pitch samples into note events
  components/
    TabBar.tsx
    tuner/
      TunerTab.tsx
    practice/
      PracticeTab.tsx
      ScaleSelector.tsx
      RecordButton.tsx
      SessionResults.tsx
      StaffView.tsx           # Custom SVG music staff
      NoteResultsTable.tsx
    progress/
      ProgressTab.tsx
      SessionBarChart.tsx     # Custom SVG bar chart
      SessionHistoryList.tsx
    (shared)
      TunerMeter.tsx          # SVG arc needle
      NoteDisplay.tsx
      CentsDisplay.tsx
      FrequencyDisplay.tsx
      StartButton.tsx
      TemperamentSelector.tsx
```

---

## Musical Background

A **cent** is 1/100th of a semitone. The Just Noticeable Difference (JND) for trained ears is ~5–6 cents. The app flags notes as:

- **In tune**: ±10 cents
- **Close**: ±10–25 cents
- **Out of tune**: >±25 cents

The note head color on the music staff uses a smooth HSL gradient (green at 0¢ → yellow at ~10¢ → red at 50¢+) so you can see the *degree* of intonation error at a glance, not just a pass/fail judgment.
