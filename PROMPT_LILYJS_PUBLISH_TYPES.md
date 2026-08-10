# Prompt for the lilyJS project — ship type declarations with the lilyjs bundle

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
- The **legacy** `tools/build/build-lily-parser.ts` *does* ship types, and not generated ones
  either: it copies a curated `tools/build/lily-parser-package.d.ts` to
  `dist/lily-parser/index.d.ts`. The deprecated artifact has a type story; the modern one
  does not.
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
`build:lilyjs` publishes a bundle with no type declarations, and I want it to
ship types the way `build:lily-parser` already does.

Current state:

- `tools/build/build-lilyjs.ts` emits only `dist/lilyjs.esm.js`. There is no
  `--declaration`, no `emitDeclarationOnly`, no `.d.ts` step.
- `tools/build/build-lily-parser.ts` writes `dist/lily-parser/index.d.ts` by
  copying the curated `tools/build/lily-parser-package.d.ts`.

So the deprecated artifact has a type story and the modern one does not. The
downstream consequence is that Giusto hand-maintains a 411-line
`packages/lilyjs/index.d.ts` of structural approximations, and its sync script
prints a warning telling whoever ran it to update that file by hand if the API
changed. Nothing verifies the two agree, so a renamed or removed export
type-checks fine downstream and fails at runtime in the browser.

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

## After lilyJS answers

- Declarations published → add the copy to `scripts/sync-lilyjs.sh`, delete
  `packages/lilyjs/index.d.ts` and the "hand-maintained" warning, and rename any Giusto types
  that were structural stand-ins for real lilyJS names.
- Declined or deferred → add a drift test on this side instead: assert every value declared in
  `packages/lilyjs/index.d.ts` is actually exported by `packages/lilyjs/lilyjs.esm.js`, so a
  rename upstream fails a test here rather than in someone's browser.
