# Drone Audio Research

## Context
The giusto app (intonation trainer for bowed string players) has a drone feature.
We tried Web Audio API synthesis for a tanpura/shruti box sound — all attempts sounded
bad. Research confirmed: **every serious tanpura web app uses pre-recorded samples, not synthesis.**

---

## How the Good Sites Work

All 5 sites analyzed use pre-recorded audio → `AudioBufferSourceNode` → loop. No oscillators.

| Site | Format | Loop Length | Bitrate | Quality Rank |
|------|--------|-------------|---------|--------------|
| **mynoise.net** | MP3/OGG stereo | 34–61 sec | 128 kbps | ★★★★★ Best loops |
| **spardhaschoolofmusic.com** | MP3 | ~10 sec | 320 kbps | ★★★★ Best bitrate |
| **carnaticmusicexams.in** | WAV 16-bit | ~4.5 sec | Uncompressed | ★★★ Short loops |
| **anubodh.com** | MP3 | ~22 sec | 128 kbps | ★★ Adequate |

### Implementation Pattern (all sites)
```javascript
const ctx = new AudioContext()
const source = ctx.createBufferSource()
source.buffer = await ctx.decodeAudioData(await fetch(url).then(r => r.arrayBuffer()))
source.loop = true
source.connect(gainNode)
gainNode.connect(ctx.destination)
source.start()
```

### mynoise.net sample URLs (best loops, need permission to use)
```
https://mynoise.world/Data/SHRUTI/{0-9}a.mp3   (A loops)
https://mynoise.world/Data/SHRUTI/{0-9}b.mp3   (B loops, alternated for gapless)
```
Band mapping: 0=C#, 1=E, 2=F, 3=F#, 4=G, 5=G#, 6=A, 7=A#, 8=B, 9=C# (different)

**Contact:** Stéphane Pigeon — one-man operation, known to be responsive.

---

## Public Domain (CC0) Tanpura Samples

| Sound | URL | Duration | Quality | Key |
|-------|-----|----------|---------|-----|
| tanpura.wav by marvman | https://freesound.org/people/marvman/sounds/35394/ | 1:06 | 44.1kHz/16-bit WAV | C |
| Tanpura in E by iluppai | https://freesound.org/people/iluppai/sounds/148850/ | 0:23 | 44.1kHz/16-bit WAV | E |
| Tanbura 96kHz by psuess | https://freesound.org/people/psuess/sounds/194435/ | 1:22 | **96kHz/24-bit WAV** | ? |
| Tambura_Eb_fat by Kaczinski | https://freesound.org/people/Kaczinski/sounds/506312/ | **3:09** | 44.1kHz/16-bit | Eb |
| Tanpura 10 by sankalp | https://freesound.org/people/sankalp/sounds/153262/ | 2:13 | 44.1kHz/16-bit | ? |

**Strategy:** Bundle 2–3 source pitches, use `playbackRate` to pitch-shift to all 12 keys.
Acceptable up to ±4–5 semitones from source. Beyond that, source another sample.

---

## Public Domain (CC0) Cello Samples

### VSCO2 Community Edition — Best Option
Pack URL: https://freesound.org/people/sgossner/packs/21005/
License: **CC0 (public domain)**
Format: 44.1kHz/24-bit WAV
Description: Professional orchestral library, cello section, vibrato sustain

Available pitches in pack:
- C2 (https://freesound.org/people/Samulis/sounds/372831/)
- B2, E2, D3, F#2, C4, B4, E4, F#4, D5 (various in pack)

**Strategy for cello drone:** Cover the 4 open strings (C2, G2, D3, A3) by using
nearest sample + playbackRate adjustment.

### Other CC0 Cello
| Sound | URL | Duration | Notes |
|-------|-----|----------|-------|
| cello drone.wav by carrieedick | https://freesound.org/people/carrieedick/sounds/465558/ | 1:08 | 32-bit, processed drone |
| Cello C string resonance | https://freesound.org/people/juskiddink/sounds/156664/ | 0:10 | CC-BY (needs attribution) |

---

## Implementation Plan

### Phase 1 — Cello drones (VSCO2 CC0 samples) ✅ Starting now
- Download subset of VSCO2 cello sustain samples
- Build `SampleDroneEngine`: fetch → decode → BufferSourceNode → loop
- Pitch-shift via `playbackRate` for keys not directly sampled
- Add "Cello" as a third sound type in `DroneSoundType`

### Phase 2 — Tanpura (CC0 freesound samples)
- Download marvman C + iluppai E + Kaczinski Eb (covers spread of 12 keys)
- Replace shruti synthesis with same sample engine
- Rename sound type to "Tanpura"

### Phase 3 — Shruti Box (pending mynoise.net permission)
- Contact Stéphane Pigeon at mynoise.net
- Swap in their superior 60-second seamless loops
- Add as separate "Shruti Box" option

---

## Pitch-Shifting via playbackRate
```
playbackRate = 2^(semitones / 12)

Examples:
+1 semitone = 1.0595
+3 semitones = 1.1892
-3 semitones = 0.8409
+6 semitones = 1.4142   ← max practical shift before quality degrades
```
