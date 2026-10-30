# Light mode — every surface follows the theme

Status: **done 2026-10-30.** Reported by Marc with a screenshot of the
Play-Along page in light mode: the score, the Key menu, the Tempo Trainer and Backing
panels and the backing pills keep their dark-mode colours.

## Why it happens

Light mode is a `light` class on `<body>` (App.tsx) that swaps the `--neu-*` tokens and,
in `src/index.css`, overrides the dark **text** utilities globally
(`body.light .text-gray-300 { … }`). Nothing overrides the dark **background and border**
utilities (`bg-gray-900`, `bg-gray-800/40`, `border-gray-700`, `hover:bg-gray-700`, …),
so every panel built from them stays dark — and the text inside it, now dark too,
becomes unreadable (the backing pills, the Key menu). And the score is rendered with
`theme: 'dark'` hard-coded in `LilyScore.tsx`, so it is always light ink on a dark page.

Where the dark utilities are used (2026-10-30): PracticePlayback 15, ExercisePicker 5,
TunerTab 2, StaffComparison 2, TimelineStrip, PracticeTab, StartButton 1 each.

## Tasks

- [x] **LM1 · Surfaces.** (Done: `src/index.css`, next to the text overrides. A
      selected chip — `bg-gray-700 text-gray-100` — stays dark on purpose, so it still
      reads as selected; white text on a saturated button — play, pause, record — stays
      white, where the existing `text-white` override had turned it dark.) Light-mode overrides for the dark gray background, border and
      hover utilities, next to the text overrides, so the panels, menus and pills turn
      light the same way their text already does. One place, every page.
- [x] **LM2 · The score.** (Done: `useLightTheme` watches `<body>`'s class; `LilyScore`
      renders in lilyjs's light or dark theme and re-renders on a switch, for every score
      in the app.) Render with lilyjs's `theme: 'light'` when the app is light,
      re-rendering on a theme switch, on a light page (`#play-along-score`).
- [x] **LM3 · Highlights on light paper.** (Done: the chord highlight takes #b45309 on
      light paper; the range wash, its handles, the timeline and the parked bar were
      already given light variants and read clearly — checked.) The sounding chord symbol (amber, inline
      style), the loop range's wash and handles, the timeline, the parked bar: each
      checked against a light page and darkened where it washes out.
- [x] **LM4 · Evidence.** (Done: screenshots of Play-Along in both themes, Pitch
      Practice and the Tuner in light, sent 2026-10-30.) Screenshots of Play-Along, Pitch Practice and the Tuner in both
      themes.
