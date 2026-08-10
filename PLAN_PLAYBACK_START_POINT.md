# Play-Along — sections, and where a take begins

Status: **specced, nothing implemented**. Written 2026-08-09, after fixing the stale resume
point on tune change (`93b53d2`). Scope: `src/pages/practice/PracticePlayback.tsx` plus one
new pure module. `PlaybackClock` itself needs no changes.

## Decided (Marc, 2026-08-09)

1. **A section replaces the single "drill bar."** You select a run of bars — 5 through 12 —
   not one bar. One section at a time; a new selection replaces the old.
2. **Click start, then click end.** Clicking the start bar again clears the section (S5).
3. **The Loop toggle still governs repetition.** A section *bounds* the take; it repeats only
   if Loop is on.
4. **The Tempo Trainer steps per section pass.** Drilling bars 5–12 up to tempo is the point.

Still open: how a section looks on screen (open decision below).

---

## Why

The transport has one piece of state, `resumeBeatRef`, doing two jobs that want opposite
lifetimes:

- **"where I stopped"** — written by `pausePlayback`. Should be *consumed*: once you resume
  it's spent, and a take that reaches the end leaves you at the top.
- **"what I want to play"** — written by `handleScoreClick`. Should be *sticky*: marking
  bars 5–12 to drill a hard passage means every take plays that passage until you say
  otherwise.

Today both write the same ref and the ref is consumed on start, so the second intent
silently behaves like the first: you aim at bar 5 once, the take ends, and the next play
jumps back to the top.

---

## Scenarios

Every behaviour this spec decides, as a story. The tables and the test plan refer to these
IDs.

### Choosing what to play

**S1 · Drill a passage.** As a player working a hard passage, I want to select bars 5 to 12
and have every take play just that, so I can run it again and again without re-aiming.
*Today: no selection exists; the second take starts at the top.*

**S2 · Continue after a pause.** As a player who paused mid-take, I want play to pick up
where I stopped, so I don't sit through what I just played. *Today: correct.*

**S3 · Get back to the section.** As a player who paused at bar 7 inside a 5–12 section, I
want the take *after* that one to start at bar 5 again, so pausing doesn't quietly relocate
my drill. *Today: no section exists to return to.*

**S4 · Start over.** As a player who's finished with a passage, I want Rewind to forget both
the section and the pause, so I get a clean run of the whole tune from the top.
*Today: Rewind clears the one ref, which is as much as there is to clear.*

**S5 · Fix a mis-click.** As a player who clicked the wrong bar, I want to click that same
bar again to unset it, and clicking any other bar should start a fresh selection rather than
extending the wrong one. *Today: not possible.*

**S6 · Aim without an end.** As a player who just wants to start from bar 5 and carry on to
the end, I want one click to be enough — I shouldn't have to mark the last bar of the tune.
*Today: one click aims there, but only for a single take.*

### Endings

**S7 · Play the section through.** As a player with Loop off, I want the take to stop at the
end of bar 12 rather than carrying on into the rest of the tune, so the passage is the unit.
*Today: playback always runs to the end of the tune.*

**S8 · Loop the section.** As a player with Loop on and bars 5–12 selected, I want it to
repeat that passage until I stop it. *Today: Loop repeats the whole tune.*

**S9 · Loop the whole tune.** As a player with Loop on and no section, I want the existing
behaviour — round and round the whole thing. *Today: correct.*

### Changing something mid-session

**S10 · Change tune.** As a player switching tunes, I want the new one to start at its own
bar 1 with no section carried over. *Fixed in `93b53d2` for the start point; the section
needs the same treatment.*

**S11 · Change key.** As a player transposing to suit my instrument, I want to keep my place —
whether I was playing or paused when I changed it. *Today: paused keeps the bar, playing
silently drops me at the top.*

**S12 · Train the tempo on a passage.** As a player ramping bars 5–12 up to speed, I want
each pass of *the section* to step the tempo, and I want a trainer take to begin at bar 5 so
the ramp lines up with the music. *Today: the trainer steps per pass of the whole tune, and
resuming mid-take restarts the ramp but not the position, so per-loop mode steps early.*

