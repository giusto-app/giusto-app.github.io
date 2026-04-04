# Learn Tab — Research & Implementation Plan

## The Idea

Add a **Learn** tab to Giusto that gives violinists a science-backed practice queue: a list of tunes and passages prioritized by what you need to practice *today*, using spaced repetition. Instead of randomly running scales, the app tells you "focus on measures 5–8 of The Connaughtman's Rambles — you haven't nailed those in 4 days."

---

## 1. Does the Research Support This?

### Spaced repetition for music: evidence is real but nuanced

**The distributed practice effect is real.** A 2025 meta-analysis across 22 studies (3,000+ participants) found a moderate effect size (d = 0.54) in favor of distributed practice over massed practice. Spacing your practice across days beats drilling everything in one session.

**The important caveat: longer intervals work, short ones don't.** A PLOS ONE study found *no* spacing effect within 15-minute intervals for piano learning. Complex motor skills don't benefit from micro-spacing — you need days or weeks between review sessions. This matches Anki's philosophy but means the algorithm needs tuning for music.

**Advanced musicians already do this intuitively.** A 2025 systematic review of self-regulated practice in advanced musicians found that successful players isolate difficult passages, drill them deliberately, and return to them after intervals — without any app telling them to. The app just makes this systematic.

**AI feedback builds confidence.** A 2025 study of violin students using AI-assisted practice feedback showed significant gains in performance self-efficacy (d=1.18) vs. control group. Real-time feedback during measure practice is motivating, not just informative.

### Part practice vs whole practice: the research consensus

**Whole-Part-Whole** is the evidence-based structure:
1. Play the whole piece to understand structure
2. Isolate difficult measures for focused drill
3. Return to the whole piece to integrate

**Early vs. late learning should use different ratios:**
- **Early stage**: 80% part practice (isolated measures), 20% variable
- **Near performance**: 20% part practice, 80% whole-piece practice

**Interleaving beats blocking for retention.** Mixing different passages in a practice session produces slower initial progress but far superior retention across days and weeks. The Learn tab's queue naturally produces interleaving.

### The gap no app currently fills

After analyzing Tonara (now Vivid Practice, shut down 2023), Simply Piano, Yousician, SmartMusic, and PianoMode:

**None implement a real spaced repetition scheduling algorithm.** They claim "adaptive practice" but use heuristic rules, not a forgetting-curve model. This is the gap.

---

## 2. Which Algorithm to Use

### SM-2 vs FSRS

