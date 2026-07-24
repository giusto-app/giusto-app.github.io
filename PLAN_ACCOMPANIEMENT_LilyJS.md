# LilyJS Accompaniment Integration Plan

**Status:** proposed implementation plan  
**Date:** 2026-07-18  
**Target project:** LilyJS  
**Consumer:** Giusto Smart Accompaniment  
**Related architecture:** [`docs/SMART-ACCOMPANIMENT-ARCHITECTURE.md`](docs/SMART-ACCOMPANIMENT-ARCHITECTURE.md)

## 1. Objective

Redesign LilyJS’s existing `src/music-playback/` layer into the supported, deterministic, notation-neutral playback timeline that Giusto can use to build accompaniment plans, and add a reusable, deterministic arpeggiator to LilyJS’s domain-neutral `src/music-tools/` package.

LilyJS already contains `buildPlaybackTimelineFromScore`, tempo-map logic, repeat expansion, grace timing, pedal expansion, pitch conversion, scheduling, MIDI transport/export, and SVG playback binding. This plan therefore does **not** introduce a second `timeline` subsystem or a parallel `buildTimeline()` API. It extends and, where necessary, breaks the existing `PlaybackTimeline` API so there is one canonical parser-to-playback path.

There are no current external consumers that require compatibility. Prefer the correct long-term model over adapters, duplicated fields, deprecation aliases, or preservation of the current number/seconds-oriented shape.

LilyJS remains responsible for interpreting LilyPond notation. It must expose what the score means—timing, harmony, pitches, structure, and expression—but must not become responsible for Giusto-specific arranging, instrument selection, style generation, audio rendering, subscriptions, or model inference.

The intended boundary is:

```text
LilyPond source
      │
      ▼
LilyJS parser and semantic model
      │
      ▼
LilyJS PlaybackTimeline
      │
      ▼
LilyJS music-tools arpeggiator (optional)
      │
      ▼
ArpeggioPlan / Giusto PlaybackTimeline → AIR adapter
      │
      ▼
Giusto arranger → performance plan → audio renderer
```

`PlaybackTimeline`, the generic playback scheduler, and the reusable notation-neutral arpeggiator belong to LilyJS. The arpeggiator defines deterministic chord-tone ordering and exact note timing only. The Accompaniment IR (AIR), broader arranging decisions, style policies, instruments, and renderer contracts belong to Giusto or a Giusto-owned shared package.

## 2. Non-goals

LilyJS should not:


- choose cello, piano, orchestral, or genre-specific styles;
- synthesize audio or host neural models;
- depend on React, Web Audio, WebGPU, MIDI libraries, or Giusto application code;
- use MIDI as its canonical semantic model;
- expose engraving/SVG geometry as the accompaniment interface;
- flatten exact musical time into floating-point seconds prematurely;
- create a second semantic timeline alongside `src/music-playback/`;
- silently guess the meaning of unsupported LilyPond constructs.

## 3. Existing foundation to verify

The LilyJS bundle currently appears to contain much of the required source information:

- score parts and measures;
- rational note/rest/chord durations;
- chord symbols and chord-mode offsets;
- per-measure time signatures and expected durations;
- tempo marks and beat units;
- repeat and volta regions internally;
- structural events and rehearsal marks internally;
- note/chord pitches, ties, articulations, dynamics, beams, slurs, pedal, grace notes, tuplets, transposition, and relative pitch resolution;
- IDs connecting semantic events to rendered SVG elements.

The first task is an audit of `src/music-playback/` and its inputs. Determine which semantics already reach `buildPlaybackTimelineFromScore`, which are lost during score emission, and which merely lack fields or public exports. Then replace the existing `PlaybackTimeline` shape directly.

> **Audit done (2026-07-21):** `~/projects/lilyJS/doc/accompaniment-timeline-audit/PHASE0_AUDIT.md`
> verified this inventory field by field. Everything listed above is confirmed present,
> with three corrections: structural D.C./D.S./Segno/Coda events are **not** internal —
> they are absent end-to-end; repeat *counts* are not modeled; and rehearsal marks /
> expression exist in the model but are dropped before the timeline.

## 4. Proposed public API

### 4.1 Exact rational time

All canonical positions and durations should be expressed in exact quarter-note units (`QN`). Do not accumulate JavaScript floating-point beat values inside the semantic timeline.

```ts
export interface Rational {
  num: number
  den: number
}
```

Requirements:

- `den` is always positive;
- values are normalized by their greatest common divisor;
- `0` is represented consistently, preferably `{ num: 0, den: 1 }`;
- arithmetic uses overflow-safe helpers and reports unsupported values;
- JSON serialization is stable;
- conversion to `number` happens only at renderer, scheduler, or ML boundaries.

If normal JavaScript integers cannot safely represent supported scores, use a JSON-safe representation such as decimal strings at the serialized boundary while retaining ergonomic helpers in TypeScript.

### 4.2 Canonical playback entry point

```ts
export interface TimelineOptions {
  /** Preserve written structure or emit performed occurrences. */
  repeatMode: 'written' | 'expanded'

  /** How grace notes occupy or borrow timeline duration. */
  gracePolicy?: 'zero-time' | 'steal-from-following'

  /** Prevent malformed jump/repeat graphs from expanding forever. */
  maxStructureVisits?: number
}

export interface PlaybackTimeline {
  schemaVersion: 1
  scoreId: string
  revisionHash: string
  durationQN: Rational
  conductor: ConductorMap
  harmony: NormalizedHarmonyEvent[]
  parts: TimelinePart[]
  structure: StructureGraph
  diagnostics: Diagnostic[]
  sourceMap: Record<string, SourceSpan>
}

export function buildPlaybackTimelineFromScore(
  score: ScoreLike,
  options: TimelineOptions,
): PlaybackTimeline
```

