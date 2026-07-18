# Pre-Cloudflare implementation checklist

These changes can be implemented and reviewed before migrating Giusto away from GitHub Pages. They establish safe caching, hosting-neutral application boundaries, precomputed rendering support, and testable entitlement behavior without committing to Cloudflare, Supabase, or Stripe infrastructure.

For the broader architecture and rationale, see [PREMIUM-DEPLOYMENT-ARCHITECTURE.md](./PREMIUM-DEPLOYMENT-ARCHITECTURE.md).

## Recommended implementation order

### 1. Fix the service worker

This is the highest-priority prerequisite. `public/sw.js` currently caches every successful GET response.

Change it to:

- cache only explicit same-origin static assets and hashed build assets;
- never cache `/api/*`, authenticated requests, Supabase endpoints, signed URLs, or premium resources;
- use network-only behavior for account and entitlement requests;
- avoid caching opaque cross-origin responses by default;
- clear the old unrestricted cache during activation;
- support an explicit private-data/cache purge message on logout or account change;
- use versioned cache names and a controlled offline fallback.

Add tests confirming that API, authorization-bearing, private, and signed-URL responses never enter Cache Storage.

### 2. Introduce content-source abstractions

Refactor `PracticePlayback` so it does not assume every exercise is public LilyPond source:

```ts
type ExerciseContent =
  | { kind: 'lilypond-source'; source: string }
  | { kind: 'rendered-artifact'; artifact: RenderedExerciseArtifact }
```

Define the protected/precomputed artifact contract:

```ts
interface RenderedExerciseArtifact {
  schemaVersion: 1
  resourceId: string
  artifactVersion: string
  rendererVersion: string
  width: number
  svg: string
  playback: {
    bpm?: number
    notes: NotePlaybackEvent[]
    chords: ChordPlaybackEvent[]
  }
}
```

Make parsing, rendering, playback scheduling, and note highlighting work with either representation. This is the central client refactor needed for protected precomputed rendering.

Likely files:

- `src/pages/practice/PracticePlayback.tsx`
- `src/pages/practice/LilyScore.tsx`
- new `src/premium/artifact.ts`
- new `src/premium/ProtectedScore.tsx`

### 3. Separate catalog access from asset URLs

Current catalog entries expose direct public asset locations through `exerciseUrl(entry)`. Introduce a repository interface:

```ts
interface ExerciseRepository {
  list(): Promise<ExerciseCatalogEntry[]>
  load(entry: ExerciseCatalogEntry): Promise<ExerciseContent>
}
```

Initial implementations:

- `BundledExerciseRepository` for the offline bundled exercise;
- `PublicExerciseRepository` for the current GitHub-hosted catalog;
- `MockPremiumExerciseRepository` for local development and tests.

Later, a server-backed premium repository can replace the mock without changing the picker or playback UI. Premium records should use opaque resource IDs rather than storage paths or direct URLs.

Likely files:

- `src/hooks/useExerciseCatalog.ts`
- new `src/exercises/repository.ts`
- new `src/exercises/publicRepository.ts`
- new `src/exercises/bundledRepository.ts`
- new `src/exercises/mockPremiumRepository.ts`

### 4. Add an entitlement abstraction

Create a hosting-neutral feature model:

```ts
type FeatureKey =
  | 'premium_catalog'
  | 'premium_render'
  | 'export_pdf'

interface EntitlementService {
  getFeatures(): Promise<Set<FeatureKey>>
  hasFeature(feature: FeatureKey): Promise<boolean>
}
```

Initial implementations:

- `FreeEntitlementService`, granting no premium features;
- `LocalDevEntitlementService`, configured explicitly for development/tests.

Expose entitlement state through a React provider for presentation. Keep authorization checks inside repositories and future server endpoints as well. UI gates are convenience, not security.

Avoid scattering unrelated `isPremium` booleans throughout components.

Likely files:

- new `src/entitlements/types.ts`
- new `src/entitlements/EntitlementProvider.tsx`
- new `src/entitlements/freeEntitlements.ts`
- new `src/entitlements/localDevEntitlements.ts`
- new `src/entitlements/RequireFeature.tsx`

### 5. Build the precomputed artifact pipeline

Implement this in the lilyJS source repository rather than editing the vendored bundle.

The publishing command should:

1. read LilyPond source from an explicitly private input location;
2. pin lilyjs renderer and music-font versions;
3. parse and validate the score;
4. render at the fixed 720 px engraving width;
5. extract note, chord, tempo, and event-ID schedules;
6. serialize SVG;
7. sanitize and validate the result;
8. emit a versioned, content-hashed `RenderedExerciseArtifact`.

Start with a local/private output directory. Do not commit real premium source or artifacts to this public repository.

The spike should determine whether lilyJS can expose a DOM-neutral `renderScoreToString`/`renderScoreToSvgModel` API or temporarily needs Playwright/headless Chromium.

### 6. Add safe SVG ingestion

Create one narrowly scoped component for rendered artifacts. It should:

- validate the artifact schema at runtime;
- sanitize SVG with an element and attribute allowlist;
- reject scripts, `foreignObject`, event handlers, external references, and unsafe URLs;
- retain only expected `data-lily-*` playback attributes;
- verify that playback event IDs exist in the SVG;
- enforce SVG byte, element-count, and metadata limits;
- fail closed with a clear rendering error.

Do not distribute raw SVG insertion across multiple components. Do not treat server-produced SVG as inherently safe.

### 7. Add authentication UI behind an adapter

Build account UX without tying it to a provider yet:

- sign-in and account buttons;
- signed-out, loading, authenticated, expired-session, and error states;
- account panel;
- upgrade presentation;
- “Manage billing” placeholder;
- logout cleanup hook;
- account-switch cleanup behavior.

Define an `AuthService` interface and initially supply a local development implementation. Supabase Auth can later replace it without restructuring the application UI.

Likely files:

- new `src/auth/types.ts`
- new `src/auth/AuthProvider.tsx`
- new `src/auth/localDevAuth.ts`
- new `src/account/AccountPanel.tsx`

### 8. Define API contracts and use a mock server

Define typed request/response contracts now for:

- `GET /api/me`
- `GET /api/premium/catalog`
- `GET /api/premium/resource/:id`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`

Use a local Bun server, fake `fetch`, or a request-interception test helper during development. The mock API should enforce entitlements so tests do not normalize client-only feature gating.

Likely files:

- new `src/api/contracts.ts`
- new `src/api/client.ts`
- new `src/api/errors.ts`
- new `scripts/mock-api.ts`, if a running local server is useful

### 9. Harden the production build

Update the build and CI to:

- explicitly prevent public production source maps;
- optionally store source maps privately for error symbolication;
- produce bundle metadata for review;
- add raw and compressed bundle-size budgets;
- split or lazy-load lilyjs and premium UI where practical;
- verify that `.env` files, secrets, private source, and premium artifacts do not enter `dist/`;
- scan for known secret prefixes and private paths;
- document which environment variables are intentionally public;
- preserve Bun minification as the baseline.

Do not add broad obfuscation yet. Evaluate it later against a specific proprietary client chunk with bundle-size, startup, runtime, debugging, and browser-compatibility budgets.

Likely files:

- `scripts/buildApp.ts`
- `package.json`
- `.github/workflows/deploy.yml`
- new build/security test scripts

### 10. Add premium security and regression tests

Add automated coverage showing:

- changing `localStorage` does not change repository/API authorization;
- a guessed premium resource ID is rejected by the mock API;
- entitlement UI state cannot bypass repository authorization;
- logout purges account-specific state;
- account switching cannot reuse another account's artifact;
- service-worker caches exclude API/private/authenticated responses;
- expired offline receipts fail, if offline receipts are prototyped;
- hostile or invalid SVG artifacts are rejected;
- playback metadata must reference valid SVG event IDs;
- free features continue working offline;
- premium failures do not break tuner, drone, or local practice;
- secrets and premium source are absent from `dist/` and public test artifacts.

### 11. Define the product entitlement matrix

Decide the feature boundary before implementing Stripe or a production database:

| Feature | Free | Premium | Offline behavior | Confidential? |
|---|---:|---:|---|---:|
| Tuner and drone | Yes | Yes | Full | No |
| Local practice recording | Yes | Yes | Full | No |
| Bundled exercises | Yes | Yes | Full | No |
| Public exercise catalog | Yes | Yes | Current cache policy | No |
| Premium exercise catalog | No | Yes | Product decision | Content/source |
| Premium rendered scores | No | Yes | Online or short grace | Source/processing |
| Custom rendering/export | No | Yes | Result only | Yes |
| Cloud progress synchronization | No | Yes | Local fallback | User data |

For each premium feature, record:

- feature key;
- required entitlement;
- resource type;
- online/offline behavior;
- cancellation grace period;
- cache policy;
- confidentiality requirement;
- usage/rate limit;
- data retention policy.

## Suggested first implementation slice

The first bounded slice should be:

1. restrict the service worker to safe static caching;
2. define `ExerciseContent` and `RenderedExerciseArtifact`;
3. move catalog/content loading behind `ExerciseRepository`;
4. make `PracticePlayback` consume a precomputed artifact;
5. produce and load one non-sensitive local sample artifact;
6. add entitlement and auth adapters with local implementations;
7. add security, cache, playback-ID, and offline regression tests.

This completes the hardest client-side architecture while remaining independent of Cloudflare, Supabase, and Stripe.

## Review decisions

Before implementation, confirm:

- [ ] Which feature is the first paid feature?
- [ ] Is premium catalog content expected to work offline?
- [ ] If yes, what is the offline grace period?
- [ ] Is LilyPond source itself confidential, or only premium access?
- [ ] Is the first catalog curated/precomputed, user-generated, or both?
- [ ] Can premium artifacts live in a separate private repository/bucket?
- [ ] Should this public repository contain backend code but no premium content?
- [ ] What mobile devices/browsers define the performance baseline?
- [ ] What bundle-size and stable-render-time budgets should block releases?