**SM-2** (Anki's original algorithm): fixed multiplier-based intervals. Works but uses arbitrary constants.

**FSRS** (Free Spaced Repetition Scheduler, Anki's current algorithm): models three variables:
- **Difficulty (D)** — how hard the passage is
- **Stability (S)** — how strong your memory of it is
- **Retrievability (R)** — probability of successful performance right now

FSRS reduces review count by 20-30% while maintaining the same retention rate. It's the right choice for a new implementation.

### Adapting FSRS for music

Flashcard recall is binary (know it / don't). Music performance is continuous and multi-dimensional.

| Flashcard | Music passage |
|---|---|
| Right or wrong | 0–100% accuracy |
| Instant verification | Needs a full performance |
| Single skill | Pitch + rhythm + tone + expression simultaneously |
| Motor-independent | Motor memory + auditory feedback |

**Practical adaptation — 4-point grading scale after each measure attempt:**

| Grade | Meaning | Algorithm response |
|---|---|---|
| 1 — Can't play it | Blocked, multiple errors | Reset interval to tomorrow |
| 2 — Struggling | >20% errors in pitch or rhythm | Short interval (2–3 days), decrease ease |
| 3 — Mostly there | ≤20% errors | Standard interval, ease unchanged |
| 4 — Solid | Played cleanly twice in a row | Long interval, increase ease |

Grading can be self-assessed (tap 1–4 after playing) or partially automated using Giusto's pitch detection. Initially: self-assessed. Later: automated.

---

## 3. What Data Is Available

### The tune catalog

The `violin-music.github.io` project has 187 tunes in `tunes-catalog.json` with:
- Title, composer, country, genre, subgenre, type (Jig, Reel, Waltz, etc.)
- Key, time signature, difficulty (Beginner → Professional)
- Tags, moods, session_friendliness
- **SVG paths** — rendered sheet music, ready to embed in a web app
- **MIDI paths** — audio playback files, playable via Web Audio API

The catalog is served from `https://violin-music.github.io/tunes-catalog.json`. SVGs and MIDIs are at paths like `tunes/Folk_Ireland/The-Connaughtman%27s-Rambles.svg`.

### The Connaughtman's Rambles — test case

```
Title:      The Connaughtman's Rambles
Type:       Irish Jig
Key:        G major (written in D major)
Time sig:   6/8
Difficulty: Intermediate
Structure:  2 repeated sections (A and B), with 1st/2nd endings
SVG:        tunes/Folk_Ireland/The-Connaughtman%27s-Rambles.svg
MIDI:       tunes/Folk_Ireland/The-Connaughtman%27s-Rambles.midi
```

The LilyPond source has 18 measures across two sections with volta brackets. The SVG renders as a single-page score. The MIDI enables reference playback at 120 BPM (dotted quarter).

### The limitation: no measure-level data (yet)

The SVGs are full-page renders — they don't have individual measure bounding boxes. The MIDI has note events but not measure labels. **To do measure-by-measure display and scheduling, we'd need to either:**

1. **Parse MIDI + SVG**: extract measure boundaries from MIDI (by counting beats), overlay on SVG with a highlight box
2. **Use a music library**: abcjs (if we convert LilyPond → ABC) or Vexflow (rebuild notation) to render measure-by-measure
3. **MVP approach**: display the whole SVG, let users tap/select a measure range manually, and track their self-reported performance per region

**The MVP approach is the right starting point.** No new rendering pipeline needed — just the existing SVG + a user-defined measure selection.

---

## 4. Proposed Feature: The Learn Tab

### Core UX flow

```
Learn tab
  └── "What do you want to work on?"
        ├── Browse catalog (filter by genre, difficulty, key)
        ├── Search by title
        └── Select a tune → opens Tune Detail

Tune Detail
  ├── SVG score (full tune, zoomable)
  ├── MIDI playback (hear the reference)
  ├── "Add to my practice queue"
  └── Mark sections: tap to highlight measure ranges you want to track

Practice Queue (main Learn view when pieces exist)
  ├── "Due today" list (sorted by overdue > new)
  ├── Each item: tune name + section label + days since last review
  └── Tap to practice → opens Practice View

Practice View
  ├── SVG score zoomed to the section
  ├── MIDI playback of section (if extractable)
  ├── Pitch detection running (shows live meter)
  ├── After playing: self-grade 1–4
  └── Algorithm schedules next review date
```

### What gets tracked (per user, in localStorage)

```typescript
interface LearnItem {
  tuneId: string          // catalog tune_folder
  sectionLabel: string    // e.g. "Measures 5-8" or user-defined label
  difficulty: number      // FSRS D parameter (1–10)
  stability: number       // FSRS S parameter (days)
  retrievability: number  // FSRS R parameter (0–1)
  lastReview: string      // ISO date
  nextReview: string      // ISO date
  reviews: Review[]       // history
}

interface Review {
  date: string
  grade: 1 | 2 | 3 | 4
  centsDeviation?: number // if pitch detection was running
}
```

### Scheduling logic (simplified FSRS)

```
Initial add → nextReview = tomorrow
After grade 1 → nextReview = tomorrow (reset)
After grade 2 → nextReview = +2 days, D += 0.5
After grade 3 → nextReview = +S days (stability unchanged)
After grade 4 → nextReview = +S × 2.5 days, D -= 0.2 (easier)
Stability S grows as grades 3-4 accumulate
```

---

## 5. What Needs to Be Built

### Phase 1 — MVP (minimal, testable with Connaughtman's Rambles)

1. **`src/components/learn/LearnTab.tsx`** — main tab shell
   - Empty state: "Add your first tune to practice"
   - Queue state: list of items due today + upcoming

2. **`src/components/learn/TuneBrowser.tsx`**
   - Fetch `tunes-catalog.json` from violin-music.github.io
   - Display filterable list (difficulty, genre)
   - Search by title

3. **`src/components/learn/TuneDetail.tsx`**
   - Display SVG score (embed via `<img>` tag)
   - MIDI playback (via Web Audio or `<audio>` tag)
   - "Track this tune" button → adds to practice queue with default sections

4. **`src/components/learn/PracticeView.tsx`**
   - SVG score (full view)
   - MIDI reference playback
   - Giusto pitch meter (reuse existing TunerMeter)
   - Grade selector (1–4 with descriptions)
   - "Done" → schedules next review

5. **`src/utils/spaceRepetition.ts`**
   - FSRS-simplified algorithm
   - `scheduleReview(item: LearnItem, grade: 1|2|3|4): LearnItem`
   - `getDueItems(items: LearnItem[]): LearnItem[]`

6. **`src/utils/learnStorage.ts`**
   - CRUD for LearnItems in localStorage
   - `getItems()`, `upsertItem()`, `deleteItem()`

7. **`src/components/TabBar.tsx`** — add `'learn'` tab with a graduation-cap or brain icon

### Phase 2 — Measure highlighting

- Parse MIDI to extract measure timestamps → overlay translucent highlight on SVG
- Or: use a JavaScript MIDI player that exposes measure position events

### Phase 3 — Automated grading

- Run pitch detection during the practice attempt
- Post-attempt: compute % of notes within ±15¢ → suggest a grade (user can override)

---

## 6. Technical Feasibility

| Concern | Assessment |
|---|---|
| Fetching tune catalog | Trivial — public JSON at violin-music.github.io |
| Displaying SVG scores | Simple — `<img src="...svg">` or inline SVG |
| MIDI playback | Easy — Tone.js is already in the violin-music project; or use `<audio>` for simple playback |
| FSRS algorithm | Simple — the core math is ~50 lines of JS; open-source implementations exist |
| localStorage for progress | Already done in Giusto for sessions/progress |
| Pitch detection during practice | Already built — reuse `usePitchDetection` hook |
| Measure-level SVG interaction | Hard — requires coordinate mapping; defer to Phase 2 |

**MVP is very buildable** with no new dependencies beyond fetching a JSON catalog and displaying an SVG.

---

## 7. What This Gives Players

1. **End to random practice.** Instead of "what should I work on today?", the app tells you. The queue is science-backed, not guesswork.

2. **Efficient use of limited practice time.** Spending 45 minutes on measures you already know is wasted. The algorithm routes time to what's actually slipping.

3. **Long-term repertoire building.** A traditional "session tune" player can build a queue of 20 jigs and reels — the app maintains all of them with appropriate review spacing, so nothing falls out of memory.

4. **Integration with intonation work.** Giusto's pitch detection is live during the practice view. Intonation data from practice attempts can inform the grade (and eventually, automate it).

5. **Connection between practice and real tunes.** The existing tabs (tuner, drone, practice) are abstract — they don't connect to actual music. The Learn tab bridges the gap: "I need to play measure 7 of Connaughtman's Rambles in tune."

---

## 8. Open Questions

1. **Should sections be user-defined or auto-generated?** Auto-generating measure groups (e.g. 4 bars at a time) is clean but requires MIDI parsing. User-defined labels ("the tricky bit after the repeat") are flexible and need zero parsing.

2. **Should the catalog be embedded or fetched from violin-music.github.io?** Fetching keeps the catalog fresh (no duplication, auto-updates when you add tunes) but requires internet. Embedding a snapshot in the app works offline. **Recommended: fetch with a local fallback.**

3. **Cross-origin SVG display:** The SVG files on violin-music.github.io need CORS headers to embed inline. `<img>` tag loading (no CORS restriction) works fine for display but blocks JavaScript interaction (needed for measure highlighting in Phase 2). Phase 1 can use `<img>`; Phase 2 needs CORS or a hosted proxy.

4. **MIDI playback library:** The violin-music.github.io project already uses Tone.js + @tonejs/midi. Adding those to Giusto (~80 KB gzipped) enables section-accurate playback. Alternative: use the browser's `<audio>` element for whole-tune playback only (no library needed, works for MVP).

---

## Sources

- Distributed Practice meta-analysis (2025): https://pmc.ncbi.nlm.nih.gov/articles/PMC12189222/
- No spacing effect in piano learning (PLOS ONE): https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0182986
- AI feedback on violin self-efficacy (2025): https://pmc.ncbi.nlm.nih.gov/articles/PMC12557579/
- Self-regulated learning in advanced musicians (2025): https://journals.sagepub.com/doi/10.1177/10298649241275614
- FSRS algorithm deep-dive: https://domenic.me/fsrs/
- FSRS open-source implementations: https://github.com/open-spaced-repetition/fsrs4anki
- Variable/interleaved practice in music: https://pmc.ncbi.nlm.nih.gov/articles/PMC4128393/
- Deliberate practice meta-analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC4073287/
- Solo performance assessment systematic review (2024): https://pmc.ncbi.nlm.nih.gov/articles/PMC11496144/