### Seeing where I am

**S13 · Know where play will begin.** As a player looking at a stopped score, I want the
readout and the highlighted bar to agree, and to survive a window resize. *Today: a
re-render drops the marker while the readout still names a bar.*

**S14 · See the section.** As a player with bars 5–12 selected, I want to see the whole span
marked, and to tell it apart from the bar I happen to be paused in — otherwise play
"mysteriously" refuses to start at the top. *Open decision below.*

### Already correct — don't regress these

**S15 · Bail out during the count-in.** Pausing before the music starts leaves me at the
beginning, not parked on a phantom bar.

**S16 · No re-aiming mid-take.** Clicking the score while playing does nothing; I stop first.

**S17 · Leave and come back.** Switching to Pitch practice and back unmounts the view and
resets it — a fresh start, not a stale selection from ten minutes ago.

**S18 · Catalog refresh.** When the exercise list refreshes in the background my place
survives, because the reset is keyed on `exercise.id` and a refresh keeps the same id.

---

## Model

Replace the one ref with two, each with a single job.

```ts
/** The passage to play. null = the whole tune. STICKY — survives takes. */
export interface Section {
  startBeat: number
  /** Exclusive. null = an armed selection with no end yet: play to the end of the tune (S6). */
  endBeat: number | null
}
const sectionRef   = useRef<Section | null>(null)

/** Where the last take was interrupted. CONSUMED by the next start. */
const pauseBeatRef = useRef<number | null>(null)
```

All the arithmetic goes in a new pure module, `src/audio/section.ts`, so it is unit-testable
without a transport — same shape as `playbackClock.ts` and `meter.ts`.

### Selecting (S1, S5, S6)

One click handler, four cases. `barStart`/`barEnd` are `beatAtMeasure(n)` and
`beatAtMeasure(n + 1)`.

```ts
export function nextSection(current: Section | null, barStart: number, barEnd: number): Section | null
```

| Current | You click | Result |
| --- | --- | --- |
| none | bar N | armed: `{ start: N, end: null }` (S6 — plays N to the end) |
| armed at N | bar N again | cleared (S5) |
| armed at N | bar M | complete, spanning the two in either order: `{ start: min, end: max }` |
| complete | its start bar | cleared (S5) |
| complete | any other bar | a fresh armed selection there (S5 — never extends the wrong one) |

Order-independence on the second click is deliberate: clicking 12 then 5 obviously means
5–12, and refusing it would be a puzzle rather than a safeguard.

**Known consequence — you cannot select a single bar.** Clicking bar 5 twice clears the
selection (decision 2), so there is no click path to a one-bar section; the closest you get
is bars 5–6. That falls out of the clear-on-reclick rule rather than being designed, and it
only matters if drilling one bar is a thing you'd want. Undoing it means the second click on
the armed bar closes a one-bar span and clearing moves elsewhere — a third click, or just
Rewind. Recorded in `section.test.ts` so it stays a decision rather than a surprise.

### Where a take begins (S2, S3)

```ts
export function resolveStartBeat(pauseBeat: number | null, section: Section | null): number | undefined {
  return pauseBeat ?? section?.startBeat ?? undefined   // undefined = from the top
}
```

On every start: resolve, clear `pauseBeat`, **leave `sectionRef` alone**.

Pause wins over the section start because it's the more recent, more specific statement of
where you are (S2). The take still *belongs* to the section, so once it ends you're back at
bar 5 (S3).

**Exception — the Tempo Trainer ignores the pause point** and always begins a take at
`section?.startBeat ?? 0`. A ramp whose tempo curve starts somewhere the music doesn't isn't
training anything (S12).

### The take window (S7, S8, S9)

One idea covers looping, bounding, and the trainer's notion of a pass:

```ts
export interface TakeWindow { startBeat: number; lengthBeats: number }

export function takeWindow(section: Section | null, totalBeats: number): TakeWindow {
  const startBeat = section?.startBeat ?? 0
  return { startBeat, lengthBeats: (section?.endBeat ?? totalBeats) - startBeat }
}

/** Raw clock beat → tune beat, wrapping inside the window while looping. */
export function beatInTake(rawBeat: number, w: TakeWindow, looping: boolean): number {
  if (!looping) return rawBeat
  const rel = (rawBeat - w.startBeat) % w.lengthBeats
  return w.startBeat + (rel < 0 ? rel + w.lengthBeats : rel)
}
```

With no section this reduces to today's `rawBeat % totalBeats`, so the existing behaviour
(S9) falls out rather than being special-cased. Note the window is fixed by the *section*,
not by where this particular take started — resuming at bar 7 inside a 5–12 loop still wraps
back to 5, not to 7.

Loop and section are independent, exactly as decided:

| | Loop off | Loop on |
| --- | --- | --- |
| **No section** | whole tune once | whole tune, repeating (S9) |
| **Section 5–12** | bars 5–12, then stop (S7) | bars 5–12, repeating (S8) |

Wiring, all inside `startPlayback`:

- `totalBeats` for the clock becomes `window.startBeat + window.lengthBeats` when not
  looping (was the tune length), and stays `undefined` when looping.
- The three places that currently do `shouldLoop ? e.beat % total : e.beat` — chord/backing
  scheduling in `onBeat`, `onVisualBeat`, and the note cursor's `noteTick` — all become
  `beatInTake(rawBeat, window, shouldLoop)`.

### Trainer (S12)

Two edits, both replacing the tune length with the window:

- The per-loop step boundary `e.beat > 0 && e.beat % total === 0` becomes
  `(e.beat - window.startBeat) % window.lengthBeats === 0`, so a "loop" means one pass of the
  section.
- On reaching the target tempo, `clock.setTotalBeats(e.beat + total)` becomes
  `+ window.lengthBeats`, so the final full-tempo repetition is one pass of the section.

### Transitions

| Event | `section` | `pauseBeat` | Next take | Story |
| --- | --- | --- | --- | --- |
| Click a bar (stopped) | per the selection table | cleared | section start | S1, S5, S6 |
| Click a bar (playing) | unchanged | unchanged | — | S16 |
| Pause | unchanged | sounding beat | where you paused | S2 |
| Pause during count-in | unchanged | unchanged (beat ≤ 0 rejected) | unchanged | S15 |
| Start / resume | unchanged | **cleared** | resolved | S2, S3 |
| Take ends (window end) | unchanged | — | section start ?? top | S3, S7 |
| Rewind | **cleared** | **cleared** | top | S4 |
| Tune change | **cleared** | **cleared** | top | S10 |
| Transpose | unchanged | sounding beat, if playing | where you were | S11 |
| Catalog refresh, same id | unchanged | unchanged | unchanged | S18 |

`rewind` is the single escape hatch that forgets everything. With a sticky section it becomes
load-bearing rather than decorative.

---

## Three bugs this also fixes

**S11 — transpose is asymmetric.** The Key `<select>` calls `stopPlayback()` directly, which
saves nothing. Fix: call `pausePlayback()` when playing, so the control means the same thing
in both states. Transposition doesn't change bar numbers, so keeping the position is always
correct.

**S12 — the Tempo Trainer resumes half-reset.** `startPlayback` does
`if (plan) setBpm(startBpm)` and re-initialises `rampStartTime`, so resuming mid-take
restarts the ramp while the position stays put. Fixed by the trainer's pause-point exception
above, plus the window-relative step boundary.

**S13 — the parked marker drifts from its readout.** `handleRendered` nulls the SVG binding
when the score re-renders and nothing re-stamps it. Fix: bump a nonce in `handleRendered` and
re-apply from an effect:

```tsx
useEffect(() => {
  noteBindingRef.current?.setActiveMeasure(parkedMeasure)
}, [parkedMeasure, scoreRenderNonce])
```

