# Giusto — TODO

Goal: Help violinists and bowed string players improve their intonation.

---

## 🔴 Next Up — Play-Along section looping (specced 2026-08-09)

Select bars 5–12 on the score and drill them: takes begin at the section, Loop repeats it,
the Tempo Trainer ramps per section pass. Grew out of "should a clicked bar be sticky?" while
fixing the stale resume point on tune change (`93b53d2`). Decisions made, 18 user stories,
state machine, and test plan: `PLAN_PLAYBACK_START_POINT.md`.

- [x] `src/audio/section.ts` + test — `nextSection` · `resolveStartBeat` · `takeWindow` ·
      `beatInTake`, all pure, 20 tests (2026-08-09)
- [x] Split `resumeBeatRef` into `sectionRef` + `pauseBeatRef`, starts resolved through
      `resolveStartBeat` (2026-08-09 — no behaviour change: nothing sets a section yet)
- [x] Bar-range selection on score click (`nextSection`) + the take window driving the clock
      bounds and all four `% total` sites; marker re-parked when a take ends so a sticky
      section stays visible (2026-08-09 — **the feature is on; needs a human ear**)
- [x] Trainer per-loop stepping counts passes with `passIndex` (floor division). The old
      `beat % total === 0` never fired in compound meters, where a bar is a fractional
      number of quarter notes — a 9/8 per-loop ramp stepped exactly never (2026-08-09)
- [x] Trainer takes always begin at the section so the ramp lines up with the music;
      transpose pauses instead of stopping (it saved nothing, so transposing mid-take
      dropped you at the top while transposing while paused kept your place); parked marker
      re-stamped after a score re-render (2026-08-09 — all three spec bugs closed)
- [ ] **QA by ear** — the only way to confirm any of this: section + Loop wraps cleanly
      (chords and note cursor across the seam, no click), section + Loop off stops after the
      last bar, per-loop trainer steps once per pass including on a 6/8 or 9/8 tune
- [x] Section UI — tint the whole span (2026-08-09). lilyjs already draws a `measure-area`
      rect behind each bar and tints THAT for its own parked marker, so the wash stamps
      `data-giusto-section` on the same rects and CSS does the rest. The selector excludes
      `[data-lily-measure-active]`, so the paused bar keeps lilyjs's blue whatever order the
      two stylesheets load in. Re-applies on the score-render nonce; an armed selection tints
      just its start bar; readout reads `bars 5–12 · ♩ = 120`, or `· at 7` when paused
      somewhere other than the section's own first bar.

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
- [ ] Phase 3: Anki-style tune memorization in Learn tab — segment cards (4-bar + chained),
      self-graded, publish tune .ly in catalog. **Audited 2026-08-09: genuinely open.** The
      Learn tab's sectioned practice run is a within-session walkthrough, not segment cards —
      `addTune` is called with no label so every queued card is "Full tune", `LearnCard` has
      no measure range, and `PracticeView`'s sections are chunks of 12 NOTES rather than bars.
      Remaining sub-items and their status: `PLAN_PRACTICE_FEATURES.md`.
  - [x] Segment planning: `src/utils/tuneSegments.ts` — `planSegments(measures)` produces the
        confirmed phrases + seams + whole-tune ranges (1–4, 5–8, 9–12, 1–8, 5–12, 1–12),
        13 tests. Pure and unwired (2026-08-09)
  - [x] Measure derivation: `src/utils/tuneMeasures.ts` — bars out of notes.json by
        accumulating each note's `d` against the meter from `time_sig`, 16 tests. Means
        segmentation does NOT need the `.ly` pipeline first. Pure and unwired (2026-08-09)
  - [ ] Pickup bars — **decided 2026-08-09: publish each tune's `.ly`** (Phase 3 item 1, as
        originally planned). The `.ly` states barlines outright, so pickups, repeats and
        irregular bars are exact rather than inferred. Work lands in violin-music_private +
        the catalog pipeline. Until it ships, `tuneMeasures` stays a stopgap with
        `pickupBeats` explicit — and once the `.ly` is available it can be deleted rather
        than kept as a second source of truth for barlines.
  - [ ] Wire it: `LearnCard.segment`, card generation on add-to-queue, bar-based sections in
        `PracticeView` (replacing the 12-note chunks), intra-session re-queue for "Again"
  - [ ] Synergy — now unblocked by Play-Along section looping: a "practice this segment" link
        from the reveal into Play-Along with the bar range preset
