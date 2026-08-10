# PLAN — delete the vendored `lily-parser` and `lily-viewer` packages

Written 2026-08-10. **This is work for Giusto.** It is the follow-through on
`PROMPT_LILYJS_RETIRE_LEGACY_PARSER.md`, which asked lilyJS to retire the legacy
surface so these two packages could not reappear on the next sync.

## The blocker is cleared

lilyJS retired the legacy API surface on 2026-08-10, commit `a473c5a3`
*"Retire the legacy lily-parser API surface: one parser, one published API"*.
Removed there: `src/lily-parser.entry.ts`, `tools/build/build-lily-parser.ts`,
its curated `tools/build/lily-parser-package.d.ts`, and the `build:lily-parser`
script. There is no longer any way to rebuild `packages/lily-parser`, and it
will not come back on a sync. `packages/lilyjs` is untouched and stays.

lilyJS ran a consumer search across all sibling projects first. Giusto is the
only consumer, and only from the dev-only `?compare` page — plus one smoke test
that the original prompt did not mention (`src/vendoredPackages.test.ts`).

## `lily-viewer` needs no replacement

Its provenance is no longer a mystery: it is a **pre-rename build of lilyJS
itself**. The vendored bundle carries lilyJS's own `[lily-viewer]` log prefix,
and lilyJS's `src/appMeta.ts` still defaults `APP_NAME` to `'lily-viewer'`. That
is why no source survives under that name — the source is lilyJS, since renamed
to `lily-js`.

Everything `StaffView` is used for here is already on the public lilyjs API:
`MusicRendererOptions extends Partial<RenderScoreOptions>`, which carries
`fontFamily`, `showTitle` and `measureRange`, and `renderScore` spreads them
through. Nothing is missing on the lilyjs side.

## What to delete

| Target | Action |
|---|---|
| `packages/lily-parser/` | delete |
| `packages/lily-viewer/` | delete |
| `package.json` | drop the `lily-parser` and `lily-viewer` `workspace:*` deps (`workspaces` is `packages/*`, so removing the directories is sufficient on its own — drop the deps too for tidiness) |
| `src/vendoredPackages.test.ts` | imports `parseDocument` from `lily-parser`; delete that describe block, or the file if that is all it covers |
| `src/pages/practice/StaffViewLilyPond.tsx` | the only real consumer — imports `parseDocument` / `ParsedTune` / `DocumentBlock` from `lily-parser`, and `StaffView` + `style.css` from `lily-viewer` |
| `src/pages/practice/StaffComparison.tsx` | renders `StaffViewLilyPond` as its third panel, label `"lily-viewer (LilyPond parser)"` |

Nothing in the production path is affected. `src/main.tsx` reaches
`StaffComparison` only behind `?compare`, via a dynamic import; the default
render is `App`, which uses lilyjs through `src/pages/practice/LilyScore.tsx`.

## Decide what happens to the comparison page

[[TODO.md]] "Staff Rendering Comparison" already resolved this in substance:
Option C is **moot** — "the production app renders through `lilyjs` everywhere …
There is no live decision left for it to inform." So the third panel has no
constituency. Three ways to land it:

- **(a) Drop the third panel.** The page keeps comparing Custom SVG vs VexFlow 4.
  Smallest change, consistent with the audit that already called Option C moot.
- **(b) Repoint the panel at the current renderer** by swapping
  `StaffViewLilyPond` for `LilyScore`, so the page compares Custom SVG vs
  VexFlow vs *current* lilyjs. Probably the more useful page. `LilyScore` takes
  `source` / `scoreIndex` / `title` / `width` / `transposeSemitones`, but **not**
  `noteEvents` — the per-note intonation labels under the staff live in
  `StaffViewLilyPond`, so port that markup across if you want to keep them.
- **(c) Delete the page.** Defensible now that the comparison it existed to
  settle is settled; it also removes the last reason to carry VexFlow.

## Do not expect a main-bundle win

Those renderers already sit behind the dynamic import added 2026-08-09. Per
[[TODO.md]], initial JS is 1,585,108 bytes and the compare chunk is 2,054,305
bytes, loaded only on `?compare`. Deleting these two packages shrinks **that
chunk** and the repo — not the bundle every user downloads. Option (c) would
also take VexFlow out of the compare chunk.

## Correction to the record

`PROMPT_LILYJS_RETIRE_LEGACY_PARSER.md` says the legacy projection "loses
information the modern one keeps" for tempo dots. lilyJS checked this: the
**runtime always emitted the dot**. `parseDocument` on `\tempo 4. = 84` returns
`{noteIndex: 0, bpm: 84, beatUnitDenominator: 4, beatUnitDots: 1}`.

What dropped it was the hand-curated declaration shipped as the package's
`index.d.ts`, which listed only
`noteIndex` / `text` / `bpm` / `beatUnitDenominator` / `isExpression`. Our
vendored `packages/lily-parser/index.d.ts` has that same gap while its
`index.js` emits the dot. So the practical consequence still stands — a
TypeScript consumer could not see the field and would treat a dotted quarter as
undotted, short by 1.5x — but the cause was a stale declaration, not a lossy
parse. Worth checking whether anything here computed a BPM from that type.

## This raises the priority of the other prompt

[[TODO.md]] records an open blocker: `packages/lilyjs/index.d.ts` is 411
**hand-written** lines because `build:lilyjs` emits no declarations, with
nothing verifying they match the bundle. The tempo-dot bug above is exactly that
failure mode, already realised once: a hand-maintained `.d.ts` silently drifted
from its own runtime and misled consumers for months.

`PROMPT_LILYJS_PUBLISH_TYPES.md` is the fix and is still open. Note that its
current text cites `build:lily-parser` as the precedent that "does emit
declarations" — that script no longer exists, so reword that argument before
sending. The stronger argument now is the tempo-dot bug itself.

## Verify

- the app builds, and `?compare` either still loads or is gone by choice
- tests pass
- `grep -rn "lily-parser\|lily-viewer" src/ package.json` returns nothing
- `packages/` contains only `lilyjs`