This is a breaking redesign of the existing function and interface with the same names. Replace the old fields rather than adding a parallel result type. The builder must remain independent of SVG creation, font loading, page layout, DOM state, MIDI serialization, and any particular synthesizer.

The existing scheduler, MIDI file/transport adapters, and SVG binding should consume this canonical timeline through small projections. Seconds are derived from the conductor map at a scheduling boundary; MIDI bytes are derived at a MIDI boundary. Neither representation belongs in the canonical score semantics.

### 4.3 Incremental comparison

```ts
export interface TimelineDiff {
  fromRevision: string
  toRevision: string
  affectedRanges: QNRange[]
  addedIds: string[]
  removedIds: string[]
  changedIds: string[]
  structureChanged: boolean
  conductorChanged: boolean
}

export function diffPlaybackTimeline(
  previous: PlaybackTimeline,
  next: PlaybackTimeline,
): TimelineDiff
```

The initial implementation may compare complete immutable results. It does not need an incremental parser. The important contract is a deterministic description of which performed-time ranges must be replanned after an edit.

### 4.4 Generic arpeggiator entry point

The arpeggiator belongs in `src/music-tools/generators/arpeggiator/`. It is a
pure generator, not part of parsing and not part of canonical score playback.
It consumes the factual harmony/conductor view produced by `music-playback` and
returns a notation-neutral plan with exact QN timing.

```ts
export interface ArpeggiatorOptions {
  pattern: 'up' | 'down' | 'up-down' | 'down-up' | 'as-written'
  subdivisionQN: Rational
  octaveSpan: number
  range?: { lowMidi: number; highMidi: number }
  startOffsetQN?: Rational
  endOffsetQN?: Rational
}

export interface ArpeggioEvent {
  id: string
  sourceHarmonyId: string
  startQN: Rational
  durationQN: Rational
  midiNote: number
  pitchClass: number
  patternIndex: number
  cycleIndex: number
}

export interface ArpeggioPlan {
  schemaVersion: 1
  durationQN: Rational
  events: ArpeggioEvent[]
  diagnostics: Diagnostic[]
}

export function createArpeggioPlan(
  timeline: Pick<PlaybackTimeline, 'harmony' | 'conductor' | 'durationQN'>,
  options: ArpeggiatorOptions,
): ArpeggioPlan
```

Requirements:

- exact `Rational` QN arithmetic from input harmony through generated events;
- deterministic output and stable IDs for identical inputs/options;
- explicit patterns with no hidden randomness;
- chord tones derived from normalized intervals/pitch classes, never display labels;
- register/range placement that is deterministic and documented;
- exact clipping at chord changes and requested start/end bounds;
- `no-chord` spans generate silence; skip/continuation semantics preserve the active harmony as defined by the normalized harmony contract;
- repeat/volta behavior comes from performed `PlaybackTimeline.harmony`, never a second repeat interpreter;
- no MIDI scheduling, synthesis, rendering, instrument choice, genre/style policy, or Giusto imports;
- input timelines are never mutated.

The initial version does not need strumming, bass generation, humanization,
probability, groove templates, or automatic style selection. Those are separate
arranger/performance concerns.

## 5. Required data model

### 5.1 Conductor map

```ts
export interface ConductorMap {
  tempo: TempoSegment[]
  meter: MeterEvent[]
  key: KeyEvent[]
  bars: BarBoundary[]
  pickupQN?: Rational
}

export interface TempoSegment {
  id: string
  startQN: Rational
  endQN: Rational
  bpm: number
  beatUnit: Rational
  text?: string
}

export interface MeterEvent {
  id: string
  startQN: Rational
  numerator: number
  denominator: number
  beatGroups?: number[]
}

export interface BarBoundary {
  measureId: string
  occurrenceId?: string
  number: number
  startQN: Rational
  endQN: Rational
  expectedDurationQN: Rational
  actualDurationQN: Rational
  isPickup?: boolean
  sourceMeasureId: string
  passIndex?: number
}
```

Tempo segments must support deterministic conversion in both directions:

```ts
export function quarterNoteToSeconds(map: ConductorMap, at: Rational): number
export function secondsToQuarterNote(map: ConductorMap, seconds: number): Rational
```

For ramps, either implement an explicit ramp curve with tested integration/inversion or return a diagnostic that only step tempos are supported. Do not silently convert a ramp to an arbitrary step.

### 5.2 Normalized harmony

```ts
export interface NormalizedHarmonyEvent {
  id: string
  sourceMeasureId: string
  occurrenceId?: string
  startQN: Rational
  durationQN: Rational
  originalText: string
  root: SpelledPitchClass
  bass?: SpelledPitchClass
  quality: string
  intervals: number[]
  pitchClasses: number[]
  alterations: string[]
  omissions: string[]
  isNoChord?: boolean
}

export interface SpelledPitchClass {
  midiClass: number
  spelling: string
}
```

Harmony normalization must come from the parsed chord-mode AST, not from reparsing display strings in Giusto.

Chord duration rules must be deterministic:

1. The event starts at its exact chord-mode offset.
2. It ends at the next harmony event in performed time.
3. The final event ends at the defined harmony-track or score boundary.
4. Chord repetition/continuation syntax retains semantic provenance even if equal adjacent chords are later merged by Giusto.
5. Skips advance time without fabricating a chord.
6. “No chord” is represented explicitly rather than by omission when the source specifies it.
7. Repeat expansion produces occurrences with stable source-event references.