- [x] Follow-up: mic-assisted review grading — record the attempt, score vs notes.json with
      pitch detection + DTW, pre-select the suggested grade (DONE — verified 2026-08-09:
      `PracticeView` runs `dtw`, calls `onGrade(suggested, avg)`, and lets the player
      override. The box was never ticked)
- [ ] Follow-up: Tempo Trainer saved sessions (named presets with last-practiced dates, like the reference metronome app)
- [x] Push violin-music.github.io exercise assets (or just push violin-music_private and let CI regenerate) so the catalog goes live (2026-07-15)
- [x] ExercisePicker: search box across titles/keys/categories + subtitle, key, meter, bars and chord-drone badges (verified 2026-08-09)
- [ ] Exercise curation leftovers: Violin-Harmonics.ly (nine 1-bar score blocks — needs per-entry titles), Gypsy-scales.ly (WIP placeholders), Practice_All.ly (include-based aggregator); give Jig-Pulse/Practice_Shifts explicit per-score titles instead of auto "Part N"
- [x] Compound meter: metronome now clicks the meter's felt pulse via `src/audio/meter.ts` — dotted quarters for 6/8–12/8 (2 per jig bar, count-in included), halves for 2/2; also fixed \tempo unit conversion (\tempo 8 = 120 → ♩ = 60) in chordSchedule AND the catalog generator (2026-07-15)
- [x] lilyJS parser: dotted tempo units lose their dot — FIXED upstream and already vendored
      (verified 2026-08-09 against `packages/lilyjs` v0.14.0: `\tempo 4. = 84` parses as
      `{beatUnit: 'quarter', beatUnitDots: 1}`, `\tempo 1. = 84` as `{whole, dots: 1}`).
      `chordSchedule.tempoMarkToQuarterBpm` reads `beatUnitDots` and applies the
      n-dots → ×(2−2⁻ⁿ) factor, so ♩. = 84 converts to ♩ = 126. No workaround notes remain.
- [ ] Leftover from the above: `\tempo 1. = 84` in Jig-Pulse part 4 now converts to 504
      (84 × 4 × 1.5) instead of the old 336 — both are outside the 40–208 tempo slider, so
      the marking in the source .ly is likely wrong rather than the conversion. Content fix
      in violin-music_private, not here.
- [x] ChordDrone.setVolume during an in-progress crossfade appended a ramp that the timeline
      sorted INTO the fade — re-anchors now (2026-08-09). Each branch tracks the linear
      segment it has scheduled (`from`/`to`), so setVolume can cancel from `now`, re-anchor at
      the level actually reached, and rewrite the rest. Two audible failures are gone: called
      before the window opened the next chord bled in early over the one still playing; called
      during it the gain raced to the new level then drifted back to the volume captured when
      the chord was scheduled. `setChord`'s hand-off and `stop()` now fade from the branch's
      real level too, which matters when a change lands inside the previous fade-in.
      5 tests, 3 of which fail against the old implementation.
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

### Music font (Bravura)
- [x] **StaffView's noteheads depended on a side effect and were probably never arriving**
      (fixed 2026-08-09). Nothing in the app loaded Bravura: it appeared only when lilyjs
      rendered a score, and lilyjs doesn't export its loader. The Learn tab's practice view
      uses `StaffView`, not lilyjs, and Practice defaults to pitch mode — so a player going
      straight to Learn never triggered a lilyjs render, never got the glyphs, and sat on
      fallback ellipses while a 100 ms poll ran forever. `src/musicFont.ts` now registers the
      face explicitly from `/lilyjs/fonts/Bravura.woff2`. The stale comment crediting VexFlow
      is gone with it.
      Note for whoever tries the obvious fix: an `@font-face` in `index.css` FAILS THE BUILD —
      Bun's CSS bundler resolves `url()` at build time and the font is a copied public asset,
      not a module. Registering the face from JS is what works.
- [ ] Eye check: Learn → practice a tune. Noteheads should be proper Bravura glyphs, not
      plain ellipses. This is the one place the bug was visible.

