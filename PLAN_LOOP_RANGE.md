# Play-Along — drag a loop range over the score, and a timeline to scrub

Status: **in progress — LR1 and LR2 done 2026-10-30.** Builds on the section model of
`PLAN_PLAYBACK_START_POINT.md` (`src/audio/section.ts`, built), which already decides
what a section *means* (sticky, Loop governs repetition, the trainer steps per pass).
This plan changes how you **make and see** one, after studying Sightread's player
(sightread.dev, "Playing" page, the reference screenshot of bars 1-4 of
The Star-Spangled Banner).

## What Sightread does (read from its page source)

1. **The range is an overlay, not a restyled score.** Absolutely-positioned divs sit
   over the SVG: a wash (`bg-purple-500/15`, 2 px top/bottom border) from the first
   bar line to the last, and two 12 px **handles** (`data-range-handle="start|end"`,
   `cursor-w-resize` / `cursor-e-resize`, a grip line in the middle) on its edges.
   Dragging a handle snaps the range to bar lines. The score SVG is never mutated
   for the range.
2. **The bar being played is a second overlay**: a rounded `bg-purple-600/35` box
   translated to the current measure's x (`transform: translate(565px, 49px)`),
   moved with a CSS transform, not by re-styling SVG.
3. **A timeline strip under the score** (40 px): the whole piece as a minimap with a
   tick and number per bar; a fill up to the playhead (elapsed); the loop range as a
   box with its own two handles (hit area widened with `before:-inset-x-3`); a
   playhead line with a triangle cap. Clicking or dragging it seeks.
4. **Transport bar**: skip-back, a round play button, volume, `00:08 / 00:49` and
   `MEASURE 6`, a segmented **both / left / right** hand selector, **Metronome**
   toggle with a settings menu, **Wait** (MIDI: wait for the right note),
   **Countdown** and **Loop** toggles, a **speed** menu (100 %), and a "more" overflow
   menu on narrow screens.
5. **Touch-first**: the player is `touch-none select-none`, with
   `-webkit-touch-callout: none`, so drags never scroll or select.
6. **Long scores**: each system is its own `<svg>` in a `content-visibility: auto`
   wrapper, so off-screen systems cost nothing. Every note group carries
   `data-event-id="P1:m3:e2"` (part, measure, event), and the notes sounding now get
   an `is-sounding` class (filled with the accent colour).

## What Giusto has today

| Sightread feature | Giusto |
|---|---|
| Section start/end | ✓ click start bar, click end bar (`nextSection`) |
| Section shown on the score | ✓ per-measure tint of lilyJS `measure-area` rects |
| Loop toggle, count-in, metronome, tempo trainer | ✓ |
| Current bar highlight, current note highlight | ✓ `setActiveMeasure`, note binding |
| Measure readout | ✓ (bar number; no time) |
| **Drag handles to set or resize the range** | ✗ |
| **One-bar section** | ✗ (the click model cannot make one; recorded limitation) |
| **Timeline strip / seek / scrub** | ✗ |
| Elapsed / total time | ✗ |
| Playback speed (separate from the tempo slider) | ✗ |
| Part focus (play only the violin or only the backing) | ✗ |
| Wait-for-the-right-note | ✗ (but Giusto has pitch detection: `pitchy`, DTW) |
| Section remembered per exercise | ✗ (open decision in the previous plan) |

## Design

### The geometry the overlay needs (from lilyJS, already in the SVG)

