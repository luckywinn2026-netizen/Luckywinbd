// ─── Aviator Sound Engine (Procedural Web Audio API) ───

export class AviatorSoundEngine {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private flyingOsc: OscillatorNode | null = null;
  private flyingGain: GainNode | null = null;
  // Background music nodes
  private bgOscs: OscillatorNode[] = [];
  private bgGain: GainNode | null = null;
  private bgInterval: ReturnType<typeof setInterval> | null = null;

  get muted() { return this._muted; }
  set muted(v: boolean) {
    this._muted = v;
    if (v) { this.stopFlying(); this.stopBgMusic(); }
  }

  private getCtx() {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* */ }
  }

  private noise(dur: number, vol = 0.06) {
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
      filter.frequency.value = 800;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + dur);
    } catch { /* */ }
  }

  /** Plane takeoff — jet engine whoosh */
  takeoff() {
    if (this._muted) return;
    // Rising whoosh
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
    } catch { /* */ }
    this.noise(0.6, 0.1);
    this.tone(220, 0.3, 'triangle', 0.06);
  }

  /** Continuous flying hum — call once when flying starts */
  startFlying() {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      this.flyingOsc = ctx.createOscillator();
      this.flyingGain = ctx.createGain();
      this.flyingOsc.type = 'sawtooth';
      this.flyingOsc.frequency.value = 120;
      this.flyingGain.gain.value = 0.03;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      this.flyingOsc.connect(filter).connect(this.flyingGain).connect(ctx.destination);
      this.flyingOsc.start();
    } catch { /* */ }
  }

  /** Update flying pitch based on multiplier */
  updateFlyingPitch(multiplier: number) {
    if (this.flyingOsc && this.flyingGain) {
      try {
        this.flyingOsc.frequency.value = 120 + multiplier * 15;
        this.flyingGain.gain.value = Math.min(0.06, 0.03 + multiplier * 0.003);
      } catch { /* */ }
    }
  }

  stopFlying() {
    this.stopBgMusic();
    try {
      if (this.flyingGain) {
        const ctx = this.getCtx();
        this.flyingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      }
      setTimeout(() => {
        try { this.flyingOsc?.stop(); } catch { /* */ }
        this.flyingOsc = null;
        this.flyingGain = null;
      }, 150);
    } catch { /* */ }
  }

  /** Procedural looping background music during flight */
  startBgMusic() {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      this.bgGain = ctx.createGain();
      this.bgGain.gain.value = 0.04;
      this.bgGain.connect(ctx.destination);

      // Pad chord — warm layered oscillators
      const chords = [
        [130.81, 164.81, 196.00], // C3 E3 G3
        [146.83, 185.00, 220.00], // D3 F#3 A3
        [164.81, 196.00, 246.94], // E3 G3 B3
        [174.61, 220.00, 261.63], // F3 A3 C4
      ];
      let chordIdx = 0;

      const playChord = () => {
        if (this._muted || !this.bgGain) return;
        // Stop previous chord oscillators
        this.bgOscs.forEach(o => { try { o.stop(); } catch { /* */ } });
        this.bgOscs = [];

        const chord = chords[chordIdx % chords.length];
        chordIdx++;
        const ctx = this.getCtx();

        chord.forEach(freq => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.035, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 2);
          osc.connect(g).connect(this.bgGain!);
          osc.start();
          this.bgOscs.push(osc);
        });

        // Add a subtle high shimmer
        const shimmer = ctx.createOscillator();
        shimmer.type = 'triangle';
        shimmer.frequency.value = chord[2] * 2;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.012, ctx.currentTime);
        sg.gain.exponentialRampToValueAtTime(0.004, ctx.currentTime + 2);
        shimmer.connect(sg).connect(this.bgGain!);
        shimmer.start();
        this.bgOscs.push(shimmer);
      };

      playChord();
      this.bgInterval = setInterval(playChord, 2400);
    } catch { /* */ }
  }

  stopBgMusic() {
    if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; }
    this.bgOscs.forEach(o => { try { o.stop(); } catch { /* */ } });
    this.bgOscs = [];
    if (this.bgGain) {
      try {
        const ctx = this.getCtx();
        this.bgGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      } catch { /* */ }
      setTimeout(() => { this.bgGain = null; }, 250);
    }
  }
  tick() {
    this.tone(800, 0.05, 'sine', 0.04);
  }

  /** Place bet click */
  placeBet() {
    this.tone(500, 0.08, 'square', 0.06);
    setTimeout(() => this.tone(700, 0.06, 'square', 0.05), 60);
  }

  /** Cashout — success cha-ching */
  cashout() {
    [880, 1100, 1320, 1760].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.25, 'sine', 0.14), i * 80)
    );
    setTimeout(() => this.noise(0.2, 0.06), 200);
  }

  /** Big cashout (>5x) */
  bigCashout() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.4, 'sine', 0.18), i * 100)
    );
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.tone(2000 + Math.random() * 2000, 0.1, 'sine', 0.05), 200 + i * 120);
    }
    setTimeout(() => this.noise(0.4, 0.1), 400);
  }

  /** Crash explosion */
  crash() {
    this.stopFlying();
    if (this._muted) return;
    // Explosion bass
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* */ }
    // Crash noise burst
    this.noise(0.5, 0.18);
    // Debris scatter
    setTimeout(() => {
      [150, 200, 100].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.15, 'triangle', 0.06), i * 80)
      );
      this.noise(0.3, 0.08);
    }, 200);
  }

  /** Waiting countdown beep */
  countdownBeep() {
    this.tone(440, 0.1, 'sine', 0.06);
  }

  buttonClick() {
    this.tone(600, 0.06, 'square', 0.05);
  }
}

export const aviatorSfx = new AviatorSoundEngine();
