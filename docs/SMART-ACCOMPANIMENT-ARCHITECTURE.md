# Smart Accompaniment: Technical Feasibility and Production Architecture

**Research date:** 2026-07-18  
**Decision status:** recommended architecture and implementation plan  
**Scope:** LilyPond/lilyjs-conditioned accompaniment with exact harmony, responsive playback, high-quality acoustic rendering, and defensible premium IP

## Executive recommendation

The product is feasible, but not as a single end-to-end “AI backing-track” model. The production architecture should separate three responsibilities:

1. **lilyjs is the deterministic musical authority.** It expands or preserves repeats, resolves meter/tempo, and emits an exact continuous score timeline.
2. **A symbolic arranger creates a performance plan.** It chooses voicings, patterns, articulations, dynamics, and human timing while hard constraints guarantee that every sounding note is legal under the requested chord and section boundary.
3. **An instrument renderer creates audio.** The interactive path uses high-quality multisamples/modelled instruments in Web Audio. Neural score-to-audio or diffusion rendering is an asynchronous premium “studio render,” returned as stems plus a mix.

This split is more controllable and more responsive than asking a text-to-music model to rediscover an exact chord chart. Current music foundation models can produce impressive style and texture, but their published controls do not establish sample-accurate obedience to an arbitrary chord timeline. They are useful as offline renderers, arrangement proposal engines, and reference-style teachers—not as the playback clock.

For the MVP, do **not** make neural synthesis a launch dependency. A carefully humanized symbolic arpeggiator rendered through licensed piano and cello samples will be more predictable, cheaper, faster, and often more convincing than the available open MIDI-DDSP cello model, whose repository is archived and whose training stack is old. Use a neural renderer as an A/B experimental backend and retain the sample engine as the production fallback. For later stages, generate stems server-side and validate them against the symbolic plan before publication.

The defensible indie-startup design is hybrid: keep notation, transport, and a useful basic accompaniment offline; keep premium arrangement policies, style adapters, model weights, and high-quality rendering on the server; use short-lived server-validated entitlements; regard minification, obfuscation, and WASM only as reverse-engineering friction.

## Product feasibility matrix

| Capability | Feasible now? | Recommended method | Principal caveat |
|---|---:|---|---|
| Exact chord-following cello/piano arpeggios | Yes | Deterministic symbolic planner + multisample/modelled renderer | Requires good voice leading and articulation, not a huge generative model |
| Sub-50 ms response to transport/tempo/loop changes | Yes | Schedule cached note/audio events ahead with Web Audio | This means control-to-audible response, not regenerating neural audio in 50 ms |
| Expressive solo cello from MIDI | Yes, experimental neural quality | Expression model + samples; optionally MIDI-DDSP server A/B | Public MIDI-DDSP is archived and monophonic per instrument |
| Convincing acoustic piano | Yes | Expressive performance MIDI + premium piano engine/sample set | Browser download size/licensing must be managed |
| Full orchestra obeying exact harmony | Yes as layered synthesis; qualified as end-to-end generation | Symbolic orchestration + per-section renderers/stems | Requires ranges, divisi, voice-leading, density, and mix rules |
| Style-conditioned jazz/folk families | Yes with curated adapters and rules | Style-specific symbolic policies + licensed render assets; neural studio variant | “Genre” labels alone do not encode idiomatic rhythm or instrumentation |
| Instant arbitrary text-to-audio with exact chord timing | Not reliably | Do not make it the authority | Foundation models can drift harmonically and structurally |

---

## (a) Feasibility, lilyjs Integration, & Generative Toolchains

### A.1 Canonical intermediate representation

**Ownership boundary:** the code and interfaces in this section are proposed **Giusto accompaniment-domain code**, not additions to lilyjs as written. The clean boundary is:

- **lilyjs owns notation interpretation and generic playback semantics.** Its existing `src/music-playback/` layer is redesigned around one stable, notation-neutral `PlaybackTimeline`: exact positions and durations, normalized harmony, conductor maps, performed/written structure, pitches, expression markings, IDs, and source mapping. Existing scheduling, MIDI export/transport, pedal/grace/repeat handling, and SVG playback binding become consumers or components of that same timeline.
- **Giusto owns accompaniment intent.** A Giusto adapter converts LilyJS `PlaybackTimeline` into the versioned **Accompaniment IR (AIR)** below, adds product concepts such as arrangement requests, styles, instruments, generated performance notes, seeds, and render revisions, and sends AIR to local or server-side accompaniment engines.
- **A shared package is preferable.** Put the AIR schema, validator, rational helpers, and adapters in a small package such as `packages/music-core` or `packages/accompaniment-core`, rather than inside a React component or the lilyjs renderer. lilyjs may provide an optional `toAccompanimentIR` adapter later, but it should not depend on Giusto-specific styles, renderers, or product policy.

This keeps lilyjs reusable as a notation library and prevents Giusto from reverse-engineering musical semantics from engraving/SVG objects. The `AccompanimentIR` TypeScript below is an architectural schema proposal; it is not a claim that these interfaces already exist in the repository.

Do not make Standard MIDI Files the internal source of truth. MIDI 1.0 is a useful interchange/render format but loses score spelling, section identity, chord semantics, repeat provenance, and rational timing. Introduce AIR as the canonical internal contract, then derive MIDI 2.0/UMP, MIDI 1.0, model tokens, or tensors from it when a particular renderer or external tool requires them.

All score positions should use exact rational quarter-note units (`QN`), never accumulated floating-point seconds. Seconds are a view derived from the tempo map:

```ts
type Rational = { num: bigint; den: bigint } // normalized, den > 0

interface AccompanimentIR {
  schema: 'air/1'
  scoreId: string
  revisionHash: string
  ppqHint: 960
  durationQN: Rational
  conductor: {
    tempo: TempoSegment[]
    meter: MeterEvent[]
    key: KeyEvent[]
    barlines: BarBoundary[]
    pickupQN?: Rational
  }
  harmony: HarmonyEvent[]
  structure: StructureGraph
  sourceParts: SourcePart[]
}

interface HarmonyEvent {
  id: string
  startQN: Rational
  durationQN: Rational
  root: { midiClass: number; spelling: string }
  bass?: { midiClass: number; spelling: string }
  quality: string                 // canonical vocabulary, e.g. min7, dom7b9
  pitchClasses: number[]          // explicit semantic fallback
  alterations: string[]
  omissions: string[]
  sourceMeasureId: string
}

interface PerformanceNote {
  id: string
  partId: string
  pitch: number                   // MIDI note; optional cents/UMP attributes
  onsetQN: Rational
  durationQN: Rational
  velocity: number
  articulation: string
  timingOffsetMs: number          // expressive, bounded; score time remains exact
  expression?: Array<{ t: number; value: number }>
  harmonyId: string
}
```

`StructureGraph` must represent written order and performed order independently. A repeat is not merely two booleans on measures: it needs region ID, repeat count, alternatives/voltas, jumps (D.C./D.S./Coda), and a deterministic expansion API. Each expanded occurrence should retain `(sourceMeasureId, passIndex)` so editing a source bar invalidates every affected occurrence without losing UI identity.

