# Musician Intonation Trainer — Research Notes

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
- **Bundle size**: Small-medium (TypeScript)
- **Notes**: YIN occasionally returns wild outlier values. Good if you want algorithm flexibility.
- **Why not chosen**: Pitchy's McLeod implementation is cleaner and has a dedicated focus

### 3. ml5.js PitchDetection
- **Algorithm**: CREPE (deep learning CNN)
- **Bundle size**: Very large — includes TensorFlow.js
- **Accuracy**: Good (±2 cents) but overkill for a tuner
- **Why not chosen**: Huge bundle, browser compatibility issues, unnecessary complexity

### 4. Aubio.js
- **Algorithm**: Professional C library ported to WebAssembly
- **Performance**: Near-native via WASM
- **Why not chosen**: WASM setup complexity, overkill for MVP

### 5. DIY Web Audio API + Autocorrelation
- **Bundle size**: Zero
- **Why not chosen**: Requires signal processing expertise, slower to implement vs. proven library

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

function frequencyToNote(frequency: number) {
  // 1. Cents above/below A4 (440 Hz)
  const centsDiff = 1200 * Math.log2(frequency / 440);

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

**Example:** 441 Hz → `centsDiff ≈ 3.93` → A4 +3.93¢ (barely sharp)

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
| Minor 7th | Depends on context | Neither sounds fully settled |

The major third is the critical case: equal temperament's major third is **14 cents sharp** compared to the pure 5:4 ratio — well above the ±10¢ "in tune" threshold. When a violinist plays a major third double stop "in tune" by ear, the app will show it as flat in Equal or Pythagorean mode.

### Melodic vs. harmonic intonation

Real violin intonation is **contextual**, not fixed to one system:

- **Melodic (single notes)**: Pythagorean — raised leading tones, pure fifths, expressive widened intervals
- **Harmonic (chords / double stops)**: Just — pure thirds and sixths, zero-beat resonance

This is why great string players sound slightly "out of tune" to a piano tuner but perfectly in tune to a trained ear. They are switching systems based on context.

### Practical guidance for using this app

- Use **Just** temperament when practicing double stops and chords — closest to what the ear wants for thirds and sixths
- Use **Pythagorean** for single-note scale work and open-string passages
- "Off" readings during chords aren't wrong — they show the gap between the fixed temperament and the pure interval the ear is correctly seeking
- This is a known limitation of single-temperament measurement: the "right" intonation depends on the harmonic role of the note (root, third, fifth of the chord)

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
