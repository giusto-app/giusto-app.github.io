# PLAN — consume `lilyjs` from GitHub Packages instead of vendoring it

> **DONE 2026-08-10.** Giusto now depends on `@marcmouries/lilyjs@^0.15.1` from
> GitHub Packages; `packages/lilyjs` and the whole sync machinery are gone.
> Build and 188 tests pass against the published package. Remaining by hand:
> grant this repo access under the package's "Manage Actions access" (CI cannot
> install a private package from another repo without it), and add a
> `DEPENDABOT_PACKAGES_TOKEN` secret so update PRs actually open.

**Goal:** stop vendoring the lilyJS bundle. Depend on a published package and let
an automated bump PR bring in each new version, so getting the latest lilyJS
costs a review rather than a local checkout and a hand-run script.

**Constraint (2026-08-10):** `lilyjs` is taken on public npm and lilyJS stays
PRIVATE for now, so it publishes as **`@marcmouries/lilyjs` to GitHub
Packages**. Verified: `MarcMouries/lilyJS` is a private repository, and a
GitHub Packages npm package inherits the visibility of the repository it is
published from — so the package is private and only principals with read access
can install it. That is free and fits the existing GitHub remote, but it carries one
real cost this plan has to absorb: **GitHub Packages requires authentication for
every install**, including CI and every developer machine. See Task 1.

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

Wait for: the published scope and version, fonts either inside the
package or with a documented copy step, and `exports["./style.css"]` repointed
at `dist/` (it currently points into `src/`, which will not exist in a tarball).
See the companion plan.

## Task 1 — registry auth, the new cost

Vendoring needed no credentials. GitHub Packages does, for every install.

- [ ] `.npmrc` in the repo, committed, with the scope mapping only — never a
      token:

      @marcmouries:registry=https://npm.pkg.github.com
      //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}

- [ ] **CI — the cross-repo catch.** `permissions: { packages: read }` plus
      `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` is NOT automatically
      sufficient here. A workflow's `GITHUB_TOKEN` is scoped to the repository
      it runs in, and the package lives in a DIFFERENT (private) repository,
      `MarcMouries/lilyJS`. Same owner does not by itself grant access.
      Two ways to resolve it, in preference order:
      1. In the package's settings on GitHub, grant the Giusto repository read
         access ("Manage Actions access"). Then Giusto's own `GITHUB_TOKEN`
         works and no secret has to be created or rotated.
      2. Failing that, a PAT with `read:packages` stored as a repository secret
         — simpler to set up, but it is a credential someone has to own,
         rotate, and remember to renew when it expires.
      Verify this on a real CI run before deleting the vendored package; a 401
      here is the difference between "installs locally" and "deploys".
- [ ] **Local dev**: each developer needs a classic PAT with `read:packages` in
      their environment. Document it in README — an unset token fails install
      with a 401 that does not obviously say "you need a token".
- [ ] **GitHub Pages deploy**: confirm the deploy workflow installs dependencies
      too, and give it the same permission. This is the step most likely to be
      missed, because it works locally and fails only on deploy.

## Task 2 — swap the dependency

- [ ] `package.json`: replace `"lilyjs": "workspace:*"` with the alias
      `"lilyjs": "npm:@marcmouries/lilyjs@^0.15.0"`. **Every `import … from
      'lilyjs'` stays unchanged** — no import rewrite anywhere in `src/`.

      Tested 2026-08-10 with the real lilyJS 0.14.0 build under Bun 1.3.14:
      `dist/` packed as `@marcmouries/lilyjs@0.14.0` and installed under the
      bare key `lilyjs`. `node_modules/lilyjs` reported the scoped name, the
      runtime import parsed a score, and `TempoMark` / `Rational` /
      `PlaybackTimeline` resolved from the real `dist/index.d.ts` — a deliberate
      wrong annotation failed with TS2322 while the rest passed, so the types
      are real and not `any`.

      Caveat: that test installed a packed tarball via `file:`, which proves the
      name-mismatch resolution but not the `npm:` registry fetch. Confirm on the
      first real install from GitHub Packages.

## Task 3 — delete the vendoring machinery

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

## Task 4 — fonts

`sync-lilyjs.sh` copies 6 `.woff2` from lilyJS `src/` into
`public/lilyjs/fonts/`. Whichever way the companion plan lands:

- **Fonts inside the package** → copy from `node_modules/lilyjs/...` in
  `scripts/buildApp.ts`, or import them so the bundler fingerprints them. The
  version can then never skew from the bundle expecting it.
- **Fonts as a separate asset** → keep a copy step, but source it from
  `node_modules` rather than a sibling checkout.

Either way the sibling-clone dependency disappears, which is the point.

## Task 5 — automatic updates

This is the step that actually delivers "no manual work". Everything above just
removes obstacles.

- [ ] Add **Renovate** or **Dependabot** for npm dependencies. Both support
      GitHub Packages, but each needs the registry and credentials declared in
      its own config — Dependabot via `registries:` in
      `.github/dependabot.yml` plus a `packages: read` token secret. A bot that
      cannot authenticate silently opens no PRs, which looks identical to "no
      updates available", so verify it actually fires on the first release.
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
2. Task 1 first and on its own — auth is the step that can fail in three places
   (local, CI, deploy) and is easiest to debug before anything else moves.
3. Task 2 on a branch: prove the app builds and renders against the package.
4. Tasks 3 and 4 in the same branch, so `packages/` and the sync scripts go
   together and nothing is left half-vendored.
5. Task 5 last, once the dependency is real and CI is green on it.

If auth turns out to be more friction than it is worth — three token setups for
one dependency — the honest fallback is keeping the vendored bundle and
automating the sync with a scheduled Action that opens a PR. It keeps 2.4 MB in
git history, which is the thing this plan set out to remove, but it needs no
credentials on any developer machine.