The supported quality vocabulary should cover at minimum:

- major, minor, augmented, diminished, half-diminished;
- dominant, major, and minor sevenths;
- suspended chords;
- extensions through thirteenths;
- additions, alterations, and omissions;
- inversions and slash bass notes;
- enharmonic spelling separate from pitch class.

Unknown qualities must retain an interval/pitch-class representation or emit a diagnostic. They must not be silently reduced to major/minor.

### 5.3 Parts, voices, and events

```ts
export interface TimelinePart {
  id: string
  name?: string
  instrument?: string
  transpositionSemitones?: number
  voices: TimelineVoice[]
}

export interface TimelineVoice {
  id: string
  staffId?: string
  events: TimelineEvent[]
}

export type TimelineEvent =
  | TimelineNote
  | TimelineChord
  | TimelineRest
  | TimelineDirection

export interface TimelineNote {
  type: 'note'
  id: string
  sourceEventId: string
  startQN: Rational
  durationQN: Rational
  writtenPitch: SpelledPitch
  soundingPitch: SoundingPitch
  tie?: TieMembership
  articulations: string[]
  dynamics: DynamicEvent[]
  slurIds: string[]
  isGrace: boolean
}

export interface SoundingPitch {
  midiNote: number
  cents?: number
}
```

Chord events should expose all pitches individually while retaining one parent event ID. Rests and skips must remain distinguishable if that distinction affects semantic timing. Tied notes should expose the original segments and an optional resolved sounding span.

### 5.4 Expression and directions

Expose semantic data needed by a downstream expression model:

- dynamics and dynamic changes;
- hairpin start/end and direction;
- articulations and ornaments;
- slur and phrasing-slur membership;
- ties;
- pedal events;
- fermatas;
- breath marks where supported;
- rehearsal marks and section labels;
- text directions with source positions;
- ottava and transposition effects;
- grace-note relationships.

LilyJS should not interpret these as audio controls. It should expose their notation meaning and exact locations.

### 5.5 Structure graph

```ts
export interface StructureGraph {
  writtenMeasureIds: string[]
  regions: StructureRegion[]
  edges: StructureEdge[]
  performedOccurrences?: MeasureOccurrence[]
}

export interface MeasureOccurrence {
  id: string
  sourceMeasureId: string
  passIndex: number
  startQN: Rational
  endQN: Rational
  path: string[]
}
```

The structure model must represent:

- ordinary sequential flow;
- repeat regions and counts;
- first/second and additional volta endings;
- nested repeats where supported;
- rehearsal/section marks;
- D.C., D.S., Segno, Coda, and Fine where supported;
- written-versus-performed order;
- source measure identity for every expanded occurrence;
- termination protection for malformed or cyclic navigation.

If a construct is parsed but not semantically expanded, return a structured diagnostic rather than a plausible but incorrect playback order.

### 5.6 Arpeggio plan semantics

The arpeggiator is a derived generator over the canonical timeline, not another
timeline implementation. Each generated event must retain the source harmony ID
that caused it, use a stable occurrence identity, and remain within both its
harmony span and the requested generation range. Chord changes may truncate the
last generated note but must never move the next chord's first attack. Empty,
invalid, unresolved, or no-chord harmony must produce explicit diagnostics or
silence according to the documented contract, never a guessed major/minor chord.

## 6. Stable identity and source mapping

Every public timeline object must have a stable ID and, where applicable, a source span.

Desired properties:

- rerendering produces identical IDs;
- font, viewport, engraving theme, or system breaks do not affect IDs;
- whitespace-only edits preserve IDs where source identity can be maintained;
- a local semantic edit does not renumber unrelated later events merely because an array index changed;
- repeat occurrences have distinct occurrence IDs but retain the same source-event or source-measure ID;
- diagnostics reference exact source ranges;
- renderer event IDs may map to semantic IDs, but semantic identity must not depend on SVG output.

If fully stable edit-preserving IDs are not immediately feasible, document the stability level and use `revisionHash` plus explicit source/occurrence IDs so Giusto can safely invalidate more data rather than reuse the wrong data.

## 7. Diagnostics and validation

```ts
export interface Diagnostic {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  source?: SourceSpan
  eventId?: string
  recoverable: boolean
}
```

Required diagnostic categories include:

- unsupported syntax or command;
- ambiguous/unresolved variable or context;
- malformed measure duration;
- conflicting simultaneous conductor events;
- unresolved chord quality;
- uncovered or overlapping harmony spans;
- invalid repeat/jump graph;
- expansion visit limit reached;
- unsafe rational/integer range;
- inconsistent tie, slur, or pedal endpoints;
- unsupported tempo ramps or grace timing policy.

`buildPlaybackTimelineFromScore` may return a partial result with warnings only when its contract explicitly defines the recovery. Errors that could change harmony, pitch, performed order, or timing should prevent accompaniment generation unless the caller opts into a documented fallback.

## 8. Testing strategy

### 8.1 Unit tests

- Rational normalization, comparison, arithmetic, and conversion.
- Chord AST normalization and pitch-class derivation.
- Tempo beat-unit and dotted-unit conversion.
- Meter inheritance and compound/additive beat grouping.
- Measure actual/expected duration calculation.
- Structure traversal, volta choice, and visit limits.
- Stable IDs and source mapping.
- Timeline diff affected ranges.
- Arpeggiator pattern order, octave cycling, range placement, clipping, stable IDs, and no-chord silence.

### 8.2 Golden LilyPond fixtures

Create small, single-purpose fixtures for:

- pickup/anacrusis;
- dotted durations;
- nested tuplets;
- grace and after-grace notes;
- ties across bars and repeats;
- simultaneous voices and chords;
- relative, absolute, fixed, and transposed pitches;
- changing key, meter, and tempo;
- dotted-quarter tempo in 6/8;
- chord changes on offbeats;
- chord skips and repeated chords;
- extensions, alterations, omissions, inversions, and enharmonic roots;
- simple repeat;
- first/second endings;
- nested repeats;
- D.C./D.S./Coda/Fine where supported;
- rehearsal marks and section labels;
- slurs, articulations, dynamics, hairpins, pedal, ornaments, and fermatas;
- multiple score blocks and parts;
- malformed/unsupported constructs with expected diagnostics.

Each fixture should assert semantic JSON, not rendered SVG.

### 8.3 Integration fixtures

At minimum, assert the complete timeline for Giusto’s:

```text
public/exercises/practice-arpeggios-Gm-Cm-F-Bb.ly
```

Expected properties include:

- performed harmony is G minor → C minor → F major → B-flat major;
- every chord has an exact start and end in QN;
- chord spelling retains `bf`/B-flat semantics;
- the score duration and measure boundaries are exact;
- melody/arpeggio notes have absolute sounding pitches;
- repeated equal harmony events preserve source provenance;
- the result is independent of engraving width and font readiness.

### 8.4 Property/invariant tests

- Every non-grace event has non-negative start and positive duration.
- Events are within the timeline duration.
- Events in one monophonic voice do not overlap unless LilyPond semantics allow it.
- Every bar’s actual duration matches expected duration unless explicitly marked pickup/cadenza/partial.
- Expanded measure occurrence times are monotonic.
- Structure expansion terminates.
- Harmony events are sorted and have deterministic duration.
- QN → seconds → QN round-trips within a documented tolerance.
- Building the same score twice produces structurally identical results and IDs.
- Arpeggio events are ordered, non-overlapping for the initial monophonic contract, and contained by their source harmony spans.
- Building an arpeggio plan twice from identical inputs/options produces byte-identical semantic JSON and IDs.

### 8.5 Performance tests

Benchmark `buildPlaybackTimelineFromScore` separately from parsing, scheduling, MIDI conversion, synthesis, and engraving for:

- the bundled short arpeggio exercise;
- a 32-bar dense polyphonic score;
- a 128-bar score with tempo/meter changes;
- a repeat/volta-heavy score;
- an orchestral score with many parts.

Suggested initial gate: warm p95 timeline construction below 20 ms for a typical 128-bar single-part accompaniment score on a representative desktop, and below 40 ms on a representative mobile device. Treat these as product targets, not assumed current performance.

## 9. Implementation phases and task checklist

### Phase 0 — API audit and decisions

> **Audit complete (2026-07-21):** gap matrix, module verdicts, recorded decisions, and
> four pre-existing defects are in
> `~/projects/lilyJS/doc/accompaniment-timeline-audit/PHASE0_AUDIT.md`.
> Headline findings: `music-model` already carries exact `Rational` durations and a full
> structured `HarmonyTrack` (most of §5.2) that playback flattens/ignores; event IDs are
> rebuild-stable but not edit-stable; seconds + velocity are baked into the canonical
> shape; `beatUnitDots` is parsed but ignored by the tempo map; repeat counts and
> D.C./D.S. are absent from the model. Two sign-offs remain below.

- [x] Audit `src/music-playback/types.ts`, `timeline.ts`, `tempoMap.ts`, `scheduler.ts`, `graceTiming.ts`, `pedals.ts`, repeat helpers, MIDI adapters, synth boundary, and SVG binding.
- [x] Trace the score-model and LilyPond-emitter inputs used by `buildPlaybackTimelineFromScore`.
- [x] Inventory every existing field needed by the redesigned `PlaybackTimeline`.
- [x] Record whether each field is parsed, normalized, emitted, publicly typed, serialized, and tested.
- [x] Approve `PlaybackTimeline` as the single derived, immutable, notation-neutral playback view. *(approved 2026-07-21, audit §6.1)*
- [x] Identify current seconds-, MIDI-, and synthesizer-specific fields to remove from the canonical timeline and move into adapters.
- [x] Choose the exact rational representation and JSON encoding. *(reuse `music-model/rational.ts` `{num, den}`, QN unit at the timeline boundary — audit §6.2)*
- [x] Define the supported LilyPond subset for accompaniment timelines. *(audit §6.5)*
- [x] Define error-versus-warning behavior for unsupported constructs. *(audit §6.6)*
- [x] Confirm that no Giusto-specific imports will enter LilyJS. *(enforced by `tests/music-playback/boundary.test.ts`; forbidden list to be extended)*
- [x] Approve the breaking replacement API without compatibility aliases or a second timeline implementation. *(approved 2026-07-21, audit §6.8)*

**Exit criterion:** approved replacement `PlaybackTimeline` API and a gap matrix mapping existing `src/music-playback/` fields and score inputs to required fields.

### Phase 1 — exact time and conductor map

> **Substantially complete (2026-07-21).** The builder runs on exact `Rational` QN end
> to end (`rawEvents.ts` cursor → `structure.ts` repeat expansion → conductor map in
> `conductorMap.ts`); `tempoRegions` left the canonical timeline (float `TempoRegion` is
> a projection in `tempoMap.ts`; scheduler/MIDI/viewer consume the conductor). Still
> open below: skip/direction events (Phase 3), the cadenza diagnostic, and the event
> `sourceMap`. Stamped seconds and pitch velocity intentionally remain on events until
> the Phase 7 projection refactor and Phase 3 dynamics exposure.