`parkedMeasure` also changes meaning: it becomes "the bar the next take begins at" —
`measureAtBeat(resolveStartBeat(...))` — rather than "the bar I paused in", so it stays
correct after a take ends with a section set.

---

## How a section looks (S14) — decided by Marc, 2026-08-09

**Tint the whole span.** Every bar in the section gets a background wash; the bar you paused
in keeps the existing solid marker on top, so section and pause are never confused.

```
  bars 5–12 · ♩ = 120

  │ 1 │ 2 │ 3 │ 4 │
  │▒▒5│▒▒6│▒▒7│██8│      ▒ = section
  │▒▒9│▒10│▒11│▒12│      █ = paused in bar 8
  │13 │14 │15 │16 │
```

Implementation notes:

- The wash styles every `data-lily-measure` element from `startMeasure` to `endMeasure`, not
  just the two ends — that is the whole point of the choice, so it has to survive a score
  that wraps across systems.
- The pause marker is the existing `setActiveMeasure` fill and must paint *over* the wash.
- Re-apply on the score-render nonce, exactly like the parked marker (S13) — a resize drops
  the SVG and would otherwise drop the section wash with it.
- Readout becomes `bars 5–12 · ♩ = 120`, and while paused inside a section,
  `bars 5–12 · at 7 · ♩ = 120`.
- An ARMED section (start set, no end yet) has no span to wash. Tint just the start bar so a
  half-made selection still reads as "something is set".

Not blocking, decide later: whether a section persists per exercise across sessions
(`localStorage`, keyed by `exercise.id`) or is forgotten when you switch away.

---

## Implementation order

1. `src/audio/section.ts` + `section.test.ts` — `nextSection`, `resolveStartBeat`,
   `takeWindow`, `beatInTake`. Pure, no transport, no React.
2. Swap `resumeBeatRef` for `sectionRef` + `pauseBeatRef`; route every start through
   `playFromResumePoint` (already the only entry point after `93b53d2`).
3. `handleScoreClick` → `nextSection` (S1, S5, S6).
4. Take window in `startPlayback`: clock bounds and the three beat mappings (S7, S8, S9).
5. Trainer: window-relative step boundary and pause-point exception (S12).
6. Transpose → `pausePlayback` when playing (S11).
7. Marker re-stamp nonce; `parkedMeasure` derived from the resolution (S13).
8. ~~Section UI~~ — DONE 2026-08-09. Stamps `data-giusto-section` on lilyjs's own
   `measure-area` rects; CSS in `index.css` excludes the active measure so the pause marker
   always wins. All eight steps are built; what remains is QA by ear.

Steps 1–2 are safe to land alone: with no section ever set, every function above reduces to
current behaviour.

## Test plan

Unit (`section.test.ts`): the selection table row by row, including the order-independent
second click and both clear paths; `beatInTake` wrapping at the window edge, with and without
a section; `takeWindow` with a null end.

Manual — the first five are regressions the current code gets wrong:

| Story | Steps | Expected |
| --- | --- | --- |
| S1, S3 | Select bars 5–12, play to the end, play again | starts at bar 5 both times |
| S7 | Section 5–12, Loop off, play | stops after bar 12 |
| S8 | Section 5–12, Loop on, play | repeats 5–12, chords and note cursor correct across the wrap |
| S12 | Section 5–12, trainer per-loop, play | tempo steps once per pass of the section |
| S11 | Change key while playing, then while paused | keeps the bar both times |
| S2 | Section 5–12, pause at 7, play; let it end, play | resumes at 7; then back to 5 |
| S5 | Click bar 5, click it again; then click 5, click 9, click 3 | cleared; then a fresh armed selection at 3 |
| S6 | Click bar 5 only, play | plays bar 5 to the end of the tune |
| S4 | Rewind after any of the above | whole tune from the top |
| S10 | Change tune with a section set | no section, top of the new tune |
| S13 | Resize the window while stopped | marker still on the section |
| S15 | Pause during the count-in | top, no parked bar |
