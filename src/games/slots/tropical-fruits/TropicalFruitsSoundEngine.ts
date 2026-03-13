// ─── Tropical Fruits Sound Engine (Procedural Audio) ───

const audioCtx = () => {
  if (typeof window === 'undefined') return null;
  return new (window.AudioContext || (window as any).webkitAudioContext)();
};

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (!ctx) ctx = audioCtx();
  return ctx;
};

const playTone = (freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.12, delay = 0) => {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + delay;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration);
};

const playPop = (delay = 0, vol = 0.1) => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.12);
};

export const TropicalFruitsSound = {
  spin() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => playTone(500 + i * 80, 0.06, 'triangle', 0.07), i * 35);
    }
  },
  reelStop(reelIndex: number) {
    playTone(200 + reelIndex * 150, 0.15, 'triangle', 0.1);
    playTone(100, 0.06, 'square', 0.06);
  },
  tick() {
    playTone(1100, 0.025, 'square', 0.03);
  },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.14), i * 120));
    for (let i = 0; i < 5; i++) playPop(0.5 + i * 0.1, 0.08);
  },
  bigWin() {
    const notes = [523, 659, 784, 880, 1047, 1175, 1319];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.4, 'sine', 0.16);
      playTone(f * 1.5, 0.25, 'triangle', 0.07);
    }, i * 90));
    for (let i = 0; i < 12; i++) playPop(0.3 + i * 0.08, 0.06 + Math.random() * 0.04);
  },
  jackpot() {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        playTone(400 + i * 100, 0.5, 'sine', 0.18);
        playTone(600 + i * 120, 0.2, 'triangle', 0.1);
      }, i * 80);
    }
    for (let i = 0; i < 18; i++) playPop(0.2 + i * 0.07, 0.07 + Math.random() * 0.04);
  },
  buttonClick() {
    playTone(1200, 0.04, 'sine', 0.07);
  },
  loss() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc1 = c.createOscillator();
    const gain1 = c.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(400, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.5);
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc1.connect(gain1).connect(c.destination);
    osc1.start(t);
    osc1.stop(t + 0.55);
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(300, t + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(120, t + 0.55);
    gain2.gain.setValueAtTime(0.08, t + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc2.connect(gain2).connect(c.destination);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.6);
  },
  multiplierActivate() {
    const notes = [880, 1175, 1480];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.15), i * 80));
  },
  scatterHit() {
    playTone(1200, 0.3, 'sine', 0.18);
    playTone(1500, 0.2, 'triangle', 0.12, 0.1);
    playTone(1800, 0.15, 'sine', 0.1, 0.2);
  },
  freeSpinStart() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.4, 'sine', 0.16);
      playTone(f * 0.5, 0.3, 'triangle', 0.06);
    }, i * 100));
  },
  nearMiss() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc1 = c.createOscillator();
    const gain1 = c.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(300, t);
    osc1.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(150, t + 0.7);
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.linearRampToValueAtTime(0.22, t + 0.25);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc1.connect(gain1).connect(c.destination);
    osc1.start(t);
    osc1.stop(t + 0.85);
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, t + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    gain2.gain.setValueAtTime(0.1, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc2.connect(gain2).connect(c.destination);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.7);
    playTone(2400, 0.08, 'square', 0.06, 0.05);
    playTone(1600, 0.1, 'triangle', 0.08, 0.15);
  },
};
