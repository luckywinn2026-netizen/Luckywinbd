// ─── Golden Book Sound Engine ───

export class GBSoundEngine {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  get muted() { return this._muted; }
  set muted(v: boolean) { this._muted = v; }

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.compressor.connect(this.masterGain).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private getOutput() { this.getCtx(); return this.compressor!; }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(this.getOutput());
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* */ }
  }

  private richTone(freq: number, dur: number, vol = 0.1) {
    this.tone(freq, dur, 'sine', vol);
    this.tone(freq * 2, dur * 0.7, 'sine', vol * 0.3);
  }

  private noise(dur: number, vol = 0.05, filterFreq = 800) {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter).connect(gain).connect(this.getOutput());
      src.start();
      src.stop(ctx.currentTime + dur);
    } catch { /* */ }
  }

  spinStart() {
    this.noise(0.5, 0.06, 1000);
    this.tone(200, 0.1, 'triangle', 0.05);
    setTimeout(() => this.tone(300, 0.08, 'triangle', 0.04), 60);
  }

  reelStop(index: number) {
    const freq = 250 + index * 70;
    this.tone(freq, 0.12, 'sine', 0.1);
    this.tone(freq * 1.5, 0.06, 'triangle', 0.04);
  }

  winSmall() {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.18, 0.1), i * 70)
    );
  }

  winBig() {
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.3, 0.13), i * 90)
    );
    setTimeout(() => this.noise(0.5, 0.08, 3000), 300);
  }

  winMega() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.4, 0.15), i * 110)
    );
    this.tone(65, 1, 'sawtooth', 0.06);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.tone(2000 + Math.random() * 3000, 0.1, 'sine', 0.03), 300 + i * 100);
    }
    setTimeout(() => this.noise(0.8, 0.1, 5000), 500);
  }

  scatter() {
    // Mystical book reveal
    [660, 880, 1100, 1320].forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.25, 0.12), i * 80)
    );
    setTimeout(() => this.noise(0.1, 0.03, 6000), 200);
  }

  freeSpinTrigger() {
    [440, 554, 659, 880, 1108, 1319].forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.3, 0.13), i * 100)
    );
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.tone(3000 + Math.random() * 3000, 0.08, 'sine', 0.02), 200 + i * 70);
    }
  }

  gambleReveal(won: boolean) {
    if (won) {
      [523, 784, 1047].forEach((f, i) =>
        setTimeout(() => this.richTone(f, 0.2, 0.12), i * 80)
      );
    } else {
      this.tone(200, 0.4, 'sawtooth', 0.1);
      setTimeout(() => this.tone(150, 0.3, 'sawtooth', 0.08), 150);
    }
  }

  buttonClick() {
    this.tone(700, 0.04, 'square', 0.04);
  }
}

export const gbSfx = new GBSoundEngine();
