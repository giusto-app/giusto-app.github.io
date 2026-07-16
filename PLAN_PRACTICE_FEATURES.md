# Plan: Tempo Trainer · Exercise Library · Tune Memorization

Decisions confirmed with Marc on 2026-07-15. Three features building on existing rails:
the FSRS-style scheduler (`src/utils/spaceRepetition.ts`), Learn queue + storage
(`src/hooks/useLearnQueue.ts`, `src/utils/learnStorage.ts`), tune catalog
(`src/hooks/useTuneCatalog.ts` → violin-music.github.io), pitch detection + DTW
(`src/utils/dtw.ts`, `src/hooks/useMeasureRecorder.ts`), and the lilyjs
`measureRange` render option.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Exercise publishing | (b) via the violin-music.github.io pipeline, like the tune catalog |
| Exercise catalog shape | Separate `exercises-catalog.json` (not folded into tunes-catalog.json) |
| Exercise curation | Review existing `violin-music_private/Practice/*.ly`, include the ones that make sense; research well-known violin exercises (circle-of-fifths/fourths patterns, Bach examples, well-known tunes) and AUTHOR new .ly files for missing standards |
| Tune segment rendering | Publish each tune's `.ly` source alongside SVG/MIDI/notes.json |
| Feature 3 home | Learn tab (extend LearnCard/scheduler — `sectionLabel` already anticipates sections) |
| Segmentation | 4-bar phrases + chained/overlapping ranges (1–4, 5–8, 1–8, 5–12 …) |
| Review grading | Self-grade (Again/Hard/Good/Easy) now; mic-assisted grading is a TODO.md follow-up |
| Tempo Trainer modes | BOTH from day one: step-per-loop and timed ramp (A→B over N minutes) |
| Repo scope | I work in all three repos (giusto, violin-music_private, violin-music.github.io); commits/pushes of the public site are left for Marc's review |

## Phase 1 — Exercise library (mechanism)

- [x] **Pipeline** (violin-music_private): `scripts/generate-exercises-catalog.mjs` +
      `scripts/exercises-config.json` (allowlist, 14 files → 27 entries) publish to
      violin-music.github.io (`exercises/` + `exercises-catalog.json`); wired into
      `.github/workflows/build-and-deploy.yml` (checks out the public giusto repo for
      the lilyjs bundle). Metadata extracted by parsing with lilyjs.
- [x] **Curation + authoring** (Phase 1b, 2026-07-15): existing files reviewed (14
      published, 6 skipped: Untitled/WIP/personal). Authored 6 new standards after
      researching the canon (Flesch/Galamian-style daily routine, one key a day
      around the circle): Major/Minor Arpeggios — Circle of Fifths, Major Scales —
      Circle of Fifths, Dominant 7th Arpeggios — Circle of Fourths, Minuet in G
      (Petzold, attr. Bach — 3/4, tests triple-meter accents), Ode to Joy (D major,
      mid-bar chord change). All with chord tracks for the drone, violin
      first-position ranges (min G3), \tempo marks. Catalog now 33 entries.
      Fixed along the way: chord-symbol offsets are WHOLE-note fractions
      (chordSchedule.ts read them as quarter-notes — Ode to Joy's mid-bar change
      exposed it; parse-based regression test added), and all catalog entries now
      render via the score-only path (no more full-letter-page empty space).
- [x] **Giusto**: `useExerciseCatalog` hook (localStorage cache + bundled offline
      fallback); picker UI in Play-Along — category pills, Recent + Favorites pinned;
      badges: T.S., bars, drone-available. Selection persisted (full entry JSON) and
      shown in the Play-Along section header.
- [x] Multi-`\score` files: each score block is its own catalog entry
      (`scoreIndex`); rendered via lilyjs `renderScore` (whole-document render kept
      for single-score files), catalog title injected when the file has none.
- [x] **Guard**: Play-Along hides drone controls and plays metronome-only when the
      exercise has no chord track.
- [x] Validation: the pipeline refuses to publish an exercise that doesn't parse with
      lilyjs; Giusto keeps the bundled exercise as offline fallback. E2E-verified
      headlessly with the generated catalog routed from the local public-repo checkout.

## Phase 2 — Tempo Trainer (both modes)

- [x] Pure module `src/audio/tempoPlan.ts` + 11 tests: `bpmForLoop` (step per
      repetition, capped at target, descending supported), `bpmAtElapsed` (clamped
      linear wall-clock ramp, stepped at bar starts), `plannedSteps`/`rampFraction`
      for the viz.
- [x] Wiring in PracticePlayback: perLoop steps on loop wrap (and auto-enables
      Loop); timed steps on downbeats from the audio-clock elapsed time. Manual
      slider drag re-anchors both ramps (perLoop steps from the latest value;
      timed shifts the remaining ramp by an offset).
- [x] UI: Tempo Trainer card (on/off, Per loop / Timed switch, from/to +
      step-or-minutes inputs); stepped-bars progress viz (gray planned / amber
      reached); live `♩ = N` ticks up during the ramp. E2E-verified headlessly
      (60→180 over 1 min ramps the display during real playback).
- [ ] Later (not in v1): saved named sessions with last-practiced dates as cards.

## Phase 3 — Tune memorization (Anki-style, Learn tab)

- [ ] **Pipeline**: generate_tune_catalog pipeline also publishes each tune's `.ly`.
- [ ] **Data**: extend `LearnCard` with `segment?: { startMeasure, endMeasure }`
      (backward compatible — existing cards mean "full tune"). Card generation on
      add-to-queue: 4-bar phrases + chained ranges; parse measure count from `.ly`.
- [ ] **Review flow** (extends Learn tab's PracticeView):
      prompt (tune title + segment label + first measure or chords as recall cue) →
      reveal (`LilyScore` with `measureRange`) → grade (Again/Hard/Good/Easy →
      existing `scheduleNext`); Again → intra-session re-queue after 2–3 other cards
      (learning steps; the day-granularity scheduler stays untouched).
- [ ] **Synergy**: reveal screen offers "practice this segment" → Play-Along loop of
      that range + Tempo Trainer.
- [ ] Follow-up (TODO.md): mic-assisted grading — record the attempt, score with
      pitch-detection + DTW vs notes.json, pre-select the suggested grade.

## Order

Phase 1 mechanism → Phase 2 (independent of pipeline) → Phase 1 curation/authoring
(parallelizable) → Phase 3. Public-site pushes reviewed by Marc before going live.
