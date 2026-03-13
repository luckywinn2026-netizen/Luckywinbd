// ─── Professional Sound Engine (Procedural Web Audio API) ───

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  get muted() { return this._muted; }
  set muted(v: boolean) { this._muted = v; }

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // Master compressor for consistent volume
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

  private getOutput() {
    this.getCtx();
    return this.compressor!;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, detune = 0) {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(this.getOutput());
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* AudioContext may not be available */ }
  }

  private richTone(freq: number, dur: number, vol = 0.12) {
    // Layered tone with harmonics for richer sound
    this.tone(freq, dur, 'sine', vol);
    this.tone(freq * 2, dur * 0.7, 'sine', vol * 0.3, 5);
    this.tone(freq * 0.5, dur * 0.5, 'sine', vol * 0.15);
  }

  private noise(dur: number, vol = 0.06, filterFreq = 800) {
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
      filter.Q.value = 1.5;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter).connect(gain).connect(this.getOutput());
      src.start();
      src.stop(ctx.currentTime + dur);
    } catch { /* */ }
  }

  private impact(freq: number, dur: number, vol = 0.15) {
    // Punchy impact sound (boxing themed)
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.setValueAtTime(vol * 0.8, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(this.getOutput());
      osc.start();
      osc.stop(ctx.currentTime + dur);
      // Layer noise for punch texture
      this.noise(dur * 0.3, vol * 0.4, 2000);
    } catch { /* */ }
  }

  spinStart() {
    // Whoosh + mechanical reel sound
    this.noise(0.6, 0.07, 1200);
    this.tone(180, 0.08, 'square', 0.04);
    this.tone(120, 0.15, 'sawtooth', 0.03);
    // Rising pitch for anticipation
    setTimeout(() => this.tone(250, 0.1, 'triangle', 0.04), 50);
  }

  reelStop(index: number) {
    // Heavy mechanical stop with boxing bell ring
    const freq = 280 + index * 80;
    this.impact(freq, 0.15, 0.12);
    this.tone(freq * 1.5, 0.08, 'triangle', 0.06);
    // Subtle metallic ring
    this.tone(freq * 3, 0.06, 'sine', 0.02, 7);
  }

  winSmall() {
    // Quick celebratory arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.18, 0.1), i * 65)
    );
  }

  winBig() {
    // Boxing bell + triumphant fanfare
    this.impact(200, 0.3, 0.15);
    const fanfare = [392, 523, 659, 784, 1047, 1319];
    fanfare.forEach((f, i) =>
      setTimeout(() => this.richTone(f, 0.35, 0.14), i * 100)
    );
    // Crowd cheer (filtered noise)
    setTimeout(() => this.noise(0.8, 0.1, 3000), 300);
    setTimeout(() => this.noise(0.6, 0.08, 4000), 500);
  }

  winMega() {
    // Epic knockout fanfare
    // Double bell hit
    this.impact(250, 0.4, 0.2);
    setTimeout(() => this.impact(300, 0.4, 0.18), 150);

    // Grand melody
    const melody = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    melody.forEach((f, i) =>
      setTimeout(() => {
        this.richTone(f, 0.45, 0.16);
      }, 200 + i * 130)
    );

    // Deep bass rumble
    this.tone(65, 1.2, 'sawtooth', 0.08);
    setTimeout(() => this.tone(82, 0.8, 'sawtooth', 0.06), 400);

    // Sparkle cascade
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        this.tone(2000 + Math.random() * 3000, 0.12, 'sine', 0.04, Math.random() * 20);
      }, 300 + i * 120);
    }

    // Crowd roar
    setTimeout(() => this.noise(1.2, 0.12, 4000), 600);
    setTimeout(() => this.noise(0.8, 0.1, 5000), 900);
    // Final cymbal crash
    setTimeout(() => this.noise(1.0, 0.15, 8000), 1200);
  }

  freeSpinTrigger() {
    // Magical ascending with boxing bell
    this.impact(300, 0.3, 0.15);
    const notes = [440, 554, 659, 880, 1108, 1319, 1760];
    notes.forEach((f, i) =>
      setTimeout(() => {
        this.richTone(f, 0.35, 0.13);
      }, 100 + i * 110)
    );
    // Shimmer effect
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.tone(3000 + Math.random() * 3000, 0.1, 'sine', 0.03, Math.random() * 15);
      }, 200 + i * 80);
    }
    setTimeout(() => this.noise(0.6, 0.07, 6000), 500);
  }

  cascade() {
    // Quick cascade whoosh with tonal accent
    this.tone(440, 0.12, 'triangle', 0.07);
    setTimeout(() => this.tone(580, 0.12, 'triangle', 0.07), 50);
    this.noise(0.08, 0.03, 1500);
  }

  scatter() {
    // Exciting scatter reveal
    [880, 1100, 1320, 1760].forEach((f, i) =>
      setTimeout(() => {
        this.richTone(f, 0.22, 0.1);
      }, i * 100)
    );
    setTimeout(() => this.noise(0.15, 0.04, 5000), 200);
  }

  symbolExplode() {
    // Punchy symbol break
    this.impact(180, 0.1, 0.1);
    this.tone(400, 0.06, 'sawtooth', 0.04);
  }

  multiplierUp() {
    // Power-up ding
    this.richTone(880, 0.12, 0.08);
    setTimeout(() => this.richTone(1320, 0.15, 0.1), 60);
  }

  buttonClick() {
    this.tone(700, 0.04, 'square', 0.04);
  }
}

export const sfx = new SoundEngine();
