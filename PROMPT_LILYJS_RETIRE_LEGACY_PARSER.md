# ✅ DONE — Prompt for the lilyJS project — retire the legacy `lily-parser` surface

**Resolved 2026-08-10.** lilyJS retired the legacy surface in `a473c5a3`, removing
`src/lily-parser.entry.ts`, `tools/build/build-lily-parser.ts`, its curated
`lily-parser-package.d.ts` and the `build:lily-parser` script. `packages/lily-parser` and
`packages/lily-viewer` are deleted from Giusto and cannot come back on a sync.

`lily-viewer`'s provenance turned out to be the interesting part: it is a **pre-rename build
of lilyJS itself** — the vendored bundle carries lilyJS's `[lily-viewer]` log prefix, and
lilyJS's `src/appMeta.ts` still defaults `APP_NAME` to `'lily-viewer'`. No source survived
under that name because the source *is* lilyJS. So the comparison page's third panel was
comparing the current renderer against its own ancestor.

**One correction to lilyJS's correction.** Their report says the legacy runtime always
emitted the tempo dot and only the shipped declaration dropped it. That is true of lilyJS's
current source; it is **not** true of the build Giusto had vendored. Verified by running the
vendored package before deleting it:

```
parseDocument('\tempo 4. = 84')  ->  { noteIndex: 0, bpm: 84, beatUnitDenominator: 4 }
```

No `beatUnitDots` at runtime, and the vendored `index.d.ts` declared the same five fields
without it. So in *this* artifact the declaration and the runtime agreed — both simply
predated dot support. Both statements are true of different builds.

Blast radius: none. Nothing in Giusto ever computed a BPM from the legacy type —
`chordSchedule.ts` imports `TempoMarkLike` from **lilyjs**, which does carry `beatUnitDots`,
and that is where the dot factor is applied.

Kept as a record of the ask and its outcome. The original prompt follows.

---

## Original prompt

Written 2026-08-09. **This is work for the lilyJS repo, not for Giusto** — paste the fenced
block below into a session in `../lilyJS`. Giusto never edits lilyJS build tooling; it only
vendors the built artifacts.

Companion prompt: `PROMPT_LILYJS_PUBLISH_TYPES.md` asks lilyJS to ship declarations with the
modern bundle. Independent of this one, and doable in either order.

## Why this exists

Giusto vendors three packages built from lilyJS:

| Package | Version | Provenance | Used by |
|---|---|---|---|
| `lilyjs` | v0.14.0 | `upstream.json` records repo, tag and commit | everything in production |
| `lily-parser` | `0.1.0-vendored` | none | dev-only `?compare` page |
| `lily-viewer` | `0.1.0-vendored` | none, and its source no longer exists | dev-only `?compare` page |

Giusto wants to delete the two legacy packages. The blocker is upstream: unless the legacy
surface is retired in lilyJS, it simply reappears on the next sync.

What was verified in `../lilyJS` on 2026-08-09 (read-only):

- One parser implementation, two published API surfaces. `src/lilyjs.ts` exports the modern
  `parseSource` from `./music-input`; `src/lily-parser.entry.ts` projects the *same*
  `src/music-input/lilypond/` tree through the older `parseDocument` / `ParsedTune` /
  `DocumentBlock` API, built by `tools/build/build-lily-parser.ts` into `dist/lily-parser`.
- The legacy target is already semi-orphaned: the default `build` script runs only
  `build:web && build:lilyjs`, so `build:lily-parser` is built by hand.
- The legacy projection **loses information the modern one keeps**. Tempo marks come out as
  `{ noteIndex, text, bpm, beatUnitDenominator }` with no dot field, while lilyjs emits
  `beatUnit` plus `beatUnitDots`. Same parse, worse output — see the vendored copies in
  `packages/lily-parser/index.js` and `packages/lilyjs/lilyjs.esm.js` for the two emit sites.

Related: [[TODO.md]] "Staff Rendering Comparison" records the Giusto-side decision that is
waiting on this, and `PLAN_PLAYBACK_START_POINT.md` is unrelated but shows the house style
for these documents.

---

## The prompt

```
In this repo we publish two API surfaces over the same parser, and I want to
retire the legacy one.

- `src/lilyjs.ts` exports the modern `parseSource` (re-exported from
  `./music-input`), built by `tools/build/build-lilyjs.ts`.
- `src/lily-parser.entry.ts` is a legacy entry exporting `parseDocument` /
  `ParsedTune` / `DocumentBlock`, built by `tools/build/build-lily-parser.ts`
  into `dist/lily-parser`.

Both project the same `src/music-input/lilypond/` tree. The default `build`
script already runs only `build:web && build:lilyjs`, so `build:lily-parser`
is a manual, semi-orphaned target.

The legacy projection also drops information the modern one keeps. For tempo
marks it emits `{ noteIndex, text, bpm, beatUnitDenominator }` — no dot field —
whereas lilyjs emits `beatUnit` plus `beatUnitDots`. So `\tempo 4. = 84` comes
out of the legacy API as an undotted quarter, and any consumer computing a bpm
from it is wrong by the dot factor (1.5x for one dot).

What I'd like you to do:

1. Find every consumer of `lily-parser` and of the legacy `parseDocument` /
   `ParsedTune` / `DocumentBlock` types, inside this repo and in any sibling
   project you can see. Report what you find before changing anything — if
   something real still depends on it, I want to know rather than break it.

2. Assuming nothing essential depends on it, remove the legacy surface:
   `src/lily-parser.entry.ts`, `tools/build/build-lily-parser.ts`, and the
   `build:lily-parser` script, plus any tests or docs that only exist to serve
   it. One parser, one published API.

3. If it turns out something does still need `parseDocument`, don't leave two
   parallel projections. Reimplement the legacy entry as a thin adapter over
   `parseSource` so the two cannot drift, and fix the tempo-dot loss as part of
   that. Say which option you took and why.

4. Separately: is there still a `lily-viewer` renderer artifact, or has the
   lilyjs renderer fully superseded it? A downstream project is carrying a
   frozen `lily-viewer` build with no recorded provenance and no surviving
   source, and I want to know whether it can simply delete it and render
   through lilyjs instead, or whether something is still missing on the lilyjs
   side that lily-viewer provided.

Context for why this matters downstream: Giusto vendors three packages from
here — `lilyjs` (v0.14.0, with an upstream.json recording repo/tag/commit),
plus `lily-parser` and `lily-viewer` (both `0.1.0-vendored`, no provenance).
Only a development-only comparison page still uses the two legacy ones;
everything in production goes through lilyjs. Once you confirm the legacy
surface is retired upstream, Giusto can delete both vendored packages without
worrying they reappear on the next sync.
```

---

## After lilyJS answers

- Legacy surface removed → delete `packages/lily-parser` and (if the renderer question
  clears) `packages/lily-viewer`, plus `src/vendoredPackages.test.ts`, `StaffViewLilyPond.tsx`
  and whatever else in the `?compare` page depends on them.
- Legacy surface kept as an adapter → re-vendor and confirm tempo dots survive the round trip
  before trusting any bpm read through it.