- [x] Implement normalized rational helpers with unit and property tests. *(done 2026-07-21: `add/subtract/compare/divide/toNumber`, `RATIONAL_ZERO`, `isSafeRational` guard, −0 canonicalization in `music-model/rational.ts`; unit + seeded property tests in `tests/music-model/rational.test.ts`)*
- [x] Replace number-based canonical QN offsets/durations in `PlaybackTimeline` with exact rational values. *(done 2026-07-21: `PlaybackEvent.startQN/durationQN`, pedal `offsetQN`, and `PlaybackTimeline.durationQN` are `Rational`; stamped `startSec`/`durationSec` floats remain as a derived convenience until the Phase 7 projection refactor)*
- [x] Refactor the existing global QN cursor construction across measures, parts, and voices. *(done 2026-07-21: exact cursor in `src/music-playback/rawEvents.ts`; audit §7.4 CONFIRMED and fixed — embedded `<< \\ >>` islands were played sequentially, now island-anchored via group-relative `voiceOffsetQN`, with regression fixtures)*
- [ ] Emit exact start and duration for notes, chords, rests, skips, and directions. *(notes/chords/rests exact 2026-07-21; skip-vs-rest distinction and directions-as-events ride Phase 3)*
- [ ] Resolve pickups, partial measures, tuplets, dots, ties, grace notes, and cadenzas under explicit policies. *(all but cadenzas now EXACT with fixtures — nested tuplets land on the true 2/15-QN grid; cadenza diagnostic still open)*
- [x] Emit inherited time signatures and expected/actual measure durations. *(done 2026-07-21: `ConductorMap.meter` change events + `BarBoundary.expectedDurationQN`/`actualDurationQN` per performed bar, `src/music-playback/conductorMap.ts`)*
- [x] Emit normalized tempo events including beat unit and dots. *(done 2026-07-21: `TempoSegment` carries written `bpm`, `beatUnit` as an exact QN Rational (dots folded in — dotted quarter = 3/2), `text`, and `startQN`/`endQN`; §7.1 dots bug fixed)*
- [x] Implement piecewise QN-to-seconds and seconds-to-QN conversion. *(done 2026-07-21: `quarterNoteToSeconds` + `secondsToQuarterNote` over `ConductorMap` — inverse snaps to the documented 1/960-QN grid, round-trip tested)*
- [x] Emit key events, bar boundaries, measure IDs, and source spans. *(completed 2026-07-21 — the event `sourceMap` landed with Phase 3)*
- [x] Add conductor-map and exact-time golden fixtures. *(done 2026-07-21: `tests/music-playback/conductorMap.test.ts` — bars/pickup/repeat passes/meter/key/tempo text + conversions; exact triplet, nested-tuplet, and island fixtures in `timeline.test.ts`)*

**Exit criterion:** exact, deterministic written-order timelines pass all duration, meter, and tempo fixtures without floating-point accumulation.

### Phase 2 — normalized harmony

> **Complete (2026-07-21)** up to two deliberate deferrals. The model layer
> (`music-model/harmony.ts`) carries `ChordDescriptor`/`SpelledPitchClass`/
> `HarmonyKind`/`HarmonyTrack` with exact `Rational` offsets/durations; the timeline now
> surfaces it as `PlaybackTimeline.harmony` (`NormalizedHarmonyEvent[]` in
> `src/music-playback/normalizeHarmony.ts`) with stable `harmony-<n>` ids, exact QN
> starts/durations, materialized `intervals`/`pitchClasses`, and a
> `PlaybackTimeline.diagnostics` channel. Landed alongside: a parser fix recovering
> main-step alterations (`c:7+` = maj7, `c:m7+` = minor-major — the `+` was dropped).
> Deferred by design: performed-order (repeat-expanded) harmony occurrences ride the
> Phase 4 structure pass; packaged-entry export rides Phase 7.

- [x] Publish the chord-mode semantic AST or a stable normalized derivative. *(the `HarmonyTrack` on `Score` is that derivative; supported-entry export lands in Phase 7)*
- [x] Normalize root and bass spelling separately from pitch class. *(`SpelledPitchClass` letter/alteration/pitchClass; tested incl. enharmonics)*
- [x] Define the canonical chord-quality vocabulary. *(15-value `ChordQuality` incl. half-diminished, sus, power, `other`; tested)*
- [x] Emit intervals, pitch classes, alterations, omissions, inversions, and original display text. *(done 2026-07-21: `chordDescriptorIntervals`/`chordDescriptorPitchClasses` in `music-model/harmony.ts` — LilyPond chord-step semantics incl. minor-default 7th, degree-replacement alterations, extension stacking, dedup; reference literals from the LilyPond NR chord table in `tests/music-model/harmonyIntervals.test.ts`)*
- [x] Compute exact harmony start and duration without Giusto reparsing labels. *(exact whole-note `Rational` offset+duration per slot; timeline events convert ×4 to exact QN)*
- [x] Preserve repeated-chord, continuation, skip, and no-chord semantics. *(`HarmonyKind` explicit/continuation/skip/no-chord; both continuation forms tested; timeline keeps every slot with kind provenance, `isNoChord`, and chord `null` for skip/no-chord)*
- [x] Emit diagnostics for unsupported or ambiguous chord forms. *(done 2026-07-21: `Diagnostic` type in `music-model/diagnostic.ts`; `unresolved-chord-quality` warning keeps the structural chord with `intervals: null` instead of guessing; `overlapping-harmony-spans` error guard)*
- [x] Add comprehensive harmony fixtures and Giusto Gm–Cm–F–Bb integration assertions. *(done 2026-07-21: `tests/music-playback/normalizeHarmony.test.ts` asserts the Gm–Cm–F–B♭ progression at timeline level — exact QN starts/ends, `bf` spelling retained, pitch classes, kinds, mid-bar offsets; the complete-timeline §8.3 integration incl. melody + performed order completes with Phase 4)*