The model-facing forms are projections:

- **Event tokens:** `BAR`, `POSITION_n`, `CHORD_ROOT`, `CHORD_QUALITY`, `SECTION`, `INSTRUMENT`, `NOTE_ON`, `DURATION`, `VELOCITY`, `ARTICULATION`, `PEDAL`. Use bar/position encoding or relative QN shifts and reserve tokens for constraints.
- **Piano-roll/control tensors:** `[frame, pitch]` note activation plus chord-pitch-class mask, bar phase, beat phase, tempo, section/style embeddings, instrument/range masks, dynamics, and density. These are effective for diffusion or non-autoregressive planners.
- **MIDI/UMP:** renderer interchange. Export tempo and time-signature meta events, program/port routing, per-note expression where available, and a sidecar JSON containing AIR IDs and semantics.

#### Do we have to use MIDI?

No. **MIDI is optional transport/control data, not audio.** It describes notes and performance controls; it does not have an inherent sound quality. The familiar “cheap MIDI sound” comes from a basic General MIDI synthesizer or weak sample bank. The same note events can drive a poor built-in soundfont, a deeply sampled concert grand, a physical model, or a neural renderer, with radically different results.

AIR should remain the source of truth. Each backend can consume whichever projection fits it:

| Backend | Input from AIR | MIDI required? |
|---|---|---:|
| Giusto AudioWorklet sampler/modelled instrument | Direct `PerformanceNote` event buffers and expression curves | No |
| External DAW or hardware instrument | MIDI 1.0 file/stream or MIDI 2.0 UMP | Yes, as an interoperability format |
| Symbolic Transformer | Event tokens or piano-roll/control tensors | No |
| DDSP/MIDI-to-audio checkpoint whose API expects MIDI | Temporary Standard MIDI File or tensor converted from AIR | Only at that adapter boundary |
| Audio diffusion/neural renderer | Conditioning tensors, control audio, or model-specific tokens | No, unless its API requires it |

For Giusto’s interactive renderer, direct typed event buffers avoid file parsing and preserve AIR IDs, exact rational timing, chord provenance, and richer expression. Still implement MIDI export because musicians expect DAW interoperability and many mature premium instrument engines accept MIDI. Prefer MIDI 2.0/per-note expression where the target supports it, but keep a MIDI 1.0 export with pitch-bend/CC/MPE mappings for compatibility. Neither should replace AIR.

### A.2 Required lilyjs boundary

The current Giusto checkout already obtains `parts[].measures`, `chordSymbols`, rational event durations, time signatures, and tempo marks. `src/audio/chordSchedule.ts` then reconstructs a first-part chord timeline using floating-point quarter beats. The vendored lilyjs bundle also contains internal repeat regions, structural events, chord-name offsets, tempo changes, and expected measure durations. This is a good foundation, but the hand-maintained `packages/lilyjs/index.d.ts` intentionally exposes only a subset.

The accompaniment engine should consume a supported upstream API rather than infer semantics from renderer objects or SVG.

#### API checklist for the lilyjs developer

| Requirement | Verify now | Add/standardize if missing | Acceptance test |
|---|---|---|---|
| Stable IDs | Score, part, measure, event and chord IDs survive rerender | IDs derived from source span + semantic path; occurrence IDs for repeats | Whitespace-only edit does not arbitrarily re-ID unaffected events |
| Exact global timeline | `buildPlaybackTimelineFromScore` already exists with playback timing | Redesign its `PlaybackTimeline` to return exact rational `startQN/endQN` for every event | Tuplets, dotted notes, grace notes, pickup and mid-bar changes never drift |
| Chord duration | Symbols have offsets but Giusto derives end from next symbol | Emit normalized chord root/bass/quality/pitch classes and deterministic `durationQN` | Slash chords, extensions, `s`/skip, repeated harmony and final chord pass fixtures |
| Tempo map | Tempo marks exist | Normalize beat unit/dots and expose piecewise QN→seconds and seconds→QN | Multiple tempo changes and dotted-quarter tempo round-trip within tolerance |
| Meter map | Per-measure signature exists | Expose inherited signatures, additive/compound grouping, pickup length | 6/8 pulses as 3+3; 5/8 explicit grouping; changing meter |
| Structure | Internal repeat/volta regions exist | Public `StructureGraph`, written and expanded iterators, occurrence provenance | Nested repeats, first/second endings, D.C./D.S./Coda golden cases |
| Sections | Rehearsal marks appear internally | Public rehearsal/section markers with exact QN location and labels | A/B markers survive expansion and loop selection |
| Note semantics | Event duration and pitch fields exist | Absolute sounding pitch, written spelling, tie chain, voice/staff, articulations, dynamics, pedal, slur/phrase membership | Transpose/relative/tuplet/tie fixtures produce correct sounding events |
| Harmony policy | Display strings are currently reparsed in Giusto | Expose canonical harmony AST; retain original text separately | `Bb7/D`, altered dominants, diminished/half-diminished and suspensions |
| Diagnostics | Parser result is nullable | Machine-readable severity/code/source range and partial-model policy | Unsupported commands fail explicitly instead of silently changing music |
| Incremental edits | Not in Giusto public surface | Revision hash, affected QN ranges, optional incremental parse/timeline diff | One chord edit invalidates only dependent plan/render chunks |
| Serialization | Renderer model is object-graph oriented | `exportAccompanimentIR()` or a documented lossless JSON schema | Schema validation plus forward/backward compatibility tests |

Recommended upstream API:

```ts
interface TimelineOptions {
  repeatMode: 'written' | 'expanded'
  gracePolicy: 'zero-time' | 'steal-from-following'
}

interface PlaybackTimeline {
  schemaVersion: 1
  durationQN: Rational
  events: TimelineEvent[]
  harmony: NormalizedHarmonyEvent[]
  conductor: ConductorMap
  structure: StructureGraph
  diagnostics: Diagnostic[]
  sourceMap: Record<string, SourceSpan>
}

export function buildPlaybackTimelineFromScore(score: ScoreLike, options: TimelineOptions): PlaybackTimeline
export function diffPlaybackTimeline(a: PlaybackTimeline, b: PlaybackTimeline): TimelineDiff
```

This is a deliberate breaking redesign of the existing LilyJS playback contract. There are no current external consumers to preserve, so LilyJS should replace its number/seconds-oriented canonical shape directly rather than add compatibility aliases or a parallel timeline subsystem. Seconds and MIDI are projections at scheduler/export boundaries.

Use integer numerator/denominator serialization in JSON (numbers if safely bounded, decimal strings otherwise). Convert to `number` only at scheduling/model boundaries. Add invariant tests: non-grace events do not overlap illegally within a voice; chord events cover a defined harmony span; measure durations equal expected durations except declared pickups/cadenzas; and expanded structure terminates under a configured visit limit.

### A.3 Three-layer generation pipeline

#### Layer 1 — constrained arrangement planner

