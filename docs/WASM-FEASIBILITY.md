# WebAssembly feasibility for Giusto and lilyjs

**Status:** research recommendation, 2026-07-18  
**Decision:** do not compile the whole app or lilyjs bundle to WebAssembly. Keep React, Web Audio integration, and SVG construction in TypeScript. If profiling shows a user-visible engraving bottleneck, prototype one coarse-grained layout kernel in Rust/WASM—starting with system packing plus spring spacing, and adding beam quantization only if it is independently hot. Treat WASM as a performance experiment and mild reverse-engineering friction, not as a security or licensing boundary.

## Executive summary

Shipping *some* lilyjs computation as WASM is feasible. Shipping the existing app or renderer unchanged as a useful WASM module is not.

- Giusto is a React/TypeScript PWA. lilyjs parses text into a large object graph, computes engraving geometry, then directly creates and updates browser SVG/DOM. WASM supplies computation and imported host calls; it does not supply the DOM or Web APIs ([WebAssembly portability/API model](https://webassembly.org/docs/portability/)). The UI and final SVG emission therefore remain JavaScript unless they are substantially rewritten around bindings.
- The best native-WASM candidates are closed numeric kernels with typed-array inputs: dynamic-programming system breaking, spring solving, beam candidate scoring/quantization, and possibly slur optimization. Parsing strings, moving the music-model object graph, glyph lookup, and creating many SVG nodes are poor boundaries.
- Existing TypeScript cannot simply be handed to AssemblyScript: AssemblyScript is a TypeScript-*like* language with a different runtime/type model, and its own FAQ warns that pre-existing TypeScript does not automatically become faster, especially with managed objects, strings, complex objects, or frequent host calls ([AssemblyScript FAQ](https://www.assemblyscript.org/frequently-asked-questions.html)). This is a port, not a compiler switch.
- Javy executes JavaScript inside an embedded JS runtime. Its static modules currently start around 869 KB; small modules require dynamically linking the runtime ([Javy README](https://github.com/bytecodealliance/javy#about-this-repo)). That architecture is useful for WASI/server sandboxing, not for accelerating or hiding a DOM-heavy browser renderer already running in a highly optimized browser JS engine.
- Porffor is true AOT JS/TS compilation, but its repository explicitly calls it a research project “not yet intended for serious use,” says only limited JS is supported, and lists language limitations ([Porffor README](https://github.com/CanadaHonk/porffor#porffor--p%C9%94rf%C9%94r-poor-for)). It is not a production route for lilyjs today.
- WASM does not protect a secret shipped to a browser. Standard tools can disassemble a module and inspect its call graph; the Rust/WASM guide explicitly documents `wasm-objdump` and `twiggy` for doing so ([Rust/WASM binary inspection](https://rustwasm.github.io/book/print.html#inspecting-wasm-binaries)). Stripped names and optimized machine-like code raise effort but do not provide confidentiality or tamper-proof licensing.

The practical product strategy is: minify and optionally obfuscate selected proprietary JavaScript as a baseline; enforce paid access on a server with short-lived entitlements and server-owned data; and keep genuinely valuable premium algorithms or canonical high-quality rendering server-side. A WASM layout kernel should proceed only after browser profiling and a benchmark prove it wins enough to justify a second-language implementation.

## 1. Current architecture and measured baseline

### Relevant application boundary

Giusto imports three synchronous lilyjs APIs:

- `parseSource(source)` builds a `MusicDocument`/`Score` object graph used by rendering and playback scheduling.
- `renderLily(container, source)` parses and renders into a supplied DOM container.
- `renderScore(container, score)` renders an already parsed score into SVG.

`src/pages/practice/LilyScore.tsx` invokes those APIs in a React effect. Playback later finds and marks SVG elements through `createSvgPlaybackBinding`. The renderer also rerenders after music fonts load. Consequently, the renderer depends on JavaScript objects, fonts, timers, and DOM/SVG identity, not merely arithmetic.

The vendored `packages/lilyjs/lilyjs.esm.js` is 2,024,843 bytes unminified. A current `bun run build` (which already uses `minify: true`) produces one 3,472,676-byte JavaScript chunk, 1,678,336 bytes under local gzip. This is a reproducible local snapshot, not a network transfer measurement; production compression and cache headers still determine actual delivery.

Much of the bundle is not hot algorithmic code. It includes parser/model code, renderer code and large embedded SMuFL glyph/font metadata. Moving a few numerical functions to WASM will not by itself remove those assets. First-load size and render CPU must be measured separately.

### Candidate hot paths found in lilyjs

The bundle retains source module labels and shows these relevant algorithms:

| Area | Current shape | WASM fit | Why |
|---|---|---:|---|
| `layout/springModel.ts` | Binary-searches force for 100 iterations and repeatedly reduces a spring array | High | Numeric, deterministic, compact input/output |
| `layout/rowPacking.ts` | Dynamic programming across possible measure intervals; typed-array caches | High | Potentially O(measures²), numeric and batchable |
| `engraving/beamQuanting.ts` | Enumerates and scores pairs of beam positions, including collision penalties, then sorts candidates | Medium–high | Compute-heavy numeric loop, but requires packed obstacle data |
| slur curve optimizer | Generates/scores geometric candidates | Medium | Numeric, but model/geometry marshaling may dominate small scores |
| measure flow / auto-beaming | Iterates heterogeneous note and engraving-event objects | Low–medium | Likely linear and object-heavy; JS is already a good fit |
| LilyPond parser/model | Strings, maps, unions, nested allocations and diagnostics | Low | Encoding/copying plus a large port; little reason to expect a win |
| glyph lookup and SVG renderer | Registry objects, font readiness, DOM/SVG calls | Low | Host-bound; frequent WASM↔JS calls erase the useful boundary |

This is a static code assessment, not proof that these functions dominate real sessions. No performance claim should be accepted until a representative browser profile exists.

## 2. Feasibility and toolchains

### Rust + `wasm-bindgen` / `wasm-pack` — recommended for a spike

Rust can implement layout kernels against flat arrays and expose a small JS wrapper using `wasm-bindgen`; `wasm-pack` packages the result for normal web bundling ([Rust and WebAssembly guide](https://rustwasm.github.io/docs/book/)). It provides mature numeric types, testing, profiling and optimization through LLVM/Binaryen.

Use one call such as `layout_system(inputBuffer) -> outputBuffer`, not a call per note or candidate. Strings crossing a typical `wasm-bindgen` boundary are copied between the JS heap and WASM linear memory via encoding/decoding ([wasm-bindgen string reference](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/string.html)); nested JS objects add further conversion/allocation. For this project, pack numeric records into `Float64Array`/`Uint32Array`, keep them in WASM for the complete solve, and return only system breaks, x positions and beam endpoints.

Rust is the stronger long-term option if the kernel grows: explicit memory layout, good benchmark tooling, and fewer surprises than simulating dynamic JavaScript semantics. Costs are Rust expertise, duplicated domain types, generated JS glue, asynchronous module initialization, and maintaining exact output parity.

### AssemblyScript — viable alternative for a very small kernel

AssemblyScript offers familiar syntax and compiles through Binaryen ([AssemblyScript](https://www.assemblyscript.org/)). It can be productive for a few array-oriented functions. Its runtime choices and manual memory concerns still matter; strings are represented through linear-memory pointers rather than being passed as JS strings ([AssemblyScript runtime](https://www.assemblyscript.org/runtime.html)).

It is **not** drop-in TypeScript. lilyjs uses normal JS/TS features—heterogeneous object graphs, maps/sets, DOM types, closures and browser APIs—that would need redesign or imports. AssemblyScript is reasonable only if the team strongly prefers TypeScript-like syntax and the spike remains deliberately small. Rust has the better risk/reward profile for a durable solver.

### Javy, `componentize-js`, and Jco — wrong execution model here

Javy packages JavaScript with an embedded JS runtime and targets WASI-style execution. It preserves JS behavior but does not turn dynamic JS into a lean numeric native kernel. A browser build would still need a host adapter for DOM operations, and duplicating a JS engine inside a browser adds initialization, runtime, memory and binary cost. It is not expected to beat the browser's JIT on lilyjs, and it does not remove the source algorithm from a determined reverse engineer.

The Bytecode Alliance's Jco stack can build JS/TS WebAssembly components using `componentize-js` and transpile components to browser-compatible ES modules ([Jco README](https://github.com/bytecodealliance/jco)). This is valuable for portable component/WASI workloads. It is not an automatic performance compiler for a DOM renderer; the example architecture embeds SpiderMonkey. Consider it for server/edge sandboxing of untrusted plugins, not for Giusto's client engraving path.

### Porffor — track, do not adopt

Porffor's AOT approach is conceptually closer to the requested JS→WASM outcome and could provide harder-to-read artifacts. Its current project documentation still labels it experimental and seriously limited. lilyjs is a demanding compatibility target because it needs broad modern JS behavior and browser objects. Reassess only after Porffor declares production readiness, supports lilyjs's feature set, supplies stable browser/DOM interop, and passes the complete parser/render golden suite.

### Whole-app Rust/AssemblyScript rewrite

A whole-app rewrite is technically possible only in the broad sense that a Rust web UI can call browser APIs. It would not make React, media permissions, Web Audio scheduling, local storage, service workers or SVG disappear; they remain host integrations behind bindings. It would carry high rewrite and regression cost with no established performance need. It is out of scope as a rational optimization.

## 3. Performance implications

### Where WASM may win

WASM is most promising when all of these are true:

1. Browser profiles show a numeric solver consumes a meaningful share of render latency.
2. A single invocation performs enough work to amortize setup and marshaling.
3. Inputs/outputs can be flattened without JSON or per-object bridge calls.
4. Rendering the resulting SVG is not already the dominant cost.

System breaking is the clearest target. `dpPackSection` considers intervals in nested loops and computes width/badness. For long scores this can scale quadratically in measure count. Spring solving is also cleanly batchable, although its arrays are usually short; its fixed 100-step binary search suggests room for an algorithmic improvement in TypeScript before a port. Beam quantization evaluates a bounded grid of candidates and collision penalties for each beam group. That arithmetic may benefit on dense scores, but ordinary exercises contain few notes per beam, making boundary and initialization costs relatively large.

### Why a slowdown is plausible

- Modern browser JavaScript JITs optimize number-heavy loops and typed arrays well. WASM is not universally faster.
- Giusto's current exercises are small, and engraving occurs on selection/change rather than every animation frame. A 2× solver improvement can be irrelevant if the solver is 5% of an occasional 40 ms render.
- The score model is a large nested JS graph. Serializing it wholesale to JSON or reconstructing it in Rust could cost more than the solve.
- SVG creation, attribute setting, text/font measurement and React lifecycle remain on the main thread. Calling them individually from WASM is particularly unattractive.
- WASM compilation/instantiation and another fetched asset affect cold-start latency. Streaming instantiation and caching help, but must be counted.
- WASM on the main thread does not prevent UI blocking. A Worker can improve responsiveness independently of whether the code is JS or WASM; the wasm-bindgen guide notes that the browser main thread cannot block and describes worker-based WASM threading constraints ([wasm-bindgen guide](https://wasm-bindgen.github.io/wasm-bindgen/print.html#rayon)).

### Required benchmark, not speculative targets

Before porting, instrument these stages with `performance.mark`/`measure`:

1. source preprocessing and parse;
2. model-to-engraving transformation;
3. measure facts and system packing;
4. per-system spring spacing;
5. beam/slur geometry;
6. SVG tree creation/insertion;
7. font-ready rerender;
8. total time to first stable score.

Use at least: the bundled short exercise, a 32-measure dense scale, a 100+ measure score, polyphonic/chordal notation, dense beams/collisions, and a slur-heavy score. Run warm and cold samples on current iPhone Safari, mid-range Android Chrome and desktop Chrome/Firefox/Safari. Track p50/p95 latency, long tasks, peak memory, compressed transfer size and cold initialization. The Rust/WASM guide likewise recommends confirming that the bottleneck is inside WASM-worthy code before investing and using browser profilers for real comparisons ([profiling guidance](https://rustwasm.github.io/book/print.html#time-profiling)).

Suggested go/no-go gate for a production port:

- exact or tolerance-defined geometry parity on the golden corpus;
- at least 20% lower p95 **total stable-render time** on a representative mobile device for long/dense scores, or elimination of a measured >50 ms long task;
- no material regression for short-score cold render;
- compressed app payload increase below an agreed budget (suggested: 100 KB for the kernel and glue);
- fallback to the TypeScript solver if WASM fails to load.

The numbers are decision thresholds, not forecasts.

## 4. Code protection and licensing

### What WASM protects—and does not

An optimized, stripped WASM binary is less immediately readable than formatted JavaScript. That is useful friction against casual copying. It is still client-delivered code under the user's control: it can be downloaded, disassembled, instrumented, patched, have imports/exports observed, and have license checks bypassed. WebAssembly's own specification says its code is intended to be inspectable/debuggable ([WebAssembly core specification](https://webassembly.github.io/spec/core/)). Do not ship API secrets, private signing keys, master content keys or an authorization decision whose integrity matters inside JS **or** WASM.

WASM isolation protects the host from a module; it does not protect a module from the host that owns its bytes and inputs. Obfuscating names or encrypting the WASM and decrypting it in-browser only relocates the recoverable key and loader.

### Realistic layered options

#### 1. Minification and selective obfuscation: baseline deterrence

The production build already enables Bun minification. Keep source maps private, strip debug/name sections from any release WASM, tree-shake/split the app, and set immutable hashed-asset caching. If casual cloning is a business concern, apply a maintained obfuscator only to a small proprietary module after minification—not React/vendor code—and keep CI tests plus a strict performance/size budget. Obfuscation increases debugging difficulty, can inhibit optimization, expands artifacts in some configurations, and is bypassable. It is a deterrent, not enforcement.

#### 2. Server-enforced entitlements: recommended license control

Authenticate the customer and have the server decide access to premium APIs/content on every material request. Issue short-lived, audience-bound signed access tokens; validate subscription/account state server-side; rate-limit and log anomalous use; revoke or rotate credentials; and never rely on a browser boolean such as `isPremium`. Offline access can use a signed, expiring entitlement and encrypted cached content, but a determined user can still patch local display checks or capture decrypted content. Set the expiry and offline grace period according to the product promise.

Signed tokens prevent customers from *forging* grants; they do not stop a valid customer from sharing an artifact or modifying the client. Device binding is brittle on the web and should be a risk signal, not the sole license mechanism.

#### 3. Keep premium capability server-side: strongest practical protection

If premium value is a proprietary engraving/layout algorithm, never deliver that implementation. Send source or a normalized score to an authenticated rendering service and return sanitized SVG, a compact geometry display list, PDF/PNG, or precomputed score assets. The server can watermark/account-tag outputs and enforce quotas.

Trade-offs are hosting cost, latency, availability, privacy implications for uploaded music, and reduced offline support. Returning SVG exposes the *result*, not the algorithm; sanitize SVG and use a restrictive CSP because SVG can contain active or external content. For fixed catalog exercises, pre-render at publish time and gate signed/CDN URLs. For interactive width/theme changes, return geometry or a small set of precomputed widths/themes rather than rerunning on every resize (Giusto already engraves at a fixed width and CSS-scales the SVG).

If the premium value is catalog/content rather than layout, keep catalog metadata minimal in the public bundle and fetch licensed content after server authorization. Once content is displayed it can be copied, so combine access control with contractual terms, watermarking and abuse detection rather than promising DRM.

#### 4. Hybrid

Keep a capable free/offline TypeScript renderer locally; call the server for premium notation features or canonical export quality. A local Rust/WASM kernel can improve free/offline performance but should not contain the most sensitive premium implementation. This gives graceful degradation without confusing performance engineering with protection.

## 5. Recommendation

1. **Do not pursue whole-app or whole-lilyjs WASM compilation.** Javy/componentized JS duplicates a JS runtime and does not suit DOM rendering; Porffor is explicitly experimental; AssemblyScript/Rust require a real port.
2. **Profile before porting.** Add stage timings and a representative engraving corpus in the lilyJS source repository, where the real TypeScript modules and tests live. The vendored bundle in this repository is an output artifact and should not be hand-edited.
3. **Try algorithmic TypeScript improvements first.** The spring solver currently performs 100 full-array iterations; profile whether a lower convergence bound or analytic/piecewise solution preserves output. Move parsing/layout to a Worker if responsiveness, rather than throughput, is the problem. Split/lazy-load lilyjs so users who never open Play-Along do not pay its startup cost, and investigate external/lazy glyph data because WASM will not solve embedded asset weight.
4. **If the benchmark gate is met, spike a Rust kernel.** Port system packing and spring spacing together behind one packed-array call. Keep SVG/DOM and model construction in TypeScript. Port beam quantization only after separate profiles justify it.
5. **Choose protection based on value.** Use minification plus selective obfuscation for casual deterrence; server-side entitlements for licensing; and server-side premium rendering/content for algorithms or assets that must remain confidential. Do not justify WASM spending primarily as code protection.

Overall feasibility:

| Proposal | Feasible now? | Expected value | Recommendation |
|---|---:|---:|---|
| Entire React app → WASM | Only via rewrite/runtime embedding | Low/negative | Reject |
| Existing lilyjs JS → Javy/componentized JS | Technically packageable, poor browser fit | Low/negative | Reject |
| Existing lilyjs TS → Porffor | Not production-compatible today | Unknown | Watch only |
| Entire lilyjs → AssemblyScript/Rust | Large rewrite; DOM remains host-side | Unproven | Reject |
| Numeric layout kernel → AssemblyScript | Yes | Possibly moderate | Acceptable spike alternative |
| Numeric layout kernel → Rust + wasm-bindgen | Yes | Possibly moderate/high on long scores | Preferred spike after profiling |
| WASM as license/security boundary | No | False assurance | Reject |
| Server-rendered premium capability | Yes | High protection | Recommend when justified by product value |

## 6. Implementation plan if profiling supports it

### Phase 0 — measurements and corpus (about 2–4 engineering days)

- Work in the lilyJS source repository, not `packages/lilyjs/lilyjs.esm.js`.
- Add stage-level browser performance marks and a benchmark page/runner.
- Create golden inputs covering short, long, dense, beamed, polyphonic and slurred scores.
- Store current system breaks, note x positions, beam endpoints and rendered SVG snapshots.
- Record current p50/p95 and bundle/compressed sizes on target devices.
- Profile cold and warm renders; decide whether CPU, DOM, fonts or delivery is the actual problem.

**Exit:** identify a kernel responsible for enough total latency to pass the proposed gain threshold. If none exists, stop WASM work and optimize loading/DOM/TypeScript instead.

### Phase 1 — stabilize a language-neutral solver API (about 3–5 days)

- Refactor system packing, spring solving and their shared numeric helpers into a pure TypeScript module without DOM, font registry or arbitrary model objects.
- Define versioned packed inputs: measure/event offsets, durations, widths, reserves, collision boxes and options in typed arrays; define typed-array outputs.
- Keep conversion at one boundary per score/system, never per note.
- Add differential/property tests and explicit floating-point tolerances.
- Benchmark the refactored TypeScript baseline; this avoids crediting architectural cleanup to WASM.

**Exit:** deterministic parity and a coarse API that makes sense independently of WASM.

### Phase 2 — Rust/WASM spike (about 5–10 days)

- Create a small Rust crate in the lilyJS repository with `cdylib` output and `wasm-bindgen`/`wasm-pack` packaging.
- Port system DP and spring solving first. Use `f64` to preserve JavaScript number behavior; define handling for `NaN`, infinities, rounding and stable tie-breaking.
- Allocate/reuse input and output buffers; avoid serde/JSON on the hot path.
- Build optimized release artifacts, run `wasm-opt`, strip names/debug info, and measure compressed size. Binaryen options can trade size and speed and must be benchmarked ([Rust/WASM size guidance](https://rustwasm.github.io/book/print.html#shrinking-wasm-size)).
- Load it lazily with the Play-Along feature. Retain the TypeScript implementation as a fallback and as a differential oracle.
- Run identical warm/cold benchmarks in real browsers. Measure total stable-render time, not only the exported solver call.

**Exit:** ship only if parity, latency, reliability and payload gates pass. Otherwise delete/park the spike without changing production architecture.

### Phase 3 — production integration (about 3–6 days)

- Add a stable `LayoutKernel` interface with JS and WASM implementations.
- Initialize asynchronously before render or fall back immediately; do not leave a blank score on failure.
- Cache the WASM asset through the service worker with the same version as its glue code.
- Set the correct `application/wasm` MIME type and CSP; verify GitHub Pages deployment behavior.
- Add unit/differential tests, browser integration tests, performance budgets and telemetry that records implementation/fallback without score content.
- Document release/debug procedures and keep the ABI versioned.

### Phase 4 — optional beam port

- Re-profile after system/spacing changes.
- If beam scoring remains material, pack each beam group's positions, directions and collision rectangles and solve all groups in one WASM call.
- Preserve stable candidate ordering and compare endpoints/demerits with the TypeScript implementation.
- Do not port SVG beam polygon creation; return geometry to the existing renderer.

### Parallel protection work (independent of WASM)

- Define exactly which premium value must be protected: algorithm, catalog, export, or account entitlement.
- Add server-owned subscription state and short-lived authorization, then gate premium data/API calls server-side.
- For sensitive algorithms, prototype authenticated server rendering or pre-rendered catalog assets and measure latency/cost/offline impact.
- Keep production source maps private; evaluate selective obfuscation against bundle, runtime and support budgets.
- Threat-model account sharing, replay, scraping and offline grace explicitly. Document that displayed output can ultimately be captured.

## 7. Risks and open questions

- The source of truth is the sibling lilyJS repository; this checkout contains only a vendored release bundle and hand-maintained public types. Exact module boundaries and test fixtures must be changed upstream, then synced here.
- The current single large production chunk suggests code splitting/lazy loading may produce a larger user-perceived win than solver optimization.
- The embedded glyph/metadata contribution to bundle size has not been separated from executable code. Run a bundler/metafile or source-level build analysis upstream.
- Current target-browser/device requirements are not recorded here. They determine WASM baseline support, testing scope, worker strategy and offline behavior.
- Premium feature definitions and required offline guarantees are product decisions. They determine whether server-side execution is acceptable.
- Floating-point parity can affect line breaks and pixel snapshots near thresholds. Version golden outputs and specify tolerances before writing Rust.

## Sources

Primary project/tool documentation used in this analysis:

- [WebAssembly portability and host API model](https://webassembly.org/docs/portability/)
- [WebAssembly core specification](https://webassembly.github.io/spec/core/)
- [AssemblyScript documentation](https://www.assemblyscript.org/), [FAQ](https://www.assemblyscript.org/frequently-asked-questions.html), and [runtime](https://www.assemblyscript.org/runtime.html)
- [Rust and WebAssembly guide](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen guide](https://wasm-bindgen.github.io/wasm-bindgen/) and [string interop](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/string.html)
- [Bytecode Alliance Javy](https://github.com/bytecodealliance/javy)
- [Bytecode Alliance Jco/component tooling](https://github.com/bytecodealliance/jco)
- [Porffor project](https://github.com/CanadaHonk/porffor)