**Exit criterion:** Giusto can construct its chord schedule solely from LilyJS structured harmony without parsing a chord display string.

### Phase 3 — pitches, voices, and expression

> **Complete (2026-07-21).** Events carry written spelling beside sounding MIDI
> (`PlaybackPitch.spelling`), real `partId`/`voiceId`/`staffId`, articulations,
> tie segments, and grace anchors; `PlaybackTimeline.expression` exposes dynamics,
> hairpins (open hairpins extend to the next dynamic, LilyPond semantics), slurs,
> ottavas, and rehearsal marks at exact performed positions per occurrence; a
> `sourceMap` links event ids to source spans. Velocity left the canonical shape —
> `computeEventVelocities` derives it from expression data at the scheduler/MIDI
> boundary. Known parser gaps (out of playback scope): `-.`/`->` shorthand
> articulations are dropped (longhand works); phrasing slurs fold into slurs;
> breath marks and text directions unparsed.

- [x] Emit absolute sounding pitch and written spelling after relative/fixed/transpose resolution.
- [x] Preserve part, staff, and voice identity. *(`partId`/`voiceId`/`staffId` on events + `TimelinePartInfo[]` descriptors)*
- [x] Emit chord child pitches under a stable parent event. *(per-pitch spelling under one parent id)*
- [x] Model tie segments and optional resolved sounding spans. *(head keeps merged duration + contiguous written `tieSegments`)*
- [x] Expose articulations, ornaments, dynamics, hairpins, slurs, phrasing slurs, pedal, fermatas, and supported directions. *(all as data; phrasing slurs not distinguished by the parser; directions/breath marks diagnosed as unparsed)*
- [x] Associate expression events with exact locations and source spans. *(exact QN per occurrence + `sourceMap` via anchor ids)*
- [x] Define semantic handling for grace-note relationships and ottava changes. *(`graceAnchorEventId`; ottava spans exposed, pitches documented as already sounding)*
- [x] Add polyphonic, transposing, tied, articulated, and expression-heavy fixtures. *(`tests/music-playback/expressionTimeline.test.ts`)*

**Exit criterion:** a downstream system can derive renderer-neutral performance input without reading LilyPond text or SVG attributes.

> **Descope note (2026-07-21):** per the product goal — give Giusto enough data for
> practice/backing-track playback — the remaining phases are re-prioritized. The
> shortest path to user value is: a minimal Phase 7 slice (export the playback API
> from the supported package entry) → Phase 6 (the arpeggiator, the actual product
> feature) → the Giusto-side adapter. Phase 4 beyond what already ships (simple
> repeats/voltas expand correctly), Phase 5 (diff/revision-hash/JSON Schema), and the
> remaining conductor formalism are DEFERRED until a real Giusto need surfaces.

### Phase 4 — structure and performed order

> Existing foundation (audit §3.6): the current builder already expands simple repeats,
> numbered voltas, and percent repeats deterministically with per-event
> `occurrenceIndex`, all tested. Known gaps: repeat *counts* are not in the model
> (`\repeat volta 3` without alternatives plays 2× — audit §7.2), nested repeats
> silently mis-pair (audit §7.3), and D.C./D.S./Segno/Coda/Fine are absent from parser,
> model, and playback alike.

- [ ] Publish a documented `StructureGraph` representation.
- [ ] Implement written-order structure output. *(builder always expands; `repeatMode: 'written'` missing)*
- [ ] Implement deterministic simple-repeat expansion with occurrence provenance. *(implemented + tested at event level; `MeasureOccurrence` records/paths and harmony-track expansion missing)*
- [ ] Implement volta/alternative endings. *(implemented + tested for numbered brackets; count model gap §7.2, unparsable labels fall back silently)*
- [ ] Implement nested-repeat behavior for the supported subset. *(currently silently wrong — needs at least a diagnostic in Phase 1)*
- [ ] Implement D.C./D.S./Segno/Coda/Fine navigation where supported. *(absent end-to-end)*
- [ ] Add a configurable traversal/visit limit and cycle diagnostics.
- [ ] Preserve source measure/event IDs across all occurrences. *(event ids already survive expansion with `occurrenceIndex`; measure-level provenance missing)*
- [ ] Map rehearsal marks and section labels into written and performed time.
- [ ] Add repeat, volta, jump, malformed-cycle, and source-provenance fixtures. *(repeat/volta/percent fixtures exist for the current float shape)*

**Exit criterion:** Giusto can loop or render performed form without independently interpreting LilyPond repeat syntax.

### Phase 5 — identity, diffs, and serialization

> Existing foundation (audit §3.7): ids are minted in parser order
> (`event-${parsedIndex}`) — already layout/font-independent and rebuild-stable, but
> index-based so **not** edit-stable; the audit's approved fallback is `revisionHash`
> invalidation. The current `PlaybackTimeline` is already plain JSON data; it just has no
> version, hash, schema, or diff.

- [ ] Define semantic ID generation independently of engraving layout. *(already layout-independent; document the edit-stability level per §6)*
- [ ] Test ID stability across repeat builds, rerenders, whitespace edits, and localized semantic edits.
- [ ] Implement `revisionHash` using canonical semantic input or output.
- [ ] Implement versioned, deterministic `PlaybackTimeline` serialization.
- [ ] Implement `diffPlaybackTimeline` with conservative affected QN ranges.
- [ ] Document the new schema; no legacy compatibility or deprecation layer is required.
- [ ] Add JSON Schema or an equivalent machine-readable validation artifact.
- [ ] Add round-trip, snapshot, and diff tests.

