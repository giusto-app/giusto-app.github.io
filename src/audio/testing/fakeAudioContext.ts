// Recording fake of the Web Audio API for bun tests (no DOM, no sound).
// Every node records its connections, schedule calls, and AudioParam
// automation events so tests can assert on the exact graph and timing the
// audio modules build. Cast with `asAudioContext()` where an AudioContext is
// expected — only the surface our audio modules use is implemented.

export interface ParamEvent {
  type: 'set' | 'linearRamp' | 'exponentialRamp'
  value: number
  time: number
}

export class FakeAudioParam {
  events: ParamEvent[] = []
  constructor(public value = 0) {}
  setValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value
    this.events.push({ type: 'set', value, time })
    return this
  }
  linearRampToValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value
    this.events.push({ type: 'linearRamp', value, time })
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value
    this.events.push({ type: 'exponentialRamp', value, time })
    return this
  }
}

export class FakeAudioNode {
  connections: unknown[] = []
  disconnected = false
  connect(target: unknown): unknown {
    this.connections.push(target)
    return target
  }
  disconnect(): void {
    this.disconnected = true
  }
}

export class FakeOscillatorNode extends FakeAudioNode {
  type = 'sine'
  frequency = new FakeAudioParam(440)
  detune = new FakeAudioParam(0)
  startedAt: number | null = null
  stoppedAt: number | null = null
  onended: (() => void) | null = null
  setPeriodicWave(_wave: unknown): void {}
  start(at?: number): void {
    this.startedAt = at ?? 0
  }
  stop(at?: number): void {
    this.stoppedAt = at ?? 0
  }
}

export class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam(1)
}

export class FakeBiquadFilterNode extends FakeAudioNode {
  type = 'lowpass'
  frequency = new FakeAudioParam(350)
  Q = new FakeAudioParam(1)
  gain = new FakeAudioParam(0)
}

export class FakeDelayNode extends FakeAudioNode {
  delayTime = new FakeAudioParam(0)
}

export class FakeBufferSourceNode extends FakeAudioNode {
  buffer: unknown = null
  loop = false
  loopStart = 0
  loopEnd = 0
  playbackRate = new FakeAudioParam(1)
  startedAt: number | null = null
  /** Playback offset into the buffer passed to start(when, offset). */
  startOffset = 0
  stoppedAt: number | null = null
  start(at?: number, offset?: number): void {
    this.startedAt = at ?? 0
    this.startOffset = offset ?? 0
  }
  stop(at?: number): void {
    this.stoppedAt = at ?? 0
  }
}

export class FakeAudioContext {
  currentTime = 0
  state: 'running' | 'suspended' = 'running'
  destination = new FakeAudioNode()
  oscillators: FakeOscillatorNode[] = []
  gains: FakeGainNode[] = []
  filters: FakeBiquadFilterNode[] = []
  bufferSources: FakeBufferSourceNode[] = []

  createOscillator(): FakeOscillatorNode {
    const node = new FakeOscillatorNode()
    this.oscillators.push(node)
    return node
  }
  createGain(): FakeGainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node
  }
  createBiquadFilter(): FakeBiquadFilterNode {
    const node = new FakeBiquadFilterNode()
    this.filters.push(node)
    return node
  }
  createDelay(_max?: number): FakeDelayNode {
    return new FakeDelayNode()
  }
  createBufferSource(): FakeBufferSourceNode {
    const node = new FakeBufferSourceNode()
    this.bufferSources.push(node)
    return node
  }
  createPeriodicWave(_real: Float32Array, _imag: Float32Array, _opts?: unknown): object {
    return {}
  }
  resume(): Promise<void> {
    this.state = 'running'
    return Promise.resolve()
  }
  /** Fake decode: any bytes become a 2.5 s buffer (enough for loop math). */
  decodeAudioData(_data: ArrayBuffer): Promise<{ duration: number }> {
    return Promise.resolve({ duration: 2.5 })
  }
}

export function asAudioContext(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext
}