Start with a deterministic pattern engine, then add learned ranking/generation behind the same interface. Generate candidates per phrase, not per audio frame. Hard masks enforce instrument range, required chord tones on metrically important positions, forbidden non-chord tones, maximum leaps, polyphony, and section endpoints. Soft costs reward voice-leading, idiomatic register, contour, syncopation, repetition/variation balance, and playability.

A practical MVP score is:

`candidateScore = stylePrior + voiceLeading + playability + phraseShape + variation - collision - constraintViolation`

Constraint violations that affect harmony/timing are infinite-cost. Beam search is optional for choosing among pattern/voicing states; it is not needed to decode audio tokens. Preserve a deterministic seed and return an explainable plan (“drop-2 voicing; passing tone into bar 3; cello avoids open-position parallel fifth”).

Later, train a small chord/structure-conditioned Transformer or masked diffusion model on symbolic arrangements. It should propose `PerformanceNote` events; the constraint projection/validator remains authoritative. Recent research continues to show the value—and difficulty—of explicit chord constraints; a 2025 harmonization system uses a beam/A*-like backtracking method and acknowledges exponential worst-case behavior ([paper](https://arxiv.org/abs/2512.07627)). That supports keeping the state space symbolic and the constraints local/typed.

#### Layer 2 — expression model

Separate composition from performance. Predict bounded microtiming, velocity, note length, articulation, pedal, vibrato, bow envelope, and phrase-level dynamics from score and style. This model is small enough for WebGPU/ONNX after quantization, or it can begin as rules plus sampled humanization curves. Never move harmonic onset boundaries; expressive offsets are renderer metadata and must be clipped at chord/loop boundaries.

#### Layer 3 — audio renderer

Provide two quality tiers:

- **Interactive renderer:** Web Audio `AudioWorklet`, predecoded/streamed multisamples, round-robin/velocity layers, release samples, convolution reverb, and instrument-specific transitions. Piano needs pedal/resonance and voice management; cello needs legato transition logic, bow changes, vibrato curves, and monophonic voice allocation. This path can respond instantly and stays exact.
- **Studio renderer:** server GPU/CPU workers produce stems from the immutable performance plan. Candidate technologies include neural MIDI-to-audio, differentiable/physical models, premium sampler farms, or constrained audio diffusion. Run a symbolic/audio verifier and fall back or flag if chord/onset confidence fails.

### A.4 Phase-specific toolchain assessment

#### 1. MVP Phase — Smart Arpeggiator, cello and piano

Recommended stack:

- LilyJS `PlaybackTimeline` → AIR.
- TypeScript pattern/voice-leading engine in a Worker; deterministic seeded output.
- Small expression model exported to ONNX, with WASM fallback and WebGPU only where supported. ONNX Runtime Web explicitly positions WASM for lightweight models and WebGPU for heavier inference; GPU buffer reuse/IO binding matters for recurrent Transformer calls ([official documentation](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)). Browser coverage is not uniform, particularly on iOS/Safari in the published compatibility matrix, so WebGPU cannot be the only path ([support table](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)).
- AudioWorklet multisample engine for guaranteed production playback. Ship a compact baseline pack; stream/cache optional velocity/round-robin layers.
- Server experiment: MIDI-DDSP for cello expression/timbre comparison. It supports cello and 12 other orchestral instruments with controllable expression, but the official repository was archived in 2024 and recommends older TensorFlow-era infrastructure ([official repository](https://github.com/magenta/midi-ddsp)). Treat it as research code, not the core platform.
- Piano studio experiment: evaluate a reproducible implementation/checkpoint of MIDI-VALLE only after code, model license, latency, and commercial rights are verified. The 2025 paper reports a reference-conditioned MIDI-to-piano-audio codec model and strong relative evaluation results, but a paper result is not a production-supported product ([paper](https://arxiv.org/abs/2507.08530)).

Avoid calling basic sample playback “neural audio.” Market the audible outcome and control. Neural physical modelling is promising, but a great licensed multisample piano/cello engine is the more reliable bar for “not cheesy.”

#### 2. Orchestral Phase

Do not generate “one orchestral waveform” first. Expand the harmony into a conductor score and explicit section/desk plans:

- orchestration policy chooses instrument families, ranges, doublings, divisi, density, register, and rests;
- voice-leading solver creates independent monophonic lines and prevents muddy low-register thirds/doublings;
- expression model coordinates phrase dynamics and articulation across sections;
- renderer emits at least section stems (strings high/low, winds, brass, percussion, piano/harp) before mixing;
- validation compares intended AIR notes/chords with audio transcription/chroma/onset estimates and checks clipping/loudness.

MIDI-DDSP can prototype individual monophonic orchestral lines, not a modern polished orchestra. The commercial-quality baseline remains a licensed orchestral sample engine hosted in a render worker. Neural models can later replace or enhance exposed instruments one stem at a time. This approach enables retries and edits without regenerating the entire mix.

General music generators are useful for arrangement ideation and ambience, but not exact-score authority. Meta’s MusicGen exposes text and broad melody/chroma conditioning, and MusicGen-Style adds a short reference-style conditioner; its documented models generate up to 30-second samples and recommend 16 GB GPU memory for the 1.5B style model ([MusicGen](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md), [MusicGen-Style](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN_STYLE.md)). Neither published API is a note-exact orchestral renderer.

#### 3. Stylized Phase

Treat each style as an explicit arrangement package, not a prompt string:

```text
StylePack = symbolic policy + instrument roster + articulations + groove templates
          + expression adapter + renderer assets/adapters + mix preset + evaluation set
```

- **Jazz (piano + double bass):** shell/rootless voicings, walking bass state machine, swing ratio varying with tempo, anticipations, approach tones, comping density and register separation.
- **Gypsy jazz:** la pompe guitar attack/release and two/four feel, idiomatic chord shapes/voice leading, walking or two-beat bass, optional ornamented lead. Generic acoustic-guitar MIDI is insufficient.
- **Celtic:** distinguish jig/reel/hornpipe/air meters and accent patterns; drones, modal harmony, ornaments and instrument ranges.
- **Folk:** make the label regional/instrument-specific; use sparse arrangement, boom-chuck/fingerstyle patterns, vocal-space rules.
- **Old-Time:** clawhammer/three-finger distinctions where relevant, fiddle bowing/shuffles, drones/double-stops, guitar bass runs, minimal over-arrangement.

Fine-tune small symbolic and expression adapters first. Add server-side audio LoRAs/adapters only with owned or clearly licensed data. MusicGen-Style documents training on 16,000 hours of licensed/internal and stock music, a useful signal that high-quality style audio requires both scale and rights ([official training notes](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN_STYLE.md)). ACE-Step 1.5 is an interesting 2026 server-side benchmark because its project reports fast diffusion-transformer generation, style LoRAs, editing, and consumer-GPU variants; however these are project claims, and exact AIR adherence, output rights, checkpoint license, stems, and production stability must be independently tested before adoption ([official repository](https://github.com/ace-step/ACE-Step-1.5)).

---

## (b) Performance Implications & Real-Time Sequence Decoding

### B.1 Do not put audio-token beam search in the live path

There are two different “beam” problems:

- **Notation layout/beam solving** in lilyjs affects SVG engraving. It should be cached by `(scoreRevision, viewportClass, engravingOptions)` and kept off the audio clock. A notation rerender must never block transport.
- **Sequence beam search** explores alternative arrangements or autoregressive audio/MIDI tokens. Its approximate cost is `O(T × B × K × Cmodel)` for sequence length `T`, beam width `B`, retained vocabulary/candidate count `K`, and model step cost. Memory also grows with `B` through key/value caches and state. Constraint backtracking can be exponential in pathological cases.

For exact playback, use hierarchy:

1. choose phrase-level pattern and voicing states with a small beam (`B=4–16`);
2. deterministically realize notes under hard masks;
3. predict expression in parallel/non-autoregressively;
4. render events/audio without search.

This reduces the branching factor and makes every partial phrase playable. Constrained decoding should operate in musical time with finite-state masks—range, pitch-class, voice count, pattern position—not by repeatedly decoding audio and estimating whether it followed the chord.

### B.2 Meaning of the sub-50 ms requirement

Sub-50 ms is achievable for **control response**, not fresh foundation-model synthesis. Define and measure:

- UI event → new transport state committed: target <16 ms;
- UI event → AudioWorklet receives command: target <25 ms;
- command → first correct audible sample: target <50 ms where device output latency permits;
- no glitch at the next scheduled boundary.

Browsers and audio devices add output latency outside application control, so log `AudioContext.baseLatency/outputLatency` where available and report engine latency separately.

Maintain a rolling two-horizon scheduler:

- **hot horizon (0–2 bars):** decoded sample buffers and immutable event list, scheduled 50–150 ms ahead;
- **warm horizon (next 4–16 bars):** planned performance notes and prefetched assets;
- **cold horizon:** cached phrase plans/stems keyed by content hashes.

Edits cancel only future scheduled nodes using an epoch/revision ID. AudioWorklet messages carry `(revision, effectiveAudioTime, command)`; stale work is ignored. Use 5–20 ms crossfades for chord/stem swaps and phase-aligned loop seams.

### B.3 Tempo, chord edits, and loops

| User action | Immediate behavior | Background behavior |
|---|---|---|
| Tempo change | Recompute QN→seconds for unsounded events; time-stretch only sustained audio/stems; do not regenerate notes | Re-render/cache stems at requested tempo if quality requires it |
| Chord edit mid-stream | Continue current safe event or crossfade at selected quantization boundary; regenerate affected phrase from AIR diff | Replan adjacent phrase for voice-leading context; invalidate content-addressed chunks |
| Loop section | Jump using precomputed event index; pre-roll release/resonance state; crossfade seam | Cache loop-specific pickup/tail and deterministic repeat variations |
| Style/instrument change | Switch at bar/phrase boundary to available interactive renderer | Start premium stem render and hot-swap when ready |

Piano/cello note events can be rescheduled at arbitrary tempo with no pitch artifacts. Finished audio stems require tempo-aware time stretching and have a limited quality range; store stems at canonical tempos or re-render for large changes. Preserve separate reverb tails so loop cuts do not click.

### B.4 Client caching versus speculative decoding

**Client caching wins for known score states.** Key artifacts by:

`SHA-256(AIR revision + performed range + style version + seed + instrument version + tempo bucket + render version)`.

Cache AIR, phrase plan, performance events, instrument assets, and optional compressed audio stems separately. Use IndexedDB/Cache Storage with an LRU quota and schema/model-version invalidation. Never cache bearer tokens inside cache keys or URLs.

**Speculation helps only across a small, plausible action set:** next repeat pass, neighboring tempo bucket, currently selected alternate style, or both sides of a loop boundary. Do not spend GPU cycles generating all possible chord edits. Cancel speculation on revision changes, enforce per-account budgets, and prioritize demanded work.

For live symbolic generation, speculative decode can precompute the next phrase while the current phrase plays. For diffusion audio, it is better described as asynchronous pre-rendering; it cannot guarantee a result inside 50 ms.

### B.5 WebGPU/WASM versus server GPUs

| Workload | Browser WASM | Browser WebGPU | Server GPU/CPU |
|---|---:|---:|---:|
| AIR construction / constraint validation | Excellent | Unnecessary | Optional |
| Deterministic arpeggiator | Excellent in TS/WASM | Unnecessary | Optional premium policy |
| Small expression model | Good fallback | Good where available | Good |
| Multisample/modelled synthesis | Excellent via AudioWorklet/WASM DSP | Limited benefit | Excellent for offline quality |
| 1B–4B music foundation model | Impractical for broad web audience | Device/coverage/download risk | Recommended |
| Orchestral/stylized stem render | No | No for product baseline | Required |

WASM should contain coarse DSP kernels, resampling/time-stretch, or a compact inference runtime—not DOM calls or secrets. WebGPU needs model quantization, static-shape/graph-capture evaluation, GPU-buffer reuse, a memory budget, thermal testing, and feature detection. Official ONNX guidance recommends tiny/small models for web scenarios and a Worker when inference would block the main thread ([performance guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html)).

Server workers should use a queue with job idempotency, per-stage timeouts, warm model pools, mixed precision, batched compatible jobs, content-addressed result storage, and progressive results (plan → preview → stems → final mix). Start with one rentable 24 GB GPU class for experiments and autoscale-to-zero; move to 48–80 GB workers only when a measured model requires them. Avoid a “cluster” before demand and unit economics justify it.

### B.6 Performance acceptance gates

- p95 AIR rebuild after a one-chord edit <20 ms for a 128-bar score on target desktop; <40 ms mobile.
- p95 affected-phrase deterministic replan <20 ms after warm-up.
- zero main-thread tasks >50 ms during transport.
- audio callback deadline miss/underrun rate below 1 per 10,000 callback intervals in soak tests.
- loop boundary discontinuity below an agreed click detector threshold and no missing first attack.
- premium preview starts within a product target (suggested <10 s), with honest queued/rendering state.
- exact plan validator: 100% intended harmony boundary coverage; no out-of-range or orphan events.

---

## (c) Intellectual Property & Code Protection

### C.1 Threat model and trust boundary

Assume users can download, inspect, instrument, patch, and replay every byte sent to the browser. Minified JavaScript and WASM can be disassembled. An encrypted browser model must also receive its decryption key and is therefore recoverable. Client checks improve friction and UX but cannot enforce premium entitlement or preserve a model secret.

Protect four assets differently:

| Asset | Primary control | Residual reality |
|---|---|---|
| Arrangement/source code | Keep premium policy service-side; narrow API | Outputs can reveal behavior statistically |
| Model weights/adapters | Never ship premium weights; private artifact registry and GPU workers | Model extraction can still be attempted through queries |
| Licensed samples/datasets | Server rendering; encrypted storage at rest; supplier-compliant distribution | Audible output can be recorded |
| Account/subscription | Server-owned entitlements, quotas, abuse controls | Credential sharing remains a risk signal problem |

### C.2 Recommended protection architecture

```text
Browser/PWA
  public lilyjs + AIR validator + basic arranger + compact instruments
  │ OAuth/OIDC session; short-lived audience-bound access token
  ▼
API gateway
  TLS, origin policy, rate limits, request size limits, token validation
  │ creates immutable job referencing AIR hash
  ▼
Arrangement service ── private style policies/adapters
  │ signed internal job identity, no public worker access
  ▼
Render queue ── GPU/CPU workers ── private model/sample registry
  │
  ▼
Object storage/CDN: short-lived signed result URLs, per-user authorization
```

Premium requests should send normalized AIR or a compact diff, not executable LilyPond extensions. Canonicalize before hashing/signing. Enforce limits on score length, voices, generation duration, retries, and concurrency. Jobs are owned by account/workspace; every status/download endpoint rechecks ownership.

Use an external identity provider or established auth library. Access tokens should be short lived, audience/issuer/expiry checked, and carried in `Authorization`, not query strings. Refresh through a secure `HttpOnly`, `Secure`, `SameSite` cookie or an appropriately protected native flow. Rotate signing keys, publish key IDs, prevent algorithm confusion, and keep subscription state server-side. A signed JWT is not a license database and should not grant months of irrevocable access.

For limited offline premium use, issue a signed entitlement manifest with account pseudonym, feature IDs, model/asset versions, issued/expiry times, and a short grace period. It is convenience, not strong DRM. Do not browser-fingerprint aggressively; use device/session caps and anomaly detection with an appeal path.

### C.3 Scraping and model-extraction defenses

- Per-account and per-IP rate/concurrency budgets with burst tolerance.
- Cost-weighted quotas based on rendered seconds, model, resolution, and retries.
- Idempotency keys and deduplication to prevent accidental double billing/rendering.
- Detect systematic grid probing, high-volume seed sweeps, account farms, and shared tokens; step up verification rather than silently corrupting results.
- Watermark/account-tag downloadable artifacts where musically acceptable; embed job provenance in file metadata and retain audit hashes.
- Return only required outputs, never logits, embeddings, model paths, internal prompts, or detailed failure traces.
- Network-segment workers; least-privilege object/model access; signed artifacts; dependency and container scanning; secret rotation.
- Contractual licenses/terms, contributor assignments, dataset provenance records, and trademark/product execution. Technical controls cannot replace clean rights.

### C.4 Client protection baseline

1. Production minification/tree shaking and hashed chunks.
2. Private source maps; upload them only to the error-monitoring service.
3. Selective AST obfuscation for the small proprietary local arranger module, with CI performance/size and browser-compatibility tests. Do not obfuscate dependencies or security logic.
4. Optional Rust/WASM for stable DSP/constraint kernels where performance justifies the port; strip debug/name sections. Treat this as moderate reading friction only.
5. Strict CSP, dependency lockfile/review, Subresource Integrity for unavoidable third-party static resources, no secrets in the PWA, and sanitized server-returned SVG/metadata.
6. Signed build/release provenance and server-side minimum-supported-client/schema versions for premium APIs.

Do not implement self-modifying code, hostile anti-debugging, device lock-in, hidden cryptocurrency work, or audio degradation as punishment. These harm legitimate musicians and are readily bypassed.

### C.5 Indie-startup cost/security recommendation

Ship a generous local MVP and protect only the economically sensitive tier:

- public/local: lilyjs parsing, AIR, basic arpeggiator, two compact instruments, playback and offline practice;
- server: premium style policies, orchestration, high-resolution instrument libraries, neural weights, stem/final rendering;
- auth: managed identity + a small entitlement API + metered job queue;
- infrastructure: one region, managed relational store, object storage/CDN, queue, autoscaled render workers; no Kubernetes until utilization/operations demand it;
- caching: deduplicate identical public/catalog jobs and reuse customer-owned results, reducing both latency and GPU spend;
- commercial launch gate: verify every code/model/sample/dataset license and generated-output term with counsel. Open-source code license and model-weight/data/output licenses are separate questions.

This gives strong practical protection for the crown jewels at manageable cost. Shipping premium weights to WebGPU would reduce compute cost but surrender confidentiality and create large downloads/coverage problems; reserve it for a future separately licensed offline edition.

---

## (d) Implementation Roadmap

### Implementation task checklist

The checkboxes below are the execution backlog. They are intentionally ordered by dependency; model experiments should not block the deterministic Stage 1 path.

#### Foundation and lilyjs boundary

> **Status 2026-07-21:** the lilyjs side of this section is being executed through
> `PLAN_ACCOMPANIEMENT_LilyJS.md` (Phases 0–2 complete, Phase 1 nearly complete —
> see that file and `~/projects/lilyJS/doc/accompaniment-timeline-audit/PHASE0_AUDIT.md`).
> lilyjs now ships an exact-Rational `PlaybackTimeline` with a conductor map
> (tempo/meter/key/bars/pickup), normalized structured harmony with intervals/pitch
> classes, and a diagnostics channel. All Giusto-side items (AIR package, adapter,
> `chordSchedule.ts` migration) are untouched.

- [ ] Decide the AIR package location (`packages/music-core` or `packages/accompaniment-core`) and assign ownership to Giusto.
- [ ] Define and version the AIR TypeScript types and JSON Schema (`air/1`).
- [x] Implement normalized rational arithmetic and safe JSON serialization for score time. *(done 2026-07-21 in lilyjs `music-model/rational.ts`: gcd-normalized `{num, den}` with add/sub/mul/div/compare/min/max, safe-integer guard, float-boundary recovery, JSON-safe plain objects; unit + property tests. Uses safe `number` components per the Phase 0 decision, not `bigint` — the guard diagnoses overflow instead)*
- [ ] Redesign LilyJS `PlaybackTimeline`, `TimelineOptions`, `TimelineDiff`, diagnostics, and source-map contracts in `src/music-playback/`. *(partial 2026-07-21: `PlaybackTimeline` redesigned — exact QN events, `conductor`, `harmony`, `diagnostics`; `TimelineOptions` (repeatMode/gracePolicy), `TimelineDiff`, and the `sourceMap` are still open)*
- [x] Expose normalized harmony AST data: root, bass, quality, alterations, omissions, pitch classes, offset, and deterministic duration. *(done 2026-07-21: `PlaybackTimeline.harmony` — `NormalizedHarmonyEvent[]` with spelled root/bass, 15-value quality vocabulary, extensions/additions/alterations/omissions, materialized `intervals` + `pitchClasses`, exact QN start/duration, continuation/skip/no-chord provenance, original display text; Gm–Cm–F–B♭ fixtures)*
- [ ] Expose complete tempo, meter, key, pickup, barline, rehearsal-mark, repeat, volta, and jump structures. *(partial 2026-07-21: tempo/meter/key/pickup/barlines shipped as the exact `ConductorMap` incl. per-bar expected-vs-actual durations and repeat pass indices; rehearsal marks, a public repeat/volta `StructureGraph`, and jumps (absent from the parser) remain)*
- [ ] Implement written-order and expanded-performance iterators with source-measure/pass provenance and a traversal limit. *(partial: expanded performance with per-event `occurrenceIndex` and per-bar `sourceMeasureId`/`passIndex` shipped; written-order mode and the traversal limit remain)*
- [ ] Expose absolute sounding pitches, written spellings, voices/staves, ties, grace notes, articulations, dynamics, slurs, and pedal markings. *(partial: sounding MIDI pitches, grace flags, and exact pedal events shipped; written spellings, voice/staff ids, tie segments, articulations, dynamics, and slurs are the lilyjs Phase 3 backlog)*
- [ ] Add stable semantic IDs and document their behavior across whitespace-only and localized source edits. *(partial: ids are deterministic and rerender/layout-independent, documented in the Phase 0 audit; they are index-based so NOT edit-stable — the approved fallback is `revisionHash` invalidation, which is not yet implemented)*
- [ ] Make the redesigned `buildPlaybackTimelineFromScore()` and `diffPlaybackTimeline()` the supported LilyJS public API with generated declarations.
- [x] Migrate LilyJS scheduler, tempo, MIDI, pedal, grace, repeat, synth-boundary, and SVG-binding code to consume the same canonical `PlaybackTimeline`. *(done 2026-07-21: all consume the exact-Rational timeline — MIDI export derives ticks/tempo meta from the conductor, `tempoRegions` left the canonical shape; one refinement remains for lilyjs Phase 7: the scheduler still reads builder-stamped seconds rather than converting at its own boundary)*
- [ ] Build the Giusto `PlaybackTimeline` → AIR adapter without importing React, DOM, SVG, or audio code.
- [ ] Add schema validation and explicit rejection/diagnostics for unsupported or ambiguous LilyPond constructs. *(partial: the typed `Diagnostic` channel exists with harmony diagnostics — `unresolved-chord-quality`, `overlapping-harmony-spans`; JSON Schema and broad unsupported-construct coverage remain)*
- [ ] Add golden fixtures for pickups, tuplets, ties, grace notes, tempo/meter changes, chord extensions/inversions/skips, repeats, voltas, and section marks. *(all shipped 2026-07-21 in lilyjs — incl. exact nested-tuplet grids, dotted-quarter 6/8 tempo, embedded-voice islands, repeat pass indices — EXCEPT section-mark fixtures, blocked on rehearsal-mark exposure)*
- [ ] Migrate `src/audio/chordSchedule.ts` consumers to AIR while retaining compatibility tests during the transition.

#### Stage 1 interactive accompaniment

- [ ] Define the renderer-neutral `PerformancePlan`, `PerformanceNote`, expression-curve, and validation-report schemas.
- [ ] Implement a pattern DSL covering direction, range, density, accents, anticipation, passing tones, cadence behavior, and voice-leading targets.
- [ ] Implement deterministic seeded piano arpeggio generation with range, polyphony, hand/register, and chord-tone constraints.
- [ ] Implement deterministic seeded solo-cello generation with monophonic range, leap, bow-change, legato, and phrase constraints.
- [ ] Implement the hard plan validator and make any harmony/timeline/range violation fail generation.
- [ ] Add explainable planner output describing pattern, voicing, substitutions, and constraint decisions.
- [ ] Create AIR, performance-plan, and expected-event fixtures for `practice-arpeggios-Gm-Cm-F-Bb.ly`.
- [ ] Implement the AudioWorklet scheduler with revision IDs, look-ahead scheduling, cancellation, and underrun telemetry.
- [ ] Implement sample-accurate loop transitions, pre-roll/tails, tempo rescheduling, and short crossfades.
- [ ] Select and license production piano and cello source recordings or instrument packs.
- [ ] Implement piano velocity layers, round robin, release samples, pedal/resonance approximation, and voice limits.
- [ ] Implement cello attacks, sustains, releases, legato transitions, bow-change selection, dynamics, and vibrato curves.
- [ ] Implement streaming, decoding, IndexedDB/Cache Storage caching, LRU eviction, and asset-version invalidation.
- [ ] Implement direct AIR/performance-event buffers for the local renderer without requiring MIDI.
- [ ] Implement MIDI 1.0 export with tempo/meter events and a sidecar AIR mapping for DAW interoperability.
- [ ] Evaluate MIDI 2.0/UMP and MPE/per-note-expression export based on actual browser/device/DAW support.
- [ ] Build rule-based microtiming, velocity, articulation, pedal, vibrato, and phrase-dynamic expression.
- [ ] Train and benchmark a compact score-to-expression model; export to ONNX with WebGPU and WASM execution paths.
- [ ] A/B test server-side MIDI-DDSP cello against the production cello renderer.
- [ ] Evaluate piano MIDI-to-audio/neural checkpoints for quality, exactness, latency, reproducibility, and commercial licensing.
- [ ] Add UI controls for pattern, instrument, density, variation seed, loop behavior, and deterministic regenerate.
- [ ] Add MIDI/audio export, stage-level performance telemetry, privacy controls, and blind-listening evaluation tooling.
- [ ] Verify all Stage 1 latency, underrun, correctness, licensing, and listening-test exit gates before launch.

#### Stage 2 orchestral layering

- [ ] Extend AIR/performance plans with orchestral instruments/desks, transposition, divisi, techniques, hairpins, and section expression.
- [ ] Define a renderer-neutral articulation map and capability negotiation for each instrument backend.
- [ ] Implement harmonic-function, voicing/register, instrument-assignment, doubling, density, and rest policies.
- [ ] Generate independent constrained desk/section lines and validate range, polyphony, breath/bow, transition, and low-register spacing rules.
- [ ] License and deploy an orchestral sampler/render baseline before replacing individual stems with neural renderers.
- [ ] Render independently retryable section stems and a conductor-level mix with room placement, reverb, loudness, and headroom control.
- [ ] Implement symbolic-to-audio onset/pitch/chroma verification as a warning/retry signal, not the sole proof of correctness.
- [ ] Implement authenticated render jobs, idempotency, progressive previews, content-addressed caching, signed result access, and cost telemetry.
- [ ] Assemble rights-clean symbolic scores, instrument performances, articulation data, and aligned stems for training/evaluation.
- [ ] Run sparse/dense orchestration listening tests and verify Stage 2 quality and unit-economics gates.

#### Stage 3 style-conditioned audio

- [ ] Define the StylePack schema: symbolic policy, ensemble, groove, articulations, expression adapter, renderer assets/adapters, mix preset, and evaluation suite.
- [ ] Convene expert musicians to define substyles, meters, grooves, instrumentation, regional context, techniques, tempo ranges, and unacceptable stereotypes.
- [ ] Implement and evaluate Jazz (piano + double bass) symbolic and expression policies first.
- [ ] Implement and evaluate Gypsy Jazz/Manouche guitar and bass policies with purpose-recorded rhythm-guitar articulations.
- [ ] Implement and evaluate Celtic tune-type, meter/accent, modal, drone, ornament, and instrumentation policies.
- [ ] Split generic Folk into explicit regional/instrument variants and implement the selected launch variants.
- [ ] Implement and evaluate Old-Time fiddle, banjo, guitar, bass-run, drone, bowing, and density policies.
- [ ] Commission rights-clean aligned sessions across keys, tempos, meters, forms, instruments, rooms, and performers.
- [ ] Create per-item provenance and rights records covering consent, training, derivative models, outputs, deletion, territory, and term.
- [ ] Train small symbolic/expression adapters before attempting audio-model fine-tuning.
- [ ] Benchmark server audio adapters/LoRAs against licensed render assets and adopt only improvements that pass exactness and blind tests.
- [ ] Add reference-style consent, similarity, and living-artist impersonation safeguards.
- [ ] Build style-specific expert evaluation rubrics rather than relying on generic text/audio similarity metrics.
- [ ] Verify Stage 3 idiomaticity, AIR compliance, rights, render-cost, abuse, and latency gates per StylePack.

#### Security and operations across all stages

- [ ] Define free/local versus premium/server feature boundaries and document the threat model.
- [ ] Implement managed authentication, server-owned entitlements, short-lived audience-bound access tokens, and secure refresh handling.
- [ ] Enforce account/job ownership, duration/concurrency/cost quotas, rate limits, idempotency, and abuse detection on every premium endpoint.
- [ ] Keep premium policies, weights, samples, prompts, and model artifacts in private server-side storage with least-privilege worker access.
- [ ] Implement signed, expiring result URLs and prevent bearer tokens from entering URLs, cache keys, or logs.
- [ ] Keep production source maps private; enable minification and measure selective obfuscation only on small proprietary local modules.
- [ ] Use WASM only for measured DSP/constraint performance or modest reverse-engineering friction, never as an authorization boundary.
- [ ] Add build provenance, dependency/container scanning, artifact signing, audit logging, secret rotation, backups, and disaster-recovery tests.
- [ ] Complete legal review of every code, model-weight, dataset, sample-library, training, and generated-output license before commercial release.

## Stage 1: MVP (lilyjs API alignment + Smart Arpeggiator + Cello/Piano Neural Audio)

**Goal:** exact, expressive Gm–Cm–F–Bb and general chord-chart playback with instant editing/looping, two credible instruments, deterministic exports, and an experimental neural comparison.

### Work packages

1. **AIR contract and lilyjs alignment (weeks 1–3)**
   - Define JSON Schema/TypeScript types and rational arithmetic.
   - Redesign upstream `buildPlaybackTimelineFromScore` and `PlaybackTimeline` in `src/music-playback/`, including public structure/conductor/harmony types and source mapping.
   - Expand the lilyjs conformance corpus: pickups, tuplets, ties, grace, tempo/meter changes, chord skips/extensions/inversions, repeats/voltas and section marks.
   - Replace Giusto’s first-part/floating `buildChordSchedule` derivation with an AIR adapter while retaining compatibility tests.

2. **Planner and validator (weeks 2–6)**
   - Build pattern DSL: direction, octave span, density, accent, anticipation, passing-tone policy, voice-leading target, cadence behavior.
   - Implement piano two-hand and solo-cello range/playability constraints.
   - Add seeded phrase variation and a validator producing actionable diagnostics.
   - Add AIR/plan/MIDI fixtures for `practice-arpeggios-Gm-Cm-F-Bb.ly`.

3. **Real-time render engine (weeks 4–8)**
   - AudioWorklet scheduler, sample-accurate event queue, cancellation revisions, crossfade/loop state.
   - Piano velocity layers, round robin, pedal/release/resonance approximation; cello sustains/attacks/releases, legato and vibrato controls.
   - Stream and cache instrument packs; measure mobile memory and decode time.

4. **Expression and neural research track (weeks 6–10)**
   - First ship rule/human-performance-curve expression.
   - Train/quantize a small score-to-expression model; ONNX WebGPU with WASM fallback.
   - Server A/B MIDI-DDSP cello against the licensed multisample renderer.
   - Evaluate available piano MIDI-to-audio checkpoints/implementations under blind listening, exact-onset, latency, license, and failure tests.

5. **Product and observability (weeks 8–12)**
   - Instrument/style/variation controls, deterministic regenerate, MIDI and audio export.
   - Stage timing, underrun, cache, plan-validation, render-job and subjective-rating telemetry without storing private scores by default.
   - Blind comparison against the current drone and representative chord-track tools.

### Stage 1 bottlenecks

- lilyjs harmony normalization and repeat semantics are more important than model selection.
- cello realism depends on transitions and bow phrasing; isolated “nice” notes do not prove phrase quality.
- piano sample-pack bandwidth and licensing can dominate the web architecture.
- WebGPU coverage/thermal behavior requires WASM and non-neural fallbacks.
- The word “neural” must not force a worse launch renderer.

### Stage 1 data and hardware

- Owned/licensed, tightly aligned cello and piano MIDI/score–audio: isolated articulations plus musical phrases, multiple dynamics, legato transitions, releases, room/mic metadata.
- Expressive performance event data with consent and commercial training rights. MAESTRO is useful for piano research because it provides aligned performance MIDI/audio, but its repertoire/domain and license must be checked for the intended training/distribution use; do not assume it covers product-grade acoustic styles.
- Development: modern CPU, representative iOS/Android/desktop devices, one 24 GB-class GPU rental for experiments. Production MVP can be static/PWA plus modest API/CPU services if the neural renderer remains beta.

### Stage 1 exit gates

- lilyjs/AIR golden suite passes; no timeline drift.
- chord/range validator passes every generated plan.
- transport actions meet the B.6 latency/underrun gates.
- blind listeners prefer or rate MVP non-cheesy versus the incumbent baseline.
- neural backend ships only if it beats the sample baseline on its stated use case and has deployable rights.

## Stage 2: Orchestral Layering (Polyphonic chord expansion and symphonic rendering)

**Goal:** generate editable, exact section stems and a coherent orchestral mix from AIR.

### Work packages

1. Extend AIR with orchestral instrument/desk identity, transposition, divisi, playing techniques, dynamics/hairpins and per-note expression.
2. Build orchestration graph: harmonic function → voicing/register → instrument assignment → monophonic desk lines → articulation/dynamics.
3. Implement hard constraints (range, polyphony, breath/bow, impossible transitions) and soft mix-aware spacing rules.
4. Render section stems through a licensed sampler farm first; add neural/DDSP renderers per instrument after blind validation.
5. Implement conductor-level expression, room placement, convolution/algorithmic reverb, loudness/headroom and stem mixer.
6. Add audio verification using onset/pitch/chroma estimates against AIR; retry/fallback only the failing stem.
7. Deploy authenticated queued rendering, progressive previews, content-addressed cache and cost telemetry.

### Stage 2 bottlenecks

- paired multitrack orchestral score/MIDI/audio data is scarce and license-sensitive;
- polyphonic texture and orchestration quality are arrangement problems, not merely timbre problems;
- articulations and transitions differ across libraries/models and need a renderer-neutral abstraction;
- GPU/render cost grows with independent stems, but a monolithic waveform loses editability and validation;
- automatic transcription cannot prove correctness alone, especially in dense mixes.

### Stage 2 data and hardware

- Properly licensed symbolic orchestral scores with part labels and instrumentation.
- Aligned multitrack/stem recordings or rendered stems with articulation/dynamic metadata; supplement with legally licensed synthetic renders, then fine-tune/evaluate on real recordings.
- Individual-instrument expressive datasets; URMP is a useful research seed for aligned chamber/orchestral instruments and underpins MIDI-DDSP, but is far too small/narrow to constitute a premium orchestra by itself.
- One warm 24–48 GB GPU worker per selected neural model plus CPU/RAM-heavy sampler workers and fast local sample storage. Add 80 GB/multi-GPU only if profiling a chosen checkpoint proves necessary.

### Stage 2 exit gates

- 100% symbolic constraint compliance on the test suite.
- stems are independently downloadable/editable and failures are localized.
- blind orchestration/timbre scores exceed a declared baseline across sparse and dense excerpts.
- p95 render cost and latency meet subscription unit economics.

## Stage 3: Style-Conditioned Audio (Jazz, Gypsy Jazz, Celtic, Folk, Old-Time acoustic modeling)

**Goal:** five idiomatic, controllable acoustic StylePacks with explainable symbolic plans and premium neural/studio renders.

### Work packages

1. Define style ontology with expert musicians: substyle, meter/groove, ensemble, era/region, techniques, tempo range and prohibited stereotypes.
2. Build one StylePack at a time, beginning with jazz piano+bass because aligned symbolic performance data and objective harmony evaluation are comparatively tractable.
3. Create licensed corpora and annotation pipelines; retain provenance, performer consent, allowed uses, territory/term, deletion obligations and model/output terms per item.
4. Train small symbolic arrangement and expression adapters; enforce AIR constraints after generation.
5. Train or fine-tune stem-specific audio adapters/LoRAs only where they beat licensed render assets. Evaluate ACE-Step/other current foundation models as offline candidates, never assuming project benchmark claims transfer to exact accompaniment.
6. Build expert evaluation panels and style-specific tests: swing/groove timing, bass-line continuity, guitar attack envelopes, fiddle ornaments/bowing, modal harmony, density and ensemble balance.
7. Add reference-style conditioning only with rights/consent controls, similarity safeguards and a policy against impersonating living artists by name.

### Stage 3 bottlenecks

- dataset rights and culturally/regionally accurate labels;
- sparse representation of Gypsy-jazz rhythm guitar, old-time bowing/banjo technique and local folk traditions in generic datasets;
- disentangling arrangement style, performer identity, instrument timbre and recording room;
- exact harmony versus idiomatic substitutions—make substitutions an explicit user policy, never silent model drift;
- evaluation: generic text/audio similarity scores do not measure whether a walking bass or la pompe pattern is musically correct.

### Stage 3 data and hardware

- Commissioned studio sessions are the safest premium core: isolated/stemmed ensembles playing generated chord charts across keys, tempos, meters and forms, with MIDI/click/score alignment and explicit ML rights.
- License archival and commercial multitracks where terms permit training; transcribe/align with human verification. Public research datasets can bootstrap representation learning but should not be presumed commercially deployable or stylistically sufficient.
- Collect negative/contrast examples and expert preference rankings, not just audio. Record room/mic/instrument/performer metadata.
- Adapter training can begin on one to four 24–80 GB GPUs depending on the base model and sequence duration. Full foundation-model pretraining would require orders of magnitude more data/capital and is not recommended for an indie startup. Production uses warm pools per popular StylePack, autoscaled overflow, and cached deterministic renders.

### Stage 3 exit gates

- expert musicians identify each StylePack as idiomatic without seeing its label at a predefined success rate;
- exact AIR compliance passes unless the user explicitly enables reharmonization/substitution;
- dataset/model/output rights register is complete and audited;
- each style meets quality, render-cost, abuse and latency budgets before general availability.

---

## Cross-stage engineering gates and evaluation

Every renderer must implement:

```ts
interface AccompanimentEngine {
  plan(input: AccompanimentIR, request: PlanRequest): Promise<PerformancePlan>
  validate(plan: PerformancePlan, input: AccompanimentIR): ValidationReport
  preview(plan: PerformancePlan, range: QNRange): AsyncIterable<PreviewChunk>
  render(plan: PerformancePlan, options: RenderOptions): Promise<RenderManifest>
}
```

Evaluation has four separate scorecards:

1. **Correctness:** chord coverage, onset/duration, range/playability, structure/repeat and deterministic-seed tests.
2. **Musicality:** expert pairwise ratings for phrasing, voice leading, style, variation and accompaniment usefulness.
3. **Audio:** artifacts, realism, transient/legato quality, loudness, stereo/room consistency and stem bleed.
4. **System:** control latency, underruns, cache rate, render factor, GPU seconds/output minute, failures/retries and cost.

Do not collapse these into one model metric. A beautiful render with a wrong chord is a failed backing track; a correct but lifeless render needs better expression/renderer; a slow correct render belongs in the studio tier.

## Final decision

Proceed with Stage 1. The codebase already has enough lilyjs semantics to prototype AIR and the deterministic arpeggiator, but lilyjs needs a supported exact timeline/harmony/structure API before model work scales safely. Make symbolic correctness and a high-quality multisample AudioWorklet the launch path. Run cello MIDI-DDSP and newer piano score-to-audio systems as bounded server experiments, not dependencies.

Defer a full generative-audio model and orchestral GPU cluster. Stage 2 should begin as explicit orchestration plus section stems rendered through licensed tools. Stage 3 should invest first in expert-defined StylePacks and rights-clean performances; use current foundation models only where controlled evaluations show that they improve a specific stem or studio render.

Keep premium policies and weights server-side, validate entitlements and ownership on every material request, and use minification/selective obfuscation/WASM solely as a client baseline. This architecture delivers the immediate musician-facing advantage—fast, exact, expressive accompaniment—while preserving a credible route to neural studio quality without betting the product on an unsolved control problem.

## Primary sources consulted

- [ACE-Step 1.5 official repository and model documentation](https://github.com/ace-step/ACE-Step-1.5)
- [Meta AudioCraft: MusicGen documentation](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md)
- [Meta AudioCraft: MusicGen-Style documentation](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN_STYLE.md)
- [Google Magenta MIDI-DDSP official repository](https://github.com/magenta/midi-ddsp)
- [Google Magenta DDSP official repository](https://github.com/magenta/ddsp)
- [Stability AI stable-audio-tools official repository](https://github.com/Stability-AI/stable-audio-tools)
- [ONNX Runtime Web documentation](https://onnxruntime.ai/docs/tutorials/web/)
- [MIDI-VALLE paper](https://arxiv.org/abs/2507.08530)
- [Chord-constrained symbolic harmonization paper](https://arxiv.org/abs/2512.07627)
