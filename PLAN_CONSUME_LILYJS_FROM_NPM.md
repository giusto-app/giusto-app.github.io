# PLAN — consume `lilyjs` from npm instead of vendoring it

**Goal:** stop vendoring the lilyJS bundle. Depend on a published package and let
an automated bump PR bring in each new version, so getting the latest lilyJS
costs a review rather than a local checkout and a hand-run script.

Companion: `../lilyJS/PLAN_PUBLISH_TO_NPM.md` is the publishing half. **That side
must land first** — nothing here can start until a version is on npm. The
current vendoring keeps working untouched until then, so there is no flag day.

## What is actually manual today

`bun run sync:lilyjs` does more than it gets credit for: it clones the newest
`v*` tag into a temp dir, installs, builds, copies the bundle, writes
`upstream.json`, and copies the fonts. What remains manual is structural, not
missing effort:

1. **It needs a sibling clone of lilyJS** (`../lilyJS`, or `LILYJS_DIR`). CI
   checks out only this repo, so the sync can never run there.
2. **Someone must run it and commit the result** — a 2.4 MB `lilyjs.esm.js` into
   git history on every update.
3. **`packages/lilyjs/index.d.ts` was hand-maintained** — 411 lines of
   structural approximations, with `sync-lilyjs.sh` printing a warning telling
   whoever ran it to update the file by hand. Fixed upstream on 2026-08-10:
   `build:lilyjs` now emits `dist/index.d.ts`.

## Prerequisite from lilyJS

Wait for: a published package name and version, fonts either inside the package
or with a documented copy step, and `exports["./style.css"]` repointed at
`dist/` (it currently points into `src/`, which will not exist in a tarball).
See the companion plan.

## Task 1 — swap the dependency

- [ ] `package.json`: replace `"lilyjs": "workspace:*"` with the published
      version, e.g. `"lilyjs": "^0.15.0"`.
- [ ] `bun install`, then confirm `src/pages/practice/LilyScore.tsx` and
      `PracticePlayback` type-check and render unchanged.
- [ ] Confirm the types resolve from the package rather than a local file —
      the published `package.json` carries `"types": "./index.d.ts"`.

## Task 2 — delete the vendoring machinery

All of this exists only to move the bundle across by hand:

| Target | Note |
|---|---|
| `packages/lilyjs/` | the vendored bundle, hand-written `index.d.ts`, `upstream.json` |
| `scripts/sync-lilyjs.sh` | low-level copier |
| `scripts/sync-lilyjs-release.sh` | tag checkout + build wrapper (`bun run sync:lilyjs`) |
| `scripts/checkLilyjsSync.ts` | pre-push version check against a local lilyJS clone |
| `.githooks/pre-push` | line 7 `exec bun run scripts/checkLilyjsSync.ts` — remove that call; keep the hook if it does anything else |
| `package.json` | the `sync:lilyjs` script and the `lilyjs` workspace entry |

Note `workspaces` is `packages/*`. After the legacy packages were deleted
(`66cc5f6`) and `lilyjs` goes, `packages/` is empty — drop the `workspaces`
field entirely rather than leaving it pointing at nothing.

## Task 3 — fonts

`sync-lilyjs.sh` copies 6 `.woff2` from lilyJS `src/` into
`public/lilyjs/fonts/`. Whichever way the companion plan lands:

- **Fonts inside the package** → copy from `node_modules/lilyjs/...` in
  `scripts/buildApp.ts`, or import them so the bundler fingerprints them. The
  version can then never skew from the bundle expecting it.
- **Fonts as a separate asset** → keep a copy step, but source it from
  `node_modules` rather than a sibling checkout.

Either way the sibling-clone dependency disappears, which is the point.

## Task 4 — automatic updates

This is the step that actually delivers "no manual work". Everything above just
removes obstacles.

- [ ] Add **Renovate** or **Dependabot** for npm dependencies.
- [ ] Confirm CI runs `bun run build` and `bun test` on the bump PR, so a
      breaking lilyJS change fails the PR rather than production.
- [ ] Decide the update policy: auto-merge patch, review minor. lilyJS is
      pre-1.0, so minor versions can carry breaking changes — do not auto-merge
      them.

## Keep one check on this side

lilyJS's published declarations guard NAMES but not SHAPES — a renamed or
removed export now fails upstream before it can reach us, but a materially
changed signature still will not (their curated `.d.ts` cannot assert
assignability without becoming a 418-file emitted tree; the reasoning is in
`tools/build/lilyjs-package.d.ts`).

So the fallback drift test from `PROMPT_LILYJS_PUBLISH_TYPES.md` is still worth
keeping, now pointed at `node_modules/lilyjs`: assert every value our code
imports is actually exported by the installed bundle. It is a few lines and it
catches the class of break that types cannot.

## Order of work

1. lilyJS publishes (companion plan).
2. Task 1, on a branch — prove the app builds and renders against the package.
3. Tasks 2 and 3 in the same branch, so `packages/` and the sync scripts go
   together and nothing is left half-vendored.
4. Task 4 last, once the dependency is real and CI is green on it.
