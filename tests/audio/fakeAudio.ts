/** Contexte WebAudio factice (tests AUD) : enregistre les nœuds, les oscillateurs (hauteur, début, fin) et les gains. */
export class FakeParam {
  value = 0;
  target = 0;
  setValueAtTime(v: number): this {
    this.target = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.target = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    this.target = v;
    return this;
  }
  setTargetAtTime(v: number): this {
    this.target = v;
    return this;
  }
}
export class FakeNode {
  readonly out: FakeNode[] = [];
  connect(n: FakeNode): FakeNode {
    this.out.push(n);
    return n;
  }
  disconnect(): void {}
}
export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}
export interface OscRecord {
  hz: number;
  start: number;
  stop: number | null;
  type: string;
}
export class FakeOsc extends FakeNode {
  type = "sine";
  readonly frequency: FakeParam;
  readonly detune = new FakeParam();
  readonly rec: OscRecord = { hz: 0, start: 0, stop: null, type: "sine" };
  constructor(owner: FakeContext) {
    super();
    const rec = this.rec;
    this.frequency = new (class extends FakeParam {
      override setValueAtTime(v: number): this {
        if (rec.hz === 0) rec.hz = v;
        return super.setValueAtTime(v);
      }
    })();
    owner.oscillators.push(rec);
  }
  start(at = 0): void {
    this.rec.start = at;
    this.rec.type = this.type;
  }
  stop(at = 0): void {
    this.rec.stop = at;
  }
}
export class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}
export class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  readonly playbackRate = new FakeParam();
  start(): void {}
  stop(): void {}
}
export class FakeConvolver extends FakeNode {
  buffer: unknown = null;
}
export class FakeContext {
  currentTime = 0;
  readonly sampleRate = 8000;
  state = "running";
  readonly destination = new FakeNode();
  readonly made = { gain: 0, osc: 0, filter: 0, source: 0, buffer: 0 };
  readonly gains: FakeGain[] = [];
  readonly oscillators: OscRecord[] = [];
  createGain(): FakeGain {
    this.made.gain++;
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator(): FakeOsc {
    this.made.osc++;
    return new FakeOsc(this);
  }
  createBiquadFilter(): FakeFilter {
    this.made.filter++;
    return new FakeFilter();
  }
  createBufferSource(): FakeSource {
    this.made.source++;
    return new FakeSource();
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver();
  }
  createDynamicsCompressor(): FakeNode {
    return new FakeNode();
  }
  createBuffer(_c: number, len: number): { getChannelData: () => Float32Array } {
    this.made.buffer++;
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}
