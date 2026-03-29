# Giusto — Intonation Trainer for Bowed String Players

A web app that helps violinists, violists, cellists, and double bassists improve their pitch accuracy in real time. Play your instrument, and the app listens, detects the pitch, and tells you how close you are to being in tune — down to the cent.

Works on iPhone, Android, and desktop. No install required. Can be added to your home screen as a PWA.

---

## Who It's For

- **Beginners** learning to hear and correct their own intonation
- **Intermediate players** working through scales and developing consistent left-hand frame
- **Advanced players** fine-tuning temperament choices for different musical contexts
- **Teachers** who want students to practice independently with objective feedback

Designed specifically for bowed strings — the scale library, temperament choices, and resonance features are tailored to violin, viola, cello, and double bass.

---

## How to Practice (Recommended Workflow)

Violin pedagogy research (Galamian, Fischer, Zabanal 2019) points to a consistent workflow:

1. **Warm up with the Tuner tab** — play long tones, listen to the meter, tune your ear before drilling notes
2. **Use a drone** — the most proven intonation exercise. Set the drone to your scale's tonic and play scales above it, listening for beats
3. **Practice your scale in the Practice tab** — record a 10–60 second session, then study the results staff and table
4. **Review the Progress tab** — track which notes you consistently play sharp or flat over time

---

## Requirements

### R1 — Real-Time Tuner
- App accesses the device microphone (with explicit user permission)
- Detects the played pitch in real time using the McLeod Pitch Method (Pitchy library)
- Displays:
  - **Note name + octave** (e.g. A4, C#5) in large, readable text
  - **Frequency in Hz** (e.g. 441.2 Hz) with concert pitch indicator (e.g. "A = 442")
  - **Cents deviation** (e.g. +3¢ or −12¢) from the target pitch
  - **Visual tuner bar** — centered fill bar extends left (flat) or right (sharp), color-coded by deviation
- Color feedback:
  - 🟢 Green: within ±10 cents (in tune)
  - 🟡 Amber: ±10–25 cents (close)
  - 🔴 Red: >±25 cents (out of tune)
- EMA smoothing (α=0.08) eliminates jitter from a steady tone (e.g. 440 Hz diapason)
- Works on iOS Safari (AudioContext started inside user-gesture tap)

### R2 — Temperament Selection
- User can switch between 4 temperaments without restarting audio:
  - **Equal** — 12-TET; universal modern standard (piano, guitar, winds)
  - **Pythagorean** — pure perfect fifths (3:2); natural system for bowed strings (open strings tune in Pythagorean fifths); raises leading tones expressively
  - **Just** — 5-limit; pure thirds (5:4) and fifths (3:2); use for double stops and chords in chamber music
  - **Meantone** — quarter-comma; pure major thirds (5:4); Baroque violin, viol da gamba, lute, recorder
- 0¢ always means "perfectly in tune" for the selected system
- Displayed as a pill segmented control with one-line description

### R3 — Practice Mode (Configurable Recording Sessions)
- User selects a **scale** (or Free Play), a **duration**, and taps **Record**
- **Duration options**: 10s · 30s · 60s · Free (manual stop)
- A **3-second pre-countdown** (3→2→1) gives the player time to get ready before samples are collected
- App records for the chosen duration with a countdown ring animation
- During recording: full real-time tuner display is shown (note, Hz, meter, cents)
- After recording, pitch samples are grouped into discrete **note events** by:
  - Consecutive samples of the same MIDI note → one event
  - Minimum 5 samples / 100 ms to count as a note
  - Silence gap >200 ms breaks the group
- **Results screen** displays:
  - Score badge: overall % in tune (0–100%)
  - Summary chips: total notes, in-tune count, close count, off count, avg ¢ deviation
  - **Music staff** (custom SVG treble clef with Bravura engraving font) with one colored note head per event
  - Note head color = smooth HSL gradient from green (0¢ = in tune) to red (50+¢ = off)
  - Cents deviation shown below each note head
  - **Note-by-note results table** with avg ¢, duration, and a visual deviation bar
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
- **Gypsy / Hungarian** — scales with augmented 2nd intervals (Romani violin, klezmer, Eastern European folk)
- **Gypsy Major** / **Double Harmonic** — Middle Eastern and flamenco character

### R5 — Progress Tracking
- Every saved session is persisted to **localStorage** (up to 50 sessions)
- Progress tab shows:
  - Summary stats: session count, best %, latest %, trend vs. previous session
  - **SVG bar chart** of last 20 sessions — bar height = % in tune, bars colored green→red
  - **Session history list** with date, scale, temperament, % in tune, avg ¢
- Sessions can be cleared from the history list

### R6 — Adjustable Concert Pitch
- Concert pitch is configurable: A = 415, 432, 440, 441, 442, 443, 444 Hz (or custom 415–450)
- Default: 440 Hz
- Shown as a small indicator in the Tuner tab: "A = 442"
- Affects all pitch detection
- Persisted in localStorage between sessions

### R7 — Keep Screen Awake
- A **"Keep awake"** toggle button appears in the Tuner tab header
- When enabled, uses the Screen Wake Lock API to prevent screen dimming during practice
- Toggle label changes to **"Awake"** (amber) when active
- If the browser hides the page, the lock is automatically re-acquired when visible again
- Hidden automatically when the browser does not support the Wake Lock API

### R8 — UI / UX
- **Dark theme** (bg-gray-950) throughout
- **Mobile-first** responsive layout; tablet-optimized with wider containers at `md:` (768px+)
- **Bottom tab bar** with 3 tabs: Tuner · Practice · Progress
- All tap targets ≥ 48×48 px, no hover-only interactions
- iOS home-bar safe-area padding on tab bar
- Installable as a PWA (web app manifest + Workbox service worker)

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
| PWA | vite-plugin-pwa + Workbox |

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
    useSessionRecorder.ts     # Configurable-duration practice session hook
    useWakeLock.ts            # Screen wake lock API wrapper
  utils/
    noteUtils.ts              # Frequency → note name + cents (supports variable concert pitch)
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
      StaffView.tsx           # Custom SVG music staff (Bravura SMuFL font)
      NoteResultsTable.tsx
    progress/
      ProgressTab.tsx
      SessionBarChart.tsx     # Custom SVG bar chart
      SessionHistoryList.tsx
    (shared)
      TunerMeter.tsx          # Centered-fill horizontal bar
      NoteDisplay.tsx
      CentsDisplay.tsx
      FrequencyDisplay.tsx
      StartButton.tsx
      TemperamentSelector.tsx
```

---

## Musical Background

### Cents and Intonation Thresholds
A **cent** is 1/100th of a semitone. The Just Noticeable Difference (JND) for trained ears is ~5–6 cents. The app flags notes as:

- **In tune**: ±10 cents
- **Close**: ±10–25 cents
- **Out of tune**: >±25 cents

### Sympathetic Resonance
The violin's open strings (G3, D4, A4, E5) vibrate sympathetically when a stopped note matches their pitch or a strong overtone. Practicing to "find the ring" on notes like G4, D5, A5, and E5 trains exceptional precision — a technique emphasized by all major violin pedagogues.

### Temperament Choice in Practice
The "right" intonation for a given note depends on its harmonic context:
- **Pythagorean** for melodic scale passages and open-string work — this is the violin's natural system (open strings are perfect 3:2 fifths)
- **Just** for double stops and chords — minimizes acoustic beating in sustained intervals
- **Equal** when playing with piano or fixed-pitch instruments

No single temperament is correct for all situations. Great string players switch contextually.