**Exit criterion:** Giusto can cache plans by revision and invalidate affected ranges without risking stale musical data.

### Phase 6 — generic arpeggiator

> **Shipped (2026-07-24).** `src/music-tools/generators/arpeggiator/` (`types.ts`,
> `pitchRange.ts`, `pattern.ts`, `createArpeggioPlan.ts`, `index.ts`) is a pure generator
> with only a type-only dependency on `music-playback` (no runtime coupling) and reuses
> `chordDescriptorIntervals`/`chordDescriptorPitchClasses` from `music-model`. Exported
> from the `music-tools` entry (`src/music-tools.ts`). 30 tests in
> `tests/music-tools/arpeggiator/` (unit + invariant + determinism + Gm–Cm–F–B♭
> integration); full suite green (2670 pass). One deferral: the standalone 128-bar
> benchmark (last item) — determinism-at-scale is covered, a timed gate is not, to avoid
> a flaky assertion; add when a real perf need surfaces.

- [x] Create `src/music-tools/generators/arpeggiator/` with no parser, renderer, DOM, MIDI, Web Audio, or Giusto dependencies.
- [x] Define `ArpeggiatorOptions`, `ArpeggioEvent`, `ArpeggioPlan`, and `createArpeggioPlan`.
- [x] Implement `up`, `down`, `up-down`, `down-up`, and `as-written` chord-tone traversal. *(`up-down`/`down-up` exclude turnaround endpoints so a repeated cycle never doubles the top/bottom note; `as-written` keeps the chord voicing order while `up`/`down` re-sort.)*
- [x] Implement deterministic octave expansion and MIDI register/range placement. *(root anchored at the lowest MIDI ≥ `lowMidi` matching its pitch class — default C3 = 48; octave-major expansion; MIDI-dedup; optional `[lowMidi, highMidi]` clip.)*
- [x] Generate exact-QN subdivisions and clip notes exactly at harmony changes and requested bounds. *(per-chord grid anchored at each chord onset clamped to the window; last note clipped at chord/window end; a chord change truncates the previous note but never moves the next attack.)*
- [x] Preserve source harmony/occurrence IDs on every generated event. *(`sourceHarmonyId` + stable `arp:<harmonyId>:<k>` ids; occurrence identity rides Phase 4 performed-order harmony.)*
- [x] Treat continuations, skips, and no-chord spans according to the normalized harmony contract. *(continuation carries the active chord → generates; skip / no-chord → silence, no diagnostic; unresolved chord → info diagnostic + silence, never a guessed triad.)*
- [x] Consume performed harmony directly so repeats/voltas are not reinterpreted. *(reads `timeline.harmony` as-is; no second repeat interpreter — performed-order expansion of the harmony track itself still rides Phase 4.)*
- [x] Export the generator from the supported `music-tools` entry point.
- [x] Add unit, invariant, serialization, and Gm–Cm–F–B-flat integration tests. *(serialization asserted via byte-identical JSON determinism.)*
- [ ] Benchmark a 128-bar harmony track separately from parsing, timeline construction, scheduling, and rendering. *(deferred — see note above.)*

**Exit criterion:** LilyJS can deterministically generate an exact-QN, renderer-neutral arpeggio plan from `PlaybackTimeline.harmony`; Giusto can choose whether and how to orchestrate that plan without parsing chord labels or reimplementing chord-tone ordering.

### Phase 7 — public API, integration, and release

> Existing foundation (audit §1, §5): the packaged entry `src/lilyjs.ts` currently
> exports **only** the SVG playback binding — the timeline builder, scheduler, tempo
> map, and MIDI exports are internal (`music-playback/index.ts` re-exports them, but the
> bundle entry does not). The CLI already consumes
> `buildPlaybackTimelineFromScore` + `timelineToMidiFile` for `--midi=` sidecar export.

- [x] Export the redesigned playback types and functions from LilyJS’s supported package entry point. *(done 2026-07-24: `src/lilyjs.ts` now re-exports the whole `music-playback` surface + `createArpeggioPlan` + Rational/harmony types; verified present in `dist/lilyjs.esm.js`.)*
- [ ] Generate TypeScript declarations upstream instead of hand-maintaining the full API in Giusto.
- [ ] Document `buildPlaybackTimelineFromScore`, `diffPlaybackTimeline`, rational units, repeat modes, diagnostics, and examples.
- [ ] Add a minimal LilyPond-to-timeline example that does not require a DOM. *(the CLI `--midi` path is close: parse → timeline → SMF, no DOM)*
- [ ] Add a Giusto adapter contract test against the packaged LilyJS build.
- [ ] Benchmark parse, timeline, engraving, and total operations separately.
- [ ] Refactor `createPlaybackScheduler` to derive seconds from the timeline conductor map at scheduling time. *(currently reads `event.startSec` baked into the timeline)*
- [ ] Refactor MIDI transport/file export to project events from `PlaybackTimeline` rather than defining its shape. *(`midiFile.ts` already projects from the timeline; it must re-derive ticks/seconds once they leave the canonical shape)*
- [ ] Refactor pedal, grace, repeat, and active-event scheduling to use exact canonical positions.
- [ ] Refactor SVG playback binding to consume scheduled active-event IDs without owning timeline semantics. *(already true — `svgBinding.ts` is id-based and DOM-neutral)*
- [ ] Verify parsing and rendering do not regress; update playback tests to the new breaking contract.
- [x] Version the LilyJS release and update the vendored package through the normal sync script. *(done 2026-07-24: lilyJS tagged `v0.4.0` locally; `scripts/sync-lilyjs.sh` refreshed `packages/lilyjs/lilyjs.esm.js` + `upstream.json`; hand-maintained `index.d.ts` extended with the timeline/harmony/arpeggio surface. Declarations are still hand-maintained upstream-generation remains open.)*
- [ ] Delete redundant accompaniment/playback declarations from Giusto once generated LilyJS types ship.
- [ ] Record migration notes and known unsupported notation cases.