lilyJS draws a transparent `measure-area` rect per bar per staff, tagged
`data-lily-measure` (no system index on the rect; systems are told apart by the
rects' vertical position, from `getBoundingClientRect`). One function turns the
rendered SVG into a measure map:

```ts
/** Per measure: its box on each system it occupies (a measure never splits, but
 *  the range spans systems). Screen px, relative to the score container. */
export interface MeasureBox { measure: number; system: number; x1: number; x2: number; top: number; bottom: number }
export function measureBoxes(container: HTMLElement): MeasureBox[]
```

It is recomputed on the score-render nonce (the same hook that already re-stamps the
parked marker, S13) and on resize. The union over staves gives one box per bar per
system, so the wash covers both staves of a piano-style score, as in the screenshot.

### The range overlay

- One wash **segment per system** the section touches (a 5-12 range that wraps after
  bar 8 draws two segments), with the start handle on the first segment's left edge
  and the end handle on the last segment's right edge.
- Dragging a handle: pointer capture, hit-test the pointer against the measure map,
  snap to the nearest bar line, and write the section through the existing
  `Section` model (`startBeat` / `endBeat` from `beatAtMeasure`). The start can never
  pass the end; dragging past it swaps roles, as the click model already allows any
  order.
- **One-bar sections become possible** by dragging the end handle onto the start
  bar's right edge. That removes the known limitation without changing the click
  rules.
- Click behaviour stays as decided (`nextSection`), so the click flow keeps working
  and the handles are an addition, not a replacement.
- While playing, the handles are disabled (S16: no re-aiming mid-take), or the drag
  takes effect on the next pass (open decision D2).
- A current-bar box (the existing `setActiveMeasure`) stays on top of the wash.
- The existing per-measure SVG tint is retired once the overlay lands (one way to
  show a section, not two).

### The timeline strip

A 40 px bar under the score: a tick and number per bar (thinned when bars are
narrow), the elapsed fill, the section as a box with two handles (same `Section`), and
the playhead. Click or drag to **seek**:

- stopped: sets the pause point (`pauseBeatRef`), so Play starts there;
- playing: stop and restart from the new beat (the clock already resumes from a beat,
  `playbackClockResume`).

It also gives the score a sense of "where am I in the piece", which the system-by-
system view lacks.

### The readout

`00:08 / 00:49 · Measure 6`, with time derived from the conductor map (tempo changes
included), and `bars 5-12` when a section is set (already in the previous plan).

## Tasks

Ordered so every step lands alone and is useful on its own.

- [x] **LR1 · Measure map.** (2026-10-30: `measureBoxes`, `rangeSegments`,
      `measureAtPoint`, `readMeasureRects`; 5 tests.) `src/pages/practice/measureBoxes.ts` + unit test over a
      fixture SVG (two systems, two staves): per-bar boxes, union over staves, a range
      split into per-system segments. Recomputed on render nonce and resize.
- [x] **LR2 · Range overlay, display only.** (2026-10-30: `rangeOverlayGeometry`
      + 4 tests, `RangeOverlay.tsx` positioned over the score from the measure map,
      re-read on section change, render nonce and resize; tint and its CSS removed.)
      Draw the wash segments and handles from
      the current section; retire the per-measure SVG tint. No dragging yet.
      Witness: a wrapped 5-12 section draws two segments.
      **Parked — lilyJS `setRange`.** lilyJS now draws a range itself from its time map
      (`binding.setRange(from, to)`, RG1, lilyJS 7a3f4f48a), including bounds inside a
      bar. It is not in a release yet (Giusto pins ^0.60.0), and the release number is
      Marc's to pick. Once released, decide whether the wash moves to `setRange` (needed
      for part-bar ranges) while the handles stay Giusto divs.
- [ ] **LR3 · Drag handles.** Pointer capture, snap to bar lines, write `Section`;
      one-bar sections; keyboard: focusable handles, Left/Right move one bar.
      `touch-action: none` on the player. Disabled while playing (D2).
- [ ] **LR4 · Drag to create.** Press on a bar and drag across others to make a
      section in one gesture (click-click stays).
- [ ] **LR5 · Timeline strip.** Ticks, elapsed fill, section box with handles,
      playhead; click/drag to seek (stopped: pause point; playing: restart there).
- [ ] **LR6 · Time readout.** Elapsed / total from the conductor map.
- [ ] **LR7 · Remember the section per exercise** (`localStorage`, keyed by
      `exercise.id`), if D1 says so.

Further ideas from the same page, not part of the loop work (one line each):

- [ ] **LR8 · Playback speed** (50-120 %) as a multiplier over the score tempo,
      separate from the slider and the trainer.
- [ ] **LR9 · Part focus**: solo or mute the violin line or the backing (Sightread's
      both/left/right is the same idea for piano hands).
- [ ] **LR10 · Wait mode**: hold the cursor on a note until the mic hears it in tune
      (Giusto already has pitch detection). Biggest of the list; its own plan.
- [ ] **LR11 · Long scores**: one SVG per system with `content-visibility: auto`.
      That is a lilyJS output option first (per-system SVGs), then a Giusto change.

## Decided (Marc, 2026-10-30)

- **D1 · Remember the section per exercise** across sessions (`localStorage`, keyed by
  `exercise.id`) — LR7 is in scope.
- **D2 · Handles stay live while playing**; a changed range takes effect on the **next
  pass** (the current pass finishes on the old window).
- **D3 · Fuchsia** for the range (wash, border and handles), distinct from the
  existing section tint and from the current-bar marker.