### Staff Rendering Comparison (`/?compare`)
- [x] **Verify Option C — moot, the comparison already resolved (audited 2026-08-09).** The
      production app renders through `lilyjs` everywhere (`LilyScore`, `PracticePlayback`).
      Option C's `StaffViewLilyPond` is the last consumer of the PRE-lilyjs `lily-parser` and
      the frozen `lily-viewer`, and it is reachable only from this dev page. There is no live
      decision left for it to inform.
- [x] **What the audit did turn up: the dev page was 56% of the production bundle.**
      `main.tsx` static-imported `StaffComparison`, so VexFlow + lily-viewer + legacy
      lily-parser shipped to every user for a page behind `?compare`. Measured by building
      with and without it: 3,648,667 → 1,590,831 bytes. Fixed 2026-08-09 with a dynamic
      import plus `splitting: true` in `scripts/buildApp.ts` (Bun inlines dynamic imports
      without it — the import alone changed nothing, measured). Initial JS is now
      1,585,108 bytes in two chunks and the 2,054,305-byte compare chunk loads only on
      `?compare`. Verified: the compare code is absent from the entry chunk, the dev build
      splits too, and `sw.js` caches scripts on fetch with no precache manifest to update.
- [ ] **lilyJS published declarations — BLOCKED ON A RELEASE TAG.** lilyJS shipped
      `dist/index.d.ts` in `09b43281` (2026-08-10), curated rather than generated because
      `tsc --emitDeclarationOnly` produces 418 files / 1.8 MB even off a narrow entry.
      `scripts/sync-lilyjs.sh` now copies it and refuses to sync a bundle without it —
      but **`09b43281` is not in any tag**, and `sync-lilyjs-release.sh` builds from the
      newest release tag (v0.14.0). So `bun run sync:lilyjs` cannot pick the types up until
      lilyJS cuts a release. Everything below waits on that tag:
  - [ ] Delete the hand-written 411-line `packages/lilyjs/index.d.ts` (the copy replaces it)
  - [ ] Rename four stand-ins that were real names all along: `ScoreLike` → `Score`,
        `MeasureLike` → `Measure`, `MusicalEventLike` → `MusicalEvent`,
        `TempoMarkLike` → `TempoMark`. Cannot be done before the sync — the vendored
        declaration still declares the old names, so renaming now breaks the build.
  - [ ] Consider keeping a light drift test anyway. lilyJS's guards catch a renamed or
        removed export but **not a changed shape** — they showed that asserting shapes needs
        the 418-file tree the design avoids, and that it already fails on `Score`, which
        really carries `annotations` / `info` / `directives` / `lyrics` beyond the published
        subset. So the upstream guarantee is real but partial.
- [x] **Vendored `lily-parser` / `lily-viewer` deleted** (2026-08-10). lilyJS retired the
      legacy surface in `a473c5a3`, so neither can be rebuilt or return on a sync. Removed
      here: both packages, their `workspace:*` deps, `StaffViewLilyPond.tsx`, the legacy
      block in `vendoredPackages.test.ts`, and the comparison page's third panel.
      `lily-viewer` turned out to be a pre-rename build of lilyJS itself — the panel was
      comparing the current renderer against its own ancestor.
      Measured, and it is NOT a main-bundle win: initial JS 1,585,108 → 1,592,350 bytes
      (+0.5%, chunking rearranged), while the lazy `?compare` chunk fell 2,054,305 →
      1,134,887 (−919 KB). The saving is in the lazy chunk and the repo.
- [ ] **Needs Marc — what is the comparison page for now?** It currently compares Custom SVG
      vs VexFlow 4. Either repoint the third panel at `LilyScore` so it compares against the
      CURRENT renderer (more useful; `LilyScore` takes no `noteEvents`, so the per-note
      intonation labels would need porting), or delete the page — which is the only way to
      drop VexFlow, the last 1.13 MB in that chunk.

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
- [x] **Export**: session history as CSV (2026-08-09). `src/utils/sessionsCsv.ts` +
      10 tests; button in the Progress header. One row per session, oldest first so a
      spreadsheet chart reads left to right, RFC 4180 quoting (a comma in a field would
      otherwise shift every column after it, silently), CRLF line endings and a UTF-8 BOM
      for Excel. Per-NOTE export would be a separate, much larger file — not done.

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