**Exit criterion:** a released LilyJS package produces the tested canonical `PlaybackTimeline`; the LilyJS scheduler and MIDI/SVG adapters consume it, and Giusto consumes it without internal bundle access or chord-label reparsing.

## 10. Suggested repository organization

Exact directories should follow LilyJS’s current conventions, but the logical separation should resemble:

```text
src/
  music-model/
    rational.ts
    timelineTypes.ts
    harmonyTypes.ts
    structureTypes.ts
  music-input/lilypond/
    ...existing parser and semantic phases...
  music-playback/
    types.ts                 # canonical PlaybackTimeline and event types
    timeline.ts              # buildPlaybackTimelineFromScore
    tempoMap.ts              # conductor map and QN/seconds projections
    normalizeHarmony.ts
    structure.ts             # repeats, voltas, jumps and occurrences
    graceTiming.ts
    pedals.ts
    semanticIds.ts
    diffTimeline.ts
    validateTimeline.ts
    scheduler.ts             # generic real-time projection/transport
    midi.ts                  # optional MIDI projection
    midiFile.ts              # optional SMF projection
    midiTransport.ts         # optional MIDI transport
    svgBinding.ts            # semantic event ID → rendered element binding
  music-tools/
    generators/
      arpeggiator/
        types.ts             # ArpeggiatorOptions, ArpeggioEvent, ArpeggioPlan
        createArpeggioPlan.ts
        pitchRange.ts        # deterministic octave/register placement
        index.ts
test/
  music-playback/
  music-tools/arpeggiator/
  fixtures/music-playback/
```

Extend the existing upstream modules rather than creating a new top-level `timeline/` directory. Shared score-model types may remain under `music-model/`, parser-to-playback assembly and its semantic helpers belong under `src/music-playback/`, and derived reusable generators belong under `src/music-tools/generators/`. The arpeggiator must not be placed in `music-playback`, because generated accompaniment is a transformation/generation policy rather than a factual interpretation of the source score.

Avoid implementing this feature directly in the vendored `packages/lilyjs/lilyjs.esm.js` inside Giusto. That file is a generated/synced artifact. Changes belong in the upstream LilyJS TypeScript source and should flow into Giusto through its existing synchronization/release process.

## 11. Definition of done

The LilyJS portion is complete when:

- [ ] `buildPlaybackTimelineFromScore` is the only canonical parser/model-to-playback builder and is public, typed, documented, DOM-independent, and versioned.
- [ ] All canonical musical positions and durations use exact rational QN values.
- [ ] Harmony is structured and duration-complete; Giusto does not parse display labels.
- [ ] Tempo, meter, key, bar, pickup, and section maps are deterministic.
- [ ] Written and performed repeat structures are both available with source provenance.
- [ ] Notes expose absolute sounding pitch, written spelling, voice, ties, and expression semantics.
- [ ] Stable IDs, source maps, diagnostics, serialization, and conservative diffs are tested.
- [ ] Golden and invariant suites cover the supported LilyPond subset.
- [ ] The bundled Giusto arpeggio exercise produces the expected exact timeline.
- [ ] `createArpeggioPlan` produces deterministic exact-QN chord-tone patterns from normalized performed harmony, with stable IDs and no-chord silence.
- [ ] The arpeggiator is exported from `music-tools` and remains independent of parsing, rendering, MIDI scheduling, audio, and Giusto.
- [ ] Existing parsing and engraving behavior has no unintended regressions; playback API/tests are deliberately migrated to the new breaking contract.
- [ ] Scheduler, MIDI export/transport, synth boundary, and SVG binding are projections/consumers of the same canonical `PlaybackTimeline`.
- [ ] No parallel `TimelineResult`, `buildTimeline`, or top-level `timeline/` subsystem exists.
- [ ] Generated package declarations replace accompaniment-related hand-maintained Giusto declarations.
- [ ] Unsupported constructs are explicitly diagnosed rather than silently misinterpreted.

## 12. Recommended first pull request

Keep the first change intentionally small:

1. Replace the existing `PlaybackTimeline` types with the approved exact, semantic shape.
2. Refactor `buildPlaybackTimelineFromScore` to produce exact measure boundaries, notes/rests, time signatures, step tempos, and structured chord-mode events.
3. Update the existing tempo, scheduler, MIDI, pedal, grace, repeat, and SVG-binding tests/consumers to use the new canonical timeline.
4. Add semantic JSON fixtures for the Giusto Gm–Cm–F–Bb exercise plus pickup, mid-bar chord, tuplet, and dotted-quarter tempo cases.
5. Document unsupported repeat expansion and advanced expression as structured follow-up work.

This first slice proves the architectural boundary, consolidates existing LilyJS playback work, and removes chord-label/timing reconstruction from Giusto without coupling the initial pull request to the entire LilyPond structure language.

The arpeggiator should land as a later focused change after normalized performed
harmony is available on `PlaybackTimeline`; it should not be folded into the
first timeline replacement pull request.
