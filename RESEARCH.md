# Giusto — Research Notes

---

## Violin Intonation Pedagogy

### What Top Pedagogues Agree On

Research into the major violin teaching traditions (Galamian, Flesch, Fischer, Suzuki, Rolland) reveals a strong consensus on what develops intonation:

**1. The ear is primary (Galamian)**
Ivan Galamian (*Principles of Violin Playing and Teaching*, 1962) places the ear at the absolute center: "The most important part in all of this is assigned, obviously, to the ear, which has to catch immediately the slightest discrepancy between the pitch desired and the pitch produced." He calls this "mind-to-muscle control" — the student must *hear* the target pitch internally before placing the finger.

**2. Drone practice is the most proven exercise**
A sustained drone pitch allows the ear to detect acoustic "beating" — the wavering interference between two close-but-not-identical pitches. Eliminating beats means the notes are in tune. Used by all major pedagogical traditions.

**3. Sympathetic resonance is the violin's built-in feedback**
When a stopped note matches an overtone of an open string, the open string vibrates sympathetically, producing an audible "ring." Teachers describe this resonant spot as "only the size of a pencil point." Training to find this ring builds exceptional precision — no technology required. Key resonance points: G3, G4, D4, D5, A4, A5, E4, E5 (and their octaves).

**4. Left-hand frame stability (Fischer)**
Simon Fischer (*Basics*, *Scales*) developed the most systematic modern approach: held-down finger lines, scale degrees practiced in isolation (1st, 4th, 5th before adding others), and 20 preparatory exercises before combining double-stop scales. The spacing between all four fingers — the "frame" — must be consistent.

**5. Ear training and muscle memory are interdependent**
NAfME research confirms: "Training helps musicians develop muscle memory for how different intervals 'feel' when sung or played." The two must develop together. Isolating ear training from physical practice produces incomplete skill.

**6. Speed before accuracy is the enemy**
At tempo, incorrect note placements are reinforced through repetition. Muscle memory of the wrong position is formed. Deliberate slow practice — at a speed where every note can be consciously monitored — is essential (Flesch, Fischer, Rolland).

---

## Peer-Reviewed Research on Real-Time Feedback

### Zabanal (2019) — Drone Practice Works
*Journal of String Research* study of middle and high school violin/viola students showed measurable intonation improvement from short-term tonic drone practice.
Source: [ResearchGate](https://www.researchgate.net/publication/334006690_Effects_of_Short-Term_Practice_With_a_Tonic_Drone_Accompaniment_on_Middle_and_High_School_Violin_and_Viola_Intonation)

### Frontiers in Psychology (2019) — Real-Time Visual/Aural Feedback Study
12 beginner violinists (ages 8–11), four conditions: aural feedback, visual feedback, both, control. Key findings:
- No statistically significant difference in mean absolute intonation error between conditions (17–19¢ across groups)
- **7 of 12 preferred aural feedback** for real-time use
- **8 of 12 said combined would be most useful** for independent practice
- Visual feedback competed with score-reading attention
- Conclusion: "Both methods demonstrate potential for assisting self-reflection during individual practice"
Source: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6455216/)

### Frontiers in Psychology (2021) — Beginners Benefit Most from Visual Feedback
47 participants with no prior music experience. Both visual and auditory feedback groups improved pitch matching. **Beginners benefit more from visual real-time feedback** than advanced musicians.
Source: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8297736/)

