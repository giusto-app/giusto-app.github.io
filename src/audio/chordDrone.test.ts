import { describe, expect, test } from 'bun:test'
import { ChordDrone } from './chordDrone'
import { pitchClassOctaveToFreq } from './droneVoices'
import { FakeAudioContext, asAudioContext } from './testing/fakeAudioContext'

function makeDrone(fake: FakeAudioContext, volume = 0.4) {
  return new ChordDrone(asAudioContext(fake), {
    soundType: 'sawtooth',
    concertPitchHz: 440,
    volume,
  })
}

describe('ChordDrone (sawtooth voicing)', () => {
  test('defaults to a metronome-forward playback mix', () => {
    const fake = new FakeAudioContext()
    const drone = new ChordDrone(asAudioContext(fake), {
      soundType: 'sawtooth',
      concertPitchHz: 440,
    })
    drone.setChord(0, 'maj', 1.0)

    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!
    expect(branch.gain.events[branch.gain.events.length - 1]).toMatchObject({
      type: 'linearRamp',
      value: 0.18,
    })
  })

  test('voices root + perfect fifth in octave 3', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    makeDrone(fake).setChord(7, 'min', 1.0) // Gm

    expect(fake.oscillators).toHaveLength(2)
    const freqs = fake.oscillators.map(o => o.frequency.value).sort((a, b) => a - b)
    expect(freqs[0]).toBeCloseTo(pitchClassOctaveToFreq(7, 3, 440), 6) // G3 = 196 Hz
    expect(freqs[1]).toBeCloseTo(pitchClassOctaveToFreq(2, 4, 440), 6) // D4 = 293.66 Hz
  })

  test('crossfade: new branch ramps 0→volume across ~120 ms centered on atTime', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    makeDrone(fake).setChord(7, 'min', 1.0)

    // Branch gain is the one connected to the destination.
    const branchGain = fake.gains.find(g => g.connections.includes(fake.destination))!
    const [anchor, start, ramp] = branchGain.gain.events
    expect(anchor).toMatchObject({ type: 'set', value: 0, time: 0.5 })
    expect(start).toMatchObject({ type: 'set', value: 0 })
    expect(start.time).toBeCloseTo(0.94, 9)
    expect(ramp).toMatchObject({ type: 'linearRamp', value: 0.4 })
    expect(ramp.time).toBeCloseTo(1.06, 9)
  })

  test('thump regression: a new branch is silent from the moment it is created', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    makeDrone(fake).setChord(7, 'min', 1.0) // change scheduled 0.5 s ahead

    // A GainNode is born at gain 1; scheduling 0 only at fadeStart leaves the
    // new voices audible at FULL volume until then (the chord-change thump).
    // The branch must be anchored to zero AT CREATION TIME.
    const branchGain = fake.gains.find(g => g.connections.includes(fake.destination))!
    const first = branchGain.gain.events[0]
    expect(first).toMatchObject({ type: 'set', value: 0, time: 0.5 })
    // Nothing but silence is scheduled before the fade window opens.
    for (const e of branchGain.gain.events) {
      if (e.time < 0.94) expect(e.value).toBe(0)
    }
  })

  test('repeated identical chord does NOT re-articulate', () => {
    const fake = new FakeAudioContext()
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0)
    const oscCount = fake.oscillators.length
    drone.setChord(7, 'min', 5.0) // same Gm one bar later
    expect(fake.oscillators.length).toBe(oscCount)
  })

  test('chord change builds the new branch and fades the old one to zero', () => {
    const fake = new FakeAudioContext()
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0)
    const oldBranch = fake.gains.find(g => g.connections.includes(fake.destination))!
    drone.setChord(0, 'min', 3.0) // Cm

    expect(fake.oscillators).toHaveLength(4) // 2 old + 2 new
    const fadeOut = oldBranch.gain.events[oldBranch.gain.events.length - 1]
    expect(fadeOut).toMatchObject({ type: 'linearRamp', value: 0 })
    expect(fadeOut.time).toBeCloseTo(3.06, 9)

    const branches = fake.gains.filter(g => g.connections.includes(fake.destination))
    expect(branches).toHaveLength(2)
    const newBranch = branches.find(g => g !== oldBranch)!
    expect(newBranch.gain.events[newBranch.gain.events.length - 1].value).toBe(0.4)
  })

  test('quality does not change the voicing (root+fifth is quality-neutral) but IS a change trigger', () => {
    const fake = new FakeAudioContext()
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0)
    drone.setChord(7, 'maj', 2.0) // G major after G minor: harmony changed
    expect(fake.oscillators).toHaveLength(4)
    // Same root+fifth frequencies in both branches.
    const freqs = fake.oscillators.map(o => Math.round(o.frequency.value))
    expect(freqs.slice(0, 2).sort()).toEqual(freqs.slice(2, 4).sort())
  })

  test('stop() fades out and setVolume() ramps the live branch', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 1
    const drone = makeDrone(fake)
    drone.setChord(5, 'maj', 1.0)
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!

    drone.setVolume(0.8)
    expect(branch.gain.events[branch.gain.events.length - 1]).toMatchObject({
      type: 'linearRamp',
      value: 0.8,
    })

    drone.stop(2.0)
    const fade = branch.gain.events[branch.gain.events.length - 1]
    expect(fade.type).toBe('linearRamp')
    expect(fade.value).toBe(0)
    expect(fade.time).toBeCloseTo(2.1, 9)
  })

  test('setVolume BEFORE the fade window opens keeps the branch silent until the change lands', () => {
    // Regression: setVolume used to append linearRamp(v, now + 0.05). Sorted
    // into the timeline that lands BEFORE the silent anchor at fadeStart, so
    // the next chord faded in early — audible over the chord still playing.
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0) // fade window [0.94, 1.06]
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!

    drone.setVolume(0.8)

    for (const e of branch.gain.events) {
      if (e.time < 0.94) expect(e.value).toBe(0)
    }
    const last = branch.gain.events[branch.gain.events.length - 1]
    expect(last).toMatchObject({ type: 'linearRamp', value: 0.8 })
    expect(last.time).toBeCloseTo(1.06, 9) // window END preserved, not now + 0.05
  })

  test('setVolume DURING the fade re-anchors at the level reached and still lands on time', () => {
    // Regression: the appended ramp raced to the new level early, then the
    // already-scheduled ramp pulled the gain back to the volume captured when
    // the chord was scheduled — leaving the drone at the wrong level.
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0) // fade window [0.94, 1.06], 0 -> 0.4
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!

    fake.currentTime = 1.0 // halfway through the fade: level is 0.2
    drone.setVolume(0.8)

    const events = branch.gain.events
    const anchor = events.find(e => e.time === 1.0)!
    expect(anchor).toMatchObject({ type: 'set' })
    expect(anchor.value).toBeCloseTo(0.2, 9)

    const last = events[events.length - 1]
    expect(last).toMatchObject({ type: 'linearRamp', value: 0.8 })
    expect(last.time).toBeCloseTo(1.06, 9)
    // Nothing is left holding the stale 0.4 target.
    expect(events.filter(e => e.value === 0.4)).toHaveLength(0)
  })

  test('setVolume after the fade has finished uses its own short ramp', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0)
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!

    fake.currentTime = 2.0 // long past fadeEnd
    drone.setVolume(0.1)

    const last = branch.gain.events[branch.gain.events.length - 1]
    expect(last).toMatchObject({ type: 'linearRamp', value: 0.1 })
    expect(last.time).toBeCloseTo(2.05, 9)
  })

  test('automation never runs backwards after a volume change', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0)
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!

    fake.currentTime = 1.0
    drone.setVolume(0.8)
    fake.currentTime = 1.02
    drone.setVolume(0.05)

    const times = branch.gain.events.map(e => e.time)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  test('the outgoing branch fades from where it actually is, not from this.volume', () => {
    // A chord change landing inside the previous chord's own fade-in: the old
    // branch is only part way up, so starting its fade-out at this.volume would
    // jump it to full level first — a step right at the change.
    const fake = new FakeAudioContext()
    fake.currentTime = 1.0
    const drone = makeDrone(fake)
    drone.setChord(7, 'min', 1.0) // fade window [1.0, 1.12], 0 -> 0.4
    const oldBranch = fake.gains.find(g => g.connections.includes(fake.destination))!

    fake.currentTime = 1.04 // old branch is a third of the way up: 0.1333
    drone.setChord(0, 'maj', 1.1) // new window [1.04, 1.16]

    const handover = oldBranch.gain.events.find(e => e.type === 'set' && e.time === 1.04)!
    expect(handover.value).toBeCloseTo(0.4 / 3, 6)
  })

  test('a change scheduled in the past clamps into the immediate future (no backwards automation)', () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 10
    makeDrone(fake).setChord(9, 'maj', 3.0) // atTime long gone
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!
    branch.gain.events.forEach(e => expect(e.time).toBeGreaterThanOrEqual(10))
  })
})

