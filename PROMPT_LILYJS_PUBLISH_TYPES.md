# Prompt for the lilyJS project — ship type declarations with the lilyjs bundle

> **ANSWERED 2026-08-10 — lilyJS shipped this (commit `09b43281`, "build:lilyjs
> publishes type declarations"). The prompt below is kept as the record of what
> was asked; the answer and the resulting Giusto work are at the bottom under
> [What lilyJS did](#what-lilyjs-did).**

Written 2026-08-09. **This is work for the lilyJS repo, not for Giusto** — paste the fenced
block below into a session in `../lilyJS`. Companion to
`PROMPT_LILYJS_RETIRE_LEGACY_PARSER.md`; the two are independent and can be done in either
order, though both are about lilyJS having one properly published surface.

## Why this exists

`bun run sync:lilyjs` ends with:

> `packages/lilyjs/index.d.ts` is hand-maintained — update it if the API surface you use changed.

Verified in `../lilyJS` on 2026-08-09 (read-only):

- `tools/build/build-lilyjs.ts` emits **only** `dist/lilyjs.esm.js`. No `--declaration`, no
  `emitDeclarationOnly`, no `.d.ts` step — so `sync-lilyjs.sh` has nothing to copy.
- ~~The legacy `build:lily-parser` ships curated types~~ — **that script was deleted on
  2026-08-10 (`a473c5a3`)**, so it is no longer available as precedent. Do not cite it.
  The stronger argument is now the tempo-dot episode below.
- Giusto therefore hand-writes `packages/lilyjs/index.d.ts` — 411 lines of structural
  approximations (`ScoreLike`, `MeasureLike`, `TempoMarkLike`; the `Like` suffix is the tell).
  Its own header already names the fix: *"publish lilyjs to npm with generated declarations
  and delete this file."*

**The failure mode this creates.** Nothing checks the declarations against the bundle.
`checkLilyjsSync.ts` compares versions only. If lilyJS renames or drops an export, Giusto's
`index.d.ts` keeps asserting it exists, TypeScript compiles cleanly against the lie, and it
fails at runtime in the browser.

Not proposed: generating declarations from Giusto's side. Running `tsc --emitDeclarationOnly`
over lilyJS sources in the sync temp checkout would emit the whole internal type graph —
hundreds of types, internal module paths, lilyJS's real names instead of the deliberately
loose structural ones — and would mean recompiling another project's TypeScript inside a copy
script. Worse than what exists.

---

## The prompt

```
`build:lilyjs` publishes a bundle with no type declarations, and I would like it
to ship them.

`tools/build/build-lilyjs.ts` emits only `dist/lilyjs.esm.js` — no
`--declaration`, no `emitDeclarationOnly`, no `.d.ts` step. So Giusto
hand-maintains a 411-line `packages/lilyjs/index.d.ts` of structural
approximations, and its sync script prints a warning telling whoever ran it to
update that file by hand if the API changed. Nothing verifies the two agree, so
a renamed or removed export type-checks fine downstream and fails at runtime in
the browser.

We already know that failure is real rather than theoretical, because it
happened. When you retired the legacy parser you found that its shipped
declaration listed only noteIndex / text / bpm / beatUnitDenominator /
isExpression while the runtime also returned beatUnitDots — a hand-maintained
.d.ts that had drifted from its own implementation and quietly told every
TypeScript consumer that dotted tempo marks did not exist. That is the same
setup `packages/lilyjs/index.d.ts` is in today, just with nobody having tripped
over it yet.

What I'd like you to do:

1. Decide between generated and curated declarations, and say why you chose it.
   - GENERATED (`tsc --emitDeclarationOnly` over the lilyjs entry) cannot drift
     from the implementation, but exposes whatever the entry re-exports —
     including internal types — and makes every internal rename a downstream
     breaking change unless the public entry is tight.
   - CURATED (a `tools/build/lilyjs-package.d.ts` copied into `dist/`, mirroring
     what build:lily-parser does) keeps the published surface deliberate and
     small, at the cost of being hand-written — the problem I am trying to
     solve, just moved upstream where it belongs.
   My instinct is curated, since it matches the existing pattern and the public
   surface is small; but if the entry file is already a tight re-export list,
   generated is better because it cannot lie. Look before deciding.

2. Whichever you pick, make `build:lilyjs` emit `dist/index.d.ts` (or
   `dist/lilyjs.d.ts`) alongside the bundle, and set `types` in whatever package
   metadata the bundle ships with so a consumer resolves it automatically.

3. Add a check that the published declarations and the built bundle agree: every
   VALUE the .d.ts declares should actually be exported by `lilyjs.esm.js`. If
   you choose curated declarations this is the guard that keeps them honest; a
   test in this repo is the right home for it, since it can run on every build
   rather than only when someone syncs downstream.

4. Tell me the resulting file path and whether the shape of the exported names
   changed, so I can update `scripts/sync-lilyjs.sh` to copy it and delete the
   hand-written file.

For scope, this is the entire surface Giusto imports from `lilyjs` today —
anything outside it does not need to be published on my account:

  values:  parseSource, renderLily, renderScore, resolveSelection, measureRange,
           transpose, transposedKeyName, createSvgPlaybackBinding,
           createArpeggioPlan, buildPlaybackTimelineFromScore, rationalToNumber
  types:   ScoreLike, MeasureLike, MusicalEventLike, TempoMarkLike, Rational,
           MusicDocumentBlock, SvgPlaybackBinding, SpelledPitchClass,
           ArpeggioPlan, ArpeggiatorOptions, ConductorMap, PlaybackTimeline,
           NormalizedHarmonyEvent

Note the `Like` suffixes: those are Giusto's own structural stand-ins, not names
from this repo. If the real exported types are called something else, say so and
I will rename downstream — I would rather use your names than keep approximating
them.
```

---

## What lilyJS did

Answered 2026-08-10, commit `09b43281`. Declarations are **published**, so the first
branch below applies.

### The decision: curated, and it was measured rather than assumed

lilyJS chose a curated single file over `tsc --emitDeclarationOnly`, but not for the
reason this prompt guessed. `src/lilyjs.ts` is **not** a tight re-export list: two
`export *` wildcards (`./music-playback`, `./music-tools/generators/arpeggiator`) put
**83 values** on the bundle.

They tested generated emit rather than reasoning about it: `tsc --emitDeclarationOnly`
over the entry produces **418 `.d.ts` files / 1.8 MB**, and the same over a deliberately
narrow public entry produces 418 as well, because tsc emits for every file in the
*program* rather than the reachable types, and there is no `.d.ts` bundler in that
toolchain.

Worth noting: the "Not proposed" paragraph above predicted exactly this — "would emit the
whole internal type graph — hundreds of types". That was right, and it turns out to be
true on lilyJS's side too, not just ours.

### What ships

| Artifact | Notes |
|---|---|
| `dist/index.d.ts` | curated, from `tools/build/lilyjs-package.d.ts` |
| `dist/package.json` | `"types": "./index.d.ts"` |

Our vendored `packages/lilyjs/package.json` **already** declares
`"types": "./index.d.ts"`, so no metadata change is needed here — the sync just has to
copy the file next to the bundle.

### Renames — three of our stand-ins were real names all along

Nine of the thirteen types we listed were already correct. Four to change:

| Our name | Real lilyJS name | Was it published before? |
|---|---|---|
| `ScoreLike` | `Score` | yes, we were approximating unnecessarily |
| `MeasureLike` | `Measure` | yes, same |
| `MusicalEventLike` | `MusicalEvent` | **no — added 2026-08-10** |
| `TempoMarkLike` | `TempoMark` | **no — added 2026-08-10** |

`MusicDocumentBlock`, `Rational`, `SvgPlaybackBinding`, `SpelledPitchClass`,
`ArpeggioPlan`, `ArpeggiatorOptions`, `ConductorMap`, `PlaybackTimeline` and
`NormalizedHarmonyEvent` are all real names already. `MusicDocumentBlock` simply was not
exported from the lilyjs entry either. All three missing types were already exported by
`music-model`; only the entry omitted them, which is why we ended up approximating.

**`TempoMark` is the type carrying `beatUnitDots`** — the field the retired lily-parser
declaration dropped. lilyJS added a dedicated guard line that fails if it disappears again.

### The guarantee, and its limit

Two guards run in lilyJS on every build, both mutation-verified there:

1. Every value the declaration exports is exported by the built `dist/lilyjs.esm.js`, and
   the published surface can never shrink below the value list we gave them.
2. Every published name still resolves from `src/lilyjs`, checked by `tsc`.

**Shapes are not mechanically checked.** lilyJS tried and reported why: function
parameters are contravariant, so asserting the implementation satisfies the curated types
only holds if the curated file mirrors the implementation exactly — the 418-file tree the
design avoids. It fails on `Score` alone, which really carries `annotations` / `info` /
`directives` / `lyrics` and more than the published subset names.

So a **renamed or removed** export now fails upstream before it can reach us; a
**materially changed signature** still will not. That is a real improvement over the
status quo, not a complete one — worth keeping in mind before deleting every check on
this side.

## Giusto follow-up

- [ ] `scripts/sync-lilyjs.sh` — copy `dist/index.d.ts` to `packages/lilyjs/index.d.ts`
      alongside the bundle.
- [ ] Delete the hand-written 411-line `packages/lilyjs/index.d.ts` (the copy replaces it)
      and the "hand-maintained — update it if the API surface you use changed" warning that
      `bun run sync:lilyjs` prints.
- [ ] Rename the four stand-ins per the table above: `ScoreLike` → `Score`,
      `MeasureLike` → `Measure`, `MusicalEventLike` → `MusicalEvent`,
      `TempoMarkLike` → `TempoMark`.
- [ ] Check whether anything here derives a BPM from a tempo mark without reading
      `beatUnitDots`; a dotted `\tempo 4. = 84` is 1.5x what an undotted reading gives.
- [ ] Consider keeping a light drift test on this side anyway, given the shape limit above
      — the "declined or deferred" fallback from the original plan is still cheap insurance:
      assert every value declared in `packages/lilyjs/index.d.ts` is exported by
      `packages/lilyjs/lilyjs.esm.js`.
