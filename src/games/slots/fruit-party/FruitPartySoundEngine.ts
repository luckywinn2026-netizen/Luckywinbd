// ─── Fruit Party Sound Engine (Procedural Audio) ───

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

const playChime = (delay = 0, vol = 0.1) => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  [2400, 3600].forEach(freq => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.15);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  });
};

export const FruitPartySound = {
  spin() {
    for (let i = 0; i < 7; i++) {
      setTimeout(() => playTone(440 + i * 60, 0.07, 'square', 0.05), i * 38);
    }
  },
  reelStop(reelIndex: number) {
    playTone(220 + reelIndex * 140, 0.14, 'triangle', 0.1);
    playTone(110, 0.07, 'square', 0.07);
  },
  tick() {
    playTone(1000, 0.028, 'square', 0.035);
  },
  win() {
    const notes = [659, 784, 988, 1175];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.28, 'sine', 0.15), i * 100));
    for (let i = 0; i < 5; i++) playChime(0.4 + i * 0.09, 0.07);
  },
  bigWin() {
    const notes = [659, 784, 988, 1047, 1175, 1319, 1568];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.38, 'sine', 0.17);
      playTone(f * 1.5, 0.28, 'triangle', 0.08);
    }, i * 85));
    for (let i = 0; i < 14; i++) playChime(0.3 + i * 0.07, 0.06 + Math.random() * 0.04);
  },
  jackpot() {
    for (let i = 0; i < 11; i++) {
      setTimeout(() => {
        playTone(500 + i * 85, 0.45, 'sine', 0.19);
        playTone(750 + i * 100, 0.2, 'triangle', 0.1);
      }, i * 70);
    }
    for (let i = 0; i < 20; i++) playChime(0.2 + i * 0.06, 0.07 + Math.random() * 0.05);
  },
  buttonClick() {
    playTone(1400, 0.045, 'sine', 0.08);
  },
  loss() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.48);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.52);
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
