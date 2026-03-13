class FortuneGemsSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  setMuted(m: boolean) { this.muted = m; }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  playSpinStart() {
    this.playTone(400, 0.1, 'square', 0.08);
    setTimeout(() => this.playTone(500, 0.1, 'square', 0.08), 50);
  }

  playWin(isBig: boolean) {
    if (isBig) {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => this.playTone(f, 0.3, 'sine', 0.12), i * 120)
      );
    } else {
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => this.playTone(f, 0.2, 'sine', 0.1), i * 100)
      );
    }
  }

  playLoss() {
    this.playTone(200, 0.15, 'triangle', 0.06);
  }
}

export default FortuneGemsSoundEngine;
