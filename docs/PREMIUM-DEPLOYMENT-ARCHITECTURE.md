# Premium deployment, entitlements, and protected rendering

**Status:** architecture research, 2026-07-18  
**Scope:** evolve Giusto from a public static PWA into a free/offline app with paid, server-enforced features and protected premium score assets or rendering.

## Recommendation in one page

The design is feasible without rewriting Giusto. Preserve the current React/Bun client and local free features, but introduce a narrow server trust boundary:

1. Move production static hosting from GitHub Pages to Cloudflare Workers Static Assets (or an equivalent commercial static host). GitHub describes Pages as static hosting and its published limits say it is not intended or allowed as free hosting for commercial transactions or SaaS ([GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
2. Use Supabase Auth + Postgres for identity and application-owned entitlement state, Supabase Edge Functions for the small authenticated API, and Stripe Checkout/Subscriptions/Customer Portal for billing. Stripe webhook events update local entitlement rows; every premium request checks those rows server-side.
3. Keep the free catalog, tuner, drone, practice recording, local progress, bundled exercise, and free lilyjs rendering client-side and offline.
4. Put premium catalog entries and artifacts in a private bucket. Return only authorized metadata and short-lived asset access, or proxy the asset through an authenticated function when immediate revocation matters.
5. Prefer **precomputed premium SVG + playback metadata** for a curated catalog. It is faster, cheaper, easier to protect, and more reliable than on-demand server rendering. Add on-demand rendering only for user-authored/customized scores.
6. For confidential rendering, the client must not receive LilyPond source or the premium algorithm. The protected result should contain a sanitized SVG plus note/chord/tempo schedule data keyed by the same event IDs used in the SVG.
7. Continue Bun minification, keep production source maps private, and optionally obfuscate only a small proprietary client module. Neither obfuscation nor WASM is entitlement enforcement.
8. Fix the service worker before introducing auth. It currently cache-first stores every successful GET, which is unsafe for account/API/private responses.

This is an incremental product architecture, not a big-bang backend migration.

## 1. Current state and constraints

### Deployment

`.github/workflows/deploy.yml` runs the tests and Bun production build, then publishes `dist/` to GitHub Pages. There is no server runtime, secret store, user identity, database, billing webhook, or protected object store. Anything in the repository, build, public catalog, or browser response is public and copyable.

The production build already calls `buildApp({ minify: true })`. Minification is therefore a current baseline, although the build does not currently document source-map policy, property mangling, obfuscation, code splitting, or bundle budgets.

### Catalog and score delivery

The app fetches public catalogs and assets directly from `https://violin-music.github.io/`:

- `useExerciseCatalog.ts` downloads `exercises-catalog.json`, caches the complete catalog in `localStorage`, and constructs direct public LilyPond URLs.
- `PracticePlayback.tsx` fetches LilyPond source, parses it locally, derives chord/note playback schedules, and renders it through lilyjs.
- `useTuneCatalog.ts` downloads the complete tune catalog and constructs direct public SVG, MIDI, and note JSON URLs.

This is appropriate for free content. It cannot enforce premium access: hiding an entry in React does not hide a known URL, and a public catalog or bucket remains enumerable/downloadable.

### PWA cache issue that must be fixed first

`public/sw.js` currently intercepts every GET request, returns a cached match first, and caches every successful network response. Before authenticated features ship, change it to:

- cache only explicit same-origin static assets or hashed build assets;
- never cache `/api/**`, Supabase auth/function URLs, checkout/portal routes, private asset responses, or requests carrying `Authorization`;
- never cache opaque cross-origin responses by default;
- delete old `giusto-static-v1` caches during activation;
- use network-only for entitlement/account endpoints;
- use explicit versioned cache names and a controlled offline fallback.

Otherwise a premium response can outlive logout, cancellation, account switching, or revocation. Browser Cache API keys do not create a dependable per-user authorization boundary.

## 2. Proposed architecture

```text
Browser / installed PWA
  ├─ free features + free lilyjs renderer ─────────────── local/offline
  ├─ Supabase session JWT ─────────────────────────────── identity
  └─ /premium requests
        │
        ▼
Supabase Edge Functions
  ├─ verify user JWT
  ├─ check local active entitlement + resource grant
  ├─ rate-limit / audit
  ├─ return authorized catalog or artifact
  └─ create Stripe Checkout / Portal sessions
        │
        ├────────── Postgres: profiles, customers, entitlements, grants
        ├────────── Private Storage: SVG, schedule, MIDI, source if needed
        └────────── Stripe API
                       │
                       └─ signed webhooks update entitlement state

Private publishing/render pipeline
  ├─ validate LilyPond source
  ├─ render fixed-width sanitized SVG
  ├─ derive playback metadata with matching event IDs
  └─ upload versioned artifacts + manifest to private storage
```

### Recommended toolchain

| Concern | Recommended tool | Why it fits this repository |
|---|---|---|
| Static PWA hosting | Cloudflare Workers Static Assets | Deploys a Worker and static assets together, caches assets globally, and can route only `/api/*` through server code ([Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/)) |
| Identity | Supabase Auth | Browser-friendly sessions, magic link/social options, JWTs, and direct integration with Postgres RLS ([Supabase Auth](https://supabase.com/docs/guides/auth)) |
| App database | Supabase Postgres | Relational mapping among user, Stripe customer, product, feature, resource, and access history; RLS is useful as defense in depth |
| Small API/webhooks | Supabase Edge Functions | TypeScript/Deno functions, secret storage, JWT-aware request handling, and suitable webhook endpoints ([Edge Functions](https://supabase.com/docs/guides/functions)) |
| Billing | Stripe Billing + Checkout + Customer Portal | Avoids handling card data; portal handles subscription/payment self-service; Entitlements/webhooks expose subscription-driven changes ([Stripe entitlements](https://docs.stripe.com/billing/entitlements), [customer portal](https://docs.stripe.com/customer-management)) |
| Protected artifacts | Supabase private Storage initially | Private-by-default buckets, RLS and signed URLs ([private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)) |
| Precompute | Private GitHub Actions runner/job or release tool | Rendering is deterministic and catalog publishing is already build-oriented |
| On-demand render | Small Node/Bun container only if needed | lilyjs currently requires DOM/SVG and font APIs; edge isolates do not provide a full browser DOM |

Cloudflare can also supply the API and R2 storage. That can be a later consolidation if usage or cost warrants it. For the first version, keeping auth, relational data, functions and private storage in Supabase reduces custom integration. Cloudflare hosts only the commercial SPA and can proxy `/api/*` if same-origin routing is desired.

### Viable alternatives

- **Cloudflare Workers + D1 + R2 + third-party auth + Stripe:** strong same-origin edge architecture and fewer origin hops, but more custom identity/authorization plumbing. R2 presigned URLs grant bearer access until expiry and must be treated as bearer tokens ([R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)).
- **Vercel/Next.js + Supabase + Stripe:** mature full-stack conventions, but converting the Bun SPA to Next.js is not needed for this product and creates framework migration work.
- **Netlify Functions/Identity or Firebase:** feasible, but neither has a project-specific advantage over the recommended stack.
- **Dedicated Node/Bun API and Postgres:** maximum control and best fit for on-demand DOM rendering, but adds patching, scaling, database operations, sessions, email/auth and monitoring work too early.
- **Keep GitHub Pages plus a cross-origin API:** technically works with bearer JWTs and CORS, but is not recommended for a commercial SaaS because of GitHub Pages policy and awkward origin/cookie/security configuration.

## 3. Entitlement and license enforcement

### Authentication is not authorization

A valid Supabase session proves who the caller is. It does not prove that the user owns a premium product. Every premium endpoint must perform both checks:

1. verify the session/JWT and identify `user_id`;
2. query a server-owned entitlement or resource grant that is active *now*.

Do not trust `user_metadata`, a client `isPremium` flag, `localStorage`, catalog metadata, or an unverified JWT claim. Supabase specifically notes that user metadata can be modified by the user and should not hold authorization data; server-owned app metadata or database policies are appropriate, while JWT claims can be stale until refresh ([Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)). For prompt cancellation/revocation, query the entitlement table on the protected request or use a deliberately short cache.

### Proposed data model

```sql
profiles(
  user_id uuid primary key,
  stripe_customer_id text unique,
  created_at timestamptz
)

features(
  key text primary key,              -- e.g. premium_catalog, premium_render, export_pdf
  description text
)

entitlements(
  user_id uuid,
  feature_key text,
  source text,                       -- stripe, admin, trial, promo
  source_ref text,                   -- subscription or grant id
  status text,                       -- active, grace, revoked, expired
  valid_from timestamptz,
  valid_until timestamptz null,
  updated_at timestamptz,
  primary key (user_id, feature_key, source_ref)
)

premium_resources(
  id text primary key,
  required_feature text,
  title text,
  artifact_version text,
  storage_prefix text,
  published_at timestamptz,
  retired_at timestamptz null
)

stripe_events(
  event_id text primary key,
  type text,
  processed_at timestamptz,
  payload_hash text
)

access_events(
  id bigint generated always as identity,
  user_id uuid,
  resource_id text,
  action text,
  occurred_at timestamptz,
  outcome text
)
```

Keep raw Stripe webhook bodies out of general logs. Store only what is required for idempotency, reconciliation and support unless there is a defined retention need.

### Billing flow

1. An authenticated user calls `POST /billing/checkout`.
2. The server finds/creates the Stripe Customer tied to that authenticated `user_id`; it never accepts an arbitrary customer ID from the browser.
3. The server creates a Stripe Checkout Session using allowlisted price IDs and returns its URL.
4. Stripe calls a public webhook endpoint. The endpoint verifies `Stripe-Signature` against the **raw** request body; parsing/mutating the body first breaks verification ([Stripe signature guidance](https://docs.stripe.com/webhooks/signature)).
5. The handler inserts `event.id` before applying changes, so retries are idempotent. In one transaction it maps the Stripe customer to the user and updates local entitlement rows.
6. Listen at minimum for the applicable checkout/subscription/invoice events and `entitlements.active_entitlement_summary.updated`. Stripe recommends using that event to provision/de-provision feature access ([subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)).
7. A scheduled reconciliation job compares active Stripe state with local state to repair missed or out-of-order events.
8. `POST /billing/portal` authenticates the user, looks up their server-owned customer ID, creates a short-lived Stripe Customer Portal session, and returns its URL.

Stripe is the billing source of truth; the local table is the low-latency authorization projection. The webhook is not the only security check and the browser never writes entitlements.

### API surface

Suggested minimum endpoints:

| Endpoint | Auth | Behavior |
|---|---|---|
| `GET /api/me` | user JWT | profile and current feature keys; UI convenience only |
| `POST /api/billing/checkout` | user JWT | creates Checkout session from an allowlisted product/price |
| `POST /api/billing/portal` | user JWT | creates Customer Portal session |
| `POST /api/stripe/webhook` | Stripe signature | idempotently projects billing state into entitlements |
| `GET /api/premium/catalog` | `premium_catalog` | returns only authorized catalog metadata, no storage paths/source |
| `GET /api/premium/resource/:id` | resource feature | returns/proxies artifact manifest and content |
| `POST /api/premium/render` | `premium_render` | validates bounded input, queues/renders/caches, returns job/result |

Use uniform 404 responses for missing versus unauthorized resource IDs where enumeration matters. Apply per-user and per-IP rate limits, input size/complexity limits, timeouts, concurrency limits and audit logging. CORS should allow only production and explicit preview/local origins.

### Offline entitlement policy

Offline premium access cannot be simultaneously durable and promptly revocable. Choose and document one product policy:

- **Online-only premium:** strongest enforcement; no premium artifact is deliberately persisted. Free features remain offline.
- **Short offline grace (recommended if musicians need unreliable-room support):** server issues a signed entitlement receipt with user, feature, artifact version, `issued_at`, `expires_at`, and random receipt ID. The PWA may keep encrypted-at-rest or ordinary cached artifacts until expiry. Browser encryption does not stop the device owner; it mainly protects casual local inspection.
- **Permanent offline download:** equivalent to selling a downloadable copy. Accept that content can be extracted and rely on account watermarking, download limits and terms.

For the initial paid launch, use online-only account/catalog operations plus a 24–72 hour grace for already-opened practice content only if offline use is a core promise. Never allow a service worker cache entry to extend access beyond the signed receipt.

## 4. Protected rendering options

### Option A — precomputed artifacts (recommended first)

At content publication time, a private pipeline:

1. reads premium LilyPond source from a private repository/bucket;
2. pins the exact lilyjs renderer and music font versions;
3. parses and validates the source;
4. renders at Giusto's fixed engraving width (currently 720 px);
5. derives note/chord/tempo schedules from the same score model;
6. emits a versioned artifact;
7. sanitizes and validates it;
8. uploads it to a private bucket and updates `premium_resources`.

Proposed artifact shape:

```json
{
  "schemaVersion": 1,
  "resourceId": "flesch-arpeggio-a-major",
  "artifactVersion": "sha256:...",
  "rendererVersion": "lilyjs-v...",
  "width": 720,
  "svg": "<svg ... data-lily-event-id=\"event-0\">...</svg>",
  "playback": {
    "bpm": 96,
    "meter": { "beats": 4, "beatUnit": 4 },
    "notes": [{ "eventId": "event-0", "startBeat": 0, "durationBeats": 1 }],
    "chords": []
  }
}
```

This requires refactoring `PracticePlayback` so it can consume either public LilyPond source or a `RenderedExerciseArtifact`. The existing `createSvgPlaybackBinding` can keep working if the sanitized SVG retains `data-lily-event-id`. Do not use `dangerouslySetInnerHTML` on untrusted SVG. Sanitize during publication and defensively on delivery/client; disallow scripts, event-handler attributes, `foreignObject`, external references, unsafe URLs and unexpected elements/attributes.

Advantages:

- source and any private preprocessing logic never reach the browser;
- no server render latency or compute burst during practice;
- output can be cached by artifact version after authorization;
- deterministic QA and rollback;
- best fit for a curated exercise/tune library.

Limitations:

- users can capture authorized SVG/audio/MIDI results;
- variants in transposition, width, font or theme multiply artifacts;
- interactive edits require a different path.

Because Giusto already engraves at a fixed width and CSS-scales the vector output, precomputation matches the current sizing model unusually well.

### Option B — on-demand server rendering

Use when a paid feature accepts user LilyPond, transposes/customizes a score, or has too many variants to precompute.

The current lilyjs bundle is not directly edge/server-safe: it calls `document.createElementNS`, `document.fonts`, `FontFace`, `document.head`, and other DOM APIs. Practical routes are:

1. **Best upstream change:** export a DOM-neutral `renderScoreToSvgModel` or `renderScoreToString` from lilyJS, with deterministic server font/glyph metrics. The bundle already contains an internal `renderScoreToSvgModel`; making a supported pure API avoids browser emulation and enables Deno/Node/Bun runtimes.
2. **Short-term pipeline:** run lilyjs in headless Chromium/Playwright, wait for fonts, serialize the SVG, sanitize it, and cache the result. This maximizes fidelity but is too heavy for a typical edge function and needs a container/job runtime.
3. **DOM shim:** use a server DOM implementation and polyfill font behavior. This is lighter than Chromium but risky because missing layout/font APIs can subtly change engraving; accept only after golden comparisons.

An on-demand renderer should run outside the request function if worst-case inputs can exceed its CPU/time budget. The API validates a strict source-size/measure/note/complexity limit, computes a content-addressed cache key, returns an existing artifact or enqueues a job, and lets the client poll or subscribe. Never pass arbitrary include paths, URLs, Scheme execution, file access or browser navigation through a renderer. lilyjs's supported LilyPond subset should be explicitly allowlisted.

### Option C — keep rendering client-side

This is still the right option for free content and any premium feature where confidentiality is not valuable. It gives the best offline behavior and no render hosting cost. Server-enforce access to the source/content, but recognize that after delivery the source and algorithm inputs are recoverable. WASM/obfuscation only raises the extraction effort.

## 5. Performance implications for layout and beam solving

The detailed WASM analysis is in [WASM-FEASIBILITY.md](./WASM-FEASIBILITY.md). For premium deployment, the important question is where the work occurs and whether it is cached.

### Precomputed rendering

Precomputation removes parser, system-packing, spring-spacing, beam-quantization, slur solving and SVG construction from the user's critical path. Client work becomes an authorized fetch, JSON/SVG parse, DOM insertion and playback binding. For curated content this is likely a much larger and more predictable performance improvement than porting individual solvers to WASM.

The new costs are authentication/entitlement lookup and network transfer. Mitigate them by:

- returning the authorized catalog and compact entitlement summary together;
- using immutable content-addressed artifact versions;
- compressing SVG/JSON at the CDN;
- keeping entitlement checks short and indexed;
- caching an authorization decision for a small, explicit interval where cancellation delay is acceptable;
- prefetching the selected exercise after entitlement confirmation, not the whole premium library.

Do not put user-specific entitlement responses in a shared CDN cache. Artifact bytes may be shared internally after authorization, but the authorization gate must not be bypassable by knowing the content hash.

### On-demand rendering

Server rendering shifts layout/beam CPU from the phone to infrastructure but adds queue/cold-start/network latency. It can improve responsiveness on low-end devices and hides the algorithm; it may feel slower for small scores unless results are cached. Cache by a canonical key including:

```text
source hash + renderer version + font version + width + theme/style + options schema version
```

Layout and beam solving themselves are deterministic numeric work; run once per unique key. Fixed width is important because system breaking and spring spacing depend on available width. Theme-only variants may share geometry if theme does not affect metrics. Preserve exact renderer/font versions so a deploy cannot silently mismatch playback event IDs or geometry.

For headless Chromium, browser startup and font readiness are likely larger than solving a short exercise. Keep a warm bounded worker pool or use asynchronous jobs, but isolate renders to prevent one malicious score from exhausting memory/CPU. Measure p50/p95 queue time, render time, total result latency, cache hit rate, output size and error rate.

### Client rendering after entitlement

If premium source is delivered and rendered locally, entitlement API latency is additive only on first/open access. The layout/beam performance remains exactly as today. This is the simplest path but provides content access control, not confidentiality after access.

### Recommended performance order

1. Precompute curated premium content.
2. Cache content-addressed results privately and deliver only after authorization.
3. Add a pure lilyjs server renderer upstream if custom rendering becomes a paid feature.
4. Profile solver stages before considering Rust/WASM; server placement does not make WASM automatically beneficial.

## 6. Minification, obfuscation, and client hardening

### Baseline

- Keep Bun minification enabled.
- Ensure production source maps are not uploaded as public assets. Store them privately for error-symbolication if needed.
- Split/lazy-load lilyjs and premium UI so the main app payload does not disclose unused premium presentation logic or impose its size on every user.
- Never embed Supabase secret/service keys, Stripe secret keys, webhook secrets, private bucket credentials or signing keys in the client. A Supabase publishable key is designed to be public only when RLS/authorization is correct ([Supabase data security](https://supabase.com/docs/guides/database/secure-data)).
- Add CSP, `X-Content-Type-Options: nosniff`, a strict referrer policy, frame restrictions, and appropriate Permissions Policy headers at the new host.
- Sanitize server-produced SVG and avoid logging score contents, JWTs, signed URLs or billing data.

### Selective obfuscation

Obfuscate only proprietary browser code whose casual copying risk justifies:

- larger/slower bundles;
- harder debugging and browser profiling;
- fragile optimizer/minifier interactions;
- more difficult security review;
- no protection against runtime observation or determined reverse engineering.

Do not obfuscate authentication or authorization logic as a security measure. The server must remain secure if an attacker replaces the entire client. Do not use rotating obfuscation as a substitute for revocation, rate limiting, watermarking or contracts.

### Watermarking and abuse controls

For high-value catalog assets, consider embedding a non-disruptive account/license identifier in export metadata or a visible footer. Avoid covert fingerprinting without legal/privacy review. Combine with per-user download/render quotas, anomaly alerts, short asset grants, and terms enforcement. Watermarking discourages redistribution; it does not prevent capture.

## 7. Feasibility and phased implementation plan

### Phase 0 — product and threat decisions (1–3 days)

- Name the first paid features and map each to a feature key.
- Classify each asset/algorithm as public, access-controlled, or confidential.
- Decide the premium offline promise and cancellation grace period.
- Define supported browsers, privacy/retention requirements, expected catalog size and expected render volume.
- Decide whether the public repository remains appropriate; backend code can be public, but premium source and infrastructure secrets cannot be.

**Exit:** a one-page entitlement matrix, for example:

| Feature | Free | Paid | Offline | Confidential implementation? |
|---|---:|---:|---:|---:|
| Tuner/drone/local practice | yes | yes | yes | no |
| Free exercise catalog | yes | yes | cached | no |
| Premium catalog | no | yes | selected grace | source/content yes |
| Custom server render/export | no | yes | result only | yes |

### Phase 1 — safe hosting and auth foundation (3–6 days)

- Create Supabase dev/staging/prod projects or at minimum separate test and production environments.
- Add `@supabase/supabase-js`, an `AuthProvider`, sign-in/out/account UI, and typed session state.
- Add SQL migrations for profiles, entitlements, resources, Stripe events and RLS; deny access by default.
- Rewrite `public/sw.js` to cache static assets only and test logout/account switching/offline behavior.
- Add environment validation with only the Supabase URL and publishable key in the browser build.
- Deploy the unchanged free PWA to Cloudflare Workers Static Assets under a staging/custom domain; configure headers, SPA fallback and preview environments.
- Replace the GitHub Pages production workflow after verification. Keep GitHub Actions for test/build and use a scoped deployment token or Cloudflare's recommended CI integration.

**Exit:** free app parity, login/logout, safe caching, no premium data, successful staging/production rollback.

### Phase 2 — billing and authoritative entitlements (4–8 days)

- Configure Stripe test products/prices and feature mappings.
- Implement authenticated Checkout and Portal session functions with allowlisted price IDs.
- Implement raw-body signature-verified, idempotent Stripe webhook handling.
- Project Stripe active entitlements/subscription state into Postgres and add a reconciliation job.
- Implement `GET /api/me` and a reusable server `requireFeature(userId, featureKey)` guard.
- Add test fixtures for purchase, renewal, failed payment, cancellation-at-period-end, immediate revocation, upgrade/downgrade, duplicate/out-of-order webhook, deleted customer and admin grant.
- Add structured audit logs and alerts for webhook failures/reconciliation drift.

**Exit:** UI may display premium state, but an integration test using a modified client/direct HTTP call still cannot access a protected test resource without a server-owned active grant.

### Phase 3 — protected catalog and precomputed rendering (5–10 days)

- Create a private `premium-score-artifacts` bucket.
- Define and version `RenderedExerciseArtifact`; add runtime validation.
- In lilyJS, expose or build a deterministic publication command that emits sanitized SVG plus schedules/event IDs.
- Create a private publishing workflow with golden SVG/geometry tests, content hashes and atomic manifest publishing.
- Implement protected catalog/resource endpoints. Initially proxy artifact delivery through the function for simplest authorization and revocation; optimize to short-lived signed URLs only after measuring load.
- Refactor `useExerciseCatalog`, `exerciseUrl`, `PracticePlayback` and `LilyScore` into public-source and protected-artifact adapters.
- Never write protected catalog/source to `localStorage`. If offline grace is approved, create a distinct user-scoped IndexedDB store with explicit expiry and purge it on logout/account change.
- Add shared-device, canceled-user, expired-link, guessed-ID and service-worker tests.

**Exit:** premium source is absent from the repository, app bundle, public catalog, network responses and caches; authorized playback/highlighting works from the precomputed artifact.

### Phase 4 — on-demand premium rendering, only if product requires it (7–15 days)

- First add a supported DOM-neutral `renderScoreToSvgModel`/`renderScoreToString` API upstream in lilyJS and differential-test it against browser output.
- If that is not immediately feasible, containerize a Playwright renderer as an asynchronous job service; do not force Chromium into an edge request handler.
- Add strict input grammar/size/complexity limits, content-addressed cache keys, timeouts, memory/concurrency quotas and job ownership checks.
- Store results privately with expiry/retention controls and return sanitized artifacts.
- Load-test cache hits, misses, adversarial inputs and concurrent users. Add kill/retry/dead-letter behavior.

**Exit:** target p95, cost/render and failure-rate objectives are met, and no arbitrary file/network/script capability is reachable from submitted notation.

### Phase 5 — selective hardening and optimization (ongoing)

- Add private error source-map upload and release correlation.
- Evaluate obfuscation on one proprietary client chunk with before/after transfer, parse and runtime budgets.
- Add entitlement decision metrics without recording score content.
- Add abuse thresholds and account-support tooling for grants/revocation.
- Revisit R2/Workers or a consolidated backend only when observed volume/cost/latency justifies migration.
- Conduct a security review before live billing and after any offline-premium implementation.

## 8. Concrete repository changes

Likely client additions:

```text
src/auth/AuthProvider.tsx
src/auth/supabaseClient.ts
src/auth/RequireFeature.tsx          # UX gate only; never the authority
src/api/client.ts
src/api/contracts.ts
src/billing/AccountPanel.tsx
src/premium/artifact.ts
src/premium/protectedCatalog.ts
src/premium/ProtectedScore.tsx
```

Likely backend/infrastructure additions:

```text
supabase/config.toml
supabase/migrations/*.sql
supabase/functions/_shared/auth.ts
supabase/functions/_shared/entitlements.ts
supabase/functions/me/index.ts
supabase/functions/billing-checkout/index.ts
supabase/functions/billing-portal/index.ts
supabase/functions/stripe-webhook/index.ts
supabase/functions/premium-catalog/index.ts
supabase/functions/premium-resource/index.ts
wrangler.jsonc
.github/workflows/deploy-production.yml
.github/workflows/publish-premium-artifacts.yml   # private source context only
```

Refactors to existing files:

- `src/hooks/useExerciseCatalog.ts`: merge a public catalog adapter with an authenticated premium adapter; remove direct URLs from premium records.
- `src/pages/practice/PracticePlayback.tsx`: accept a discriminated union of `{ kind: 'source', source }` and `{ kind: 'artifact', svg, playback }`.
- `src/pages/practice/LilyScore.tsx`: keep lilyjs for public source; add a sanitized, already-rendered SVG path.
- `src/App.tsx` and `src/pages/settings/SettingsTab.tsx`: provide auth/account/subscription state and billing portal UI.
- `public/sw.js`: static allowlist, network-only private/API routes, user/cache purge messaging.
- `.github/workflows/deploy.yml`: replace Pages deployment after staging validation.
- `scripts/buildApp.ts`: explicit source-map policy, bundle metadata/budgets and new host output requirements.

## 9. Acceptance and security tests

The premium launch is not complete until automated tests show:

- unauthenticated, expired, canceled and wrong-user requests fail server-side;
- changing React state/localStorage/JWT payload without a valid signature grants nothing;
- direct resource-ID guessing and old signed URLs fail as designed;
- webhook signatures, duplicates, retries and out-of-order events are handled safely;
- a failed webhook is repaired by reconciliation;
- logout/account switch removes premium UI state and any allowed offline cache;
- service-worker caches contain no API, JWT-bearing, signed-URL or private responses;
- protected SVG cannot execute scripts, external loads, handlers or `foreignObject`;
- precomputed event IDs match playback schedules and highlights;
- free features continue working offline;
- premium server failure degrades to a clear retry/offline state without affecting tuner/drone/local practice;
- secrets and premium source do not appear in `dist/`, source maps, logs, Git history or public CI artifacts.

## 10. Final decision

Proceed. The first commercially useful and lowest-risk version is:

**Cloudflare-hosted existing PWA + Supabase Auth/Postgres/Functions/Private Storage + Stripe Billing + precomputed premium artifacts.**

This adds paid access without sacrificing the current free/offline product. It gives meaningful protection because entitlement decisions, premium source and private artifacts live outside the browser. It also improves perceived rendering performance for premium catalog content by removing layout/beam solving from the client path.

Do not start with on-demand Chromium rendering, a whole-app framework rewrite, WASM protection, device fingerprint licensing, or custom payment/account management. Add on-demand rendering only when a defined premium feature requires arbitrary score generation and after lilyJS exposes a server-safe rendering API.

## Sources

- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [commercial/usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) and [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Supabase Auth](https://supabase.com/docs/guides/auth), [JWTs](https://supabase.com/docs/guides/auth/jwts), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [secure data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) and [function authentication patterns](https://supabase.com/docs/guides/functions/auth)
- [Supabase private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Stripe Entitlements](https://docs.stripe.com/billing/entitlements), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [webhook signatures](https://docs.stripe.com/webhooks/signature), and [Customer Portal](https://docs.stripe.com/customer-management)
- [Cloudflare R2 presigned URL security](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