### Pedagogical Literature Analysis (2022)
Comprehensive review of violin/viola pedagogy confirmed that ear training, drone practice, sympathetic resonance, and systematic scale work are the consensus pillars across all major traditions.
Source: [ResearchGate](https://www.researchgate.net/publication/363282826_An_Analysis-Synthesis_of_the_Pedagogical_Literature_on_Intonation_in_Initial_Learning_of_Violin_and_Viola_Pitch_Contents_Teaching_Approaches_and_Auxiliary_Resources)

---

## Competitive Analysis

### Intonia (iOS/Android/Windows)
- Continuous scrolling pitch trace (pitch + amplitude over time)
- Tuning systems: Equal, Just, Pythagorean
- Records audio + pitch data for post-session review — shows vibrato, slides, articulations
- Up to 60 minutes storage, iCloud sync
- **Gap**: No session history or progress tracking; no drone; no structured exercises

### TonalEnergy (iOS/Android)
- "Smiley face" in-tune indicator — simple intuitive feedback
- Spectral graph showing overtone series
- Built-in drone generator with transposition
- Tuning systems: Just and Equal
- **Gap**: No progress tracking; no structured practice sessions; limited temperament selection

### Intunator (iOS)
- Plays back the correct pitch after detection — trains by aural imitation
- Drone mode in user-selected pitch
- 56 instrument profiles, adjustable concert pitch (400–499 Hz)
- Tuning: Equal and Just
- **Gap**: No progress tracking; no session history

### Violy (iOS)
- Sheet music integration with real-time intonation detection during performance
- Note-by-note error identification
- **Gap**: Requires sheet music; no standalone ear training; no drone; limited temperament support

### Gap Analysis — What No App Currently Provides
| Feature | Intonia | TonalEnergy | Intunator | Violy | Giusto |
|---|---|---|---|---|---|
| Session history / progress over time | — | — | — | — | ✅ |
| Multiple temperaments | ✅ | partial | partial | — | ✅ |
| Contextual temperament guidance | — | — | — | — | planned |
| Drone generator | — | ✅ | ✅ | — | planned |
| Sympathetic resonance coaching | — | — | — | — | planned |
| Adjustable concert pitch | ✅ | — | ✅ | — | ✅ |
| Scale-specific practice | — | — | — | partial | ✅ |
| Structured session recording | — | — | — | — | ✅ |

---

## Pitch Detection Libraries Comparison

### 1. Pitchy ✅ (chosen)
- **Algorithm**: McLeod Pitch Method (NSDF — Normalized Squared Difference Function)
- **Accuracy**: High — designed specifically for musical pitch detection
- **Bundle size**: Very small — pure JavaScript, zero dependencies
- **Latency**: Low — suitable for real-time feedback
- **Output**: `[frequency: number, clarity: number]` where clarity 0–1 indicates confidence
- **Maintenance**: Actively maintained (v4.1.0, Jan 2024)
- **Why chosen**: Simplest integration, musician-focused algorithm, small footprint, clarity metric lets us filter noise

```typescript
import { PitchDetector } from 'pitchy';
const detector = PitchDetector.forFloat32Array(analyser.fftSize);
const input = new Float32Array(detector.inputLength);
analyser.getFloatTimeDomainData(input);
const [pitch, clarity] = detector.findPitch(input, audioContext.sampleRate);
// Use clarity > 0.9 to filter out noise/silence
```

### 2. Pitchfinder
- **Algorithms**: YIN, McLeod, AMDF, Dynamic Wavelet (pick one)
- **Why not chosen**: Pitchy's McLeod implementation is cleaner and has a dedicated focus

### 3. ml5.js PitchDetection
- **Algorithm**: CREPE (deep learning CNN)
- **Why not chosen**: Huge bundle (TensorFlow.js), overkill for a tuner

### 4. Aubio.js
- **Algorithm**: Professional C library ported to WebAssembly
- **Why not chosen**: WASM setup complexity, overkill for MVP

---

## Frequency → Note Name + Cents Formula

A **cent** = 1/100th of a semitone. One octave = 1200 cents.

**Perceptual thresholds:**
- ±5–6 cents: Just Noticeable Difference for trained ears
- ±25 cents: Perceptible to most listeners
- ±50 cents: Quarter tone — clearly out of tune

### Conversion Steps

```typescript
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(frequency: number, concertPitchHz: number = 440) {
  // 1. Cents above/below A4 (concert pitch)
  const centsDiff = 1200 * Math.log2(frequency / concertPitchHz);

  // 2. Nearest semitone from A4
  const noteIndex = Math.round(centsDiff / 100);

  // 3. Deviation from nearest semitone (-50 to +50)
  const cents = centsDiff - noteIndex * 100;

  // 4. MIDI note number (A4 = 69)
  const midiNote = noteIndex + 69;

  // 5. Note name and octave
  const noteName = NOTE_NAMES[((midiNote % 12) + 12) % 12];
  const octave = Math.floor(midiNote / 12) - 1;

  return { noteName, octave, cents };
}
```

**Example:** 441 Hz (concert pitch 440) → `centsDiff ≈ 3.93` → A4 +3.93¢ (barely sharp)

---

## Web Audio API Setup (with iOS compatibility)

```typescript
// IMPORTANT: AudioContext must be created/resumed inside a user gesture on iOS Safari
async function startAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  await audioContext.resume(); // Required for iOS

  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  return { audioContext, analyser, stream };
}
```

---

## Tuning Thresholds

| Range | Status | Color |
|---|---|---|
| ±10 cents | In tune | Green |
| ±10–25 cents | Close | Yellow/Amber |
| >±25 cents | Out of tune | Red |

---

## Mobile Compatibility Checklist

- [ ] `AudioContext` created inside tap handler (iOS Safari requirement)
- [ ] `audioContext.resume()` called inside tap handler
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] All tap targets ≥ 48×48px
- [ ] No hover-only interactions
- [ ] Test on iOS Safari and Android Chrome

---

## Temperament and Chords — Why You Need to Adjust When Playing Double Stops

When playing two strings simultaneously, the ear hears the **interval directly as a ratio of vibrating air**. The overtone series kicks in — if the ratio isn't pure, you hear beats (wavering). The ear optimizes for **zero beats**, which means pure intervals.

No single temperament is pure for all intervals simultaneously — that's the entire historical reason temperament systems exist.

### Interval purity by temperament

| Interval | What rings | Best temperament |
|---|---|---|
| Perfect 5th (double stop) | Pure 3:2 ratio | Pythagorean (+2¢ vs equal) |
| Major 3rd (double stop) | Pure 5:4 ratio | **Just (−14¢ vs equal!)** |
| Octave | Pure 2:1 | All systems agree |

The major third is the critical case: equal temperament's major third is **14 cents sharp** compared to the pure 5:4 ratio — well above the ±10¢ "in tune" threshold. When a violinist plays a major third double stop "in tune" by ear, the app will show it as flat in Equal or Pythagorean mode.

### Melodic vs. harmonic intonation

Real violin intonation is **contextual**, not fixed to one system:

- **Melodic (single notes)**: Pythagorean — raised leading tones, pure fifths, expressive widened intervals. The violin's open strings are tuned in Pythagorean fifths (3:2 ratio), so this is the instrument's natural system.
- **Harmonic (chords / double stops)**: Just — pure thirds and sixths, zero-beat resonance

This is why great string players sound slightly "out of tune" to a piano tuner but perfectly in tune to a trained ear. They are switching systems based on context.

### Practical guidance for using this app

- Use **Pythagorean** for single-note scale work, melodic passages, and open-string passages — closest to how the violin naturally tunes
- Use **Just** temperament when practicing double stops and chords — closest to what the ear wants for thirds and sixths
- Use **Equal** when practicing alongside piano or with fixed-pitch instruments
- "Off" readings during chords aren't wrong — they show the gap between the fixed temperament and the pure interval the ear is correctly seeking

---

## Tech Stack Decision

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Build | Vite |
| UI | React + TypeScript |
| Pitch detection | Pitchy |
| Styling | Tailwind CSS |
| Audio | Web Audio API (built-in) |