describe('ChordDrone (cello voicing)', () => {
  test('chord change starts samples at the fade window, past the bow attack', async () => {
    const fake = new FakeAudioContext()
    fake.currentTime = 0.5
    const drone = new ChordDrone(asAudioContext(fake), {
      soundType: 'cello',
      concertPitchHz: 440,
      volume: 0.4,
    })

    // Stub fetch so prepare() decodes fake bytes through the fake context.
    const realFetch = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) })) as unknown as typeof fetch
    try {
      await drone.prepare([7])
    } finally {
      globalThis.fetch = realFetch
    }

    drone.setChord(7, 'min', 1.0)
    expect(fake.bufferSources).toHaveLength(2) // root + fifth
    for (const src of fake.bufferSources) {
      expect(src.startedAt).toBeCloseTo(0.94, 9) // fadeStart, not "now"
      expect(src.startOffset).toBeCloseTo(0.2, 9) // skips the bow attack
      expect(src.loopStart).toBeCloseTo(0.2, 9)
    }
  })
})

describe('ChordDrone (shruti voicing)', () => {
  test('tremolo LFO modulates an internal stage, never the crossfade gain param', () => {
    const fake = new FakeAudioContext()
    const drone = new ChordDrone(asAudioContext(fake), {
      soundType: 'shruti',
      concertPitchHz: 440,
      volume: 0.4,
    })
    drone.setChord(7, 'min', 1.0)

    // An LFO writing to the branch gain param would ADD to the crossfade
    // automation and leak ±depth of signal through the silent anchors.
    const branch = fake.gains.find(g => g.connections.includes(fake.destination))!
    const allConnections = [...fake.gains, ...fake.oscillators, ...fake.filters]
      .flatMap(node => node.connections)
    expect(allConnections).not.toContain(branch.gain)

    // The tremolo still exists: some depth stage modulates a gain param.
    const gainParams = fake.gains.map(g => g.gain)
    const modulatesAParam = fake.gains.some(g =>
      g.connections.some(c => gainParams.includes(c as (typeof gainParams)[number])),
    )
    expect(modulatesAParam).toBe(true)
  })
})
