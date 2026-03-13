// ─── Fortune Wheel Sound Engine (Procedural Audio) ───

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

const playCoinHit = (delay = 0, vol = 0.1) => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  [3800, 5200].forEach(freq => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.12);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  });
};

export const FortuneWheelSound = {
  spin() {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playTone(400 + i * 60, 0.08, 'square', 0.06), i * 40);
    }
  },
  reelStop(reelIndex: number) {
    playTone(280 + reelIndex * 120, 0.15, 'triangle', 0.1);
    playTone(140, 0.08, 'square', 0.08);
  },
  tick() {
    playTone(900, 0.03, 'square', 0.04);
  },
  win() {
    const notes = [587, 740, 880, 1175];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 110));
    for (let i = 0; i < 6; i++) playCoinHit(0.5 + i * 0.09, 0.07);
  },
  bigWin() {
    const notes = [587, 740, 880, 988, 1175, 1319, 1480];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.4, 'sine', 0.18);
      playTone(f * 1.5, 0.3, 'triangle', 0.08);
    }, i * 95));
    for (let i = 0; i < 15; i++) playCoinHit(0.3 + i * 0.07, 0.06);
  },
  megaWin() {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        playTone(450 + i * 90, 0.5, 'sine', 0.2);
        playTone(225 + i * 45, 0.3, 'square', 0.06);
        playTone(675 + i * 110, 0.2, 'triangle', 0.1);
      }, i * 75);
    }
    for (let i = 0; i < 20; i++) playCoinHit(0.2 + i * 0.06, 0.08);
    for (let i = 0; i < 15; i++) playCoinHit(1.5 + i * 0.07, 0.06);
  },
  buttonClick() {
    playTone(1300, 0.05, 'sine', 0.08);
  },
  loss() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc1 = c.createOscillator();
    const gain1 = c.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(350, t);
    osc1.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc1.connect(gain1).connect(c.destination);
    osc1.start(t);
    osc1.stop(t + 0.55);
  },
  multiplierActivate() {
    const notes = [880, 1175, 1480];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.15), i * 80));
  },
  wheelSpin() {
    for (let i = 0; i < 20; i++) {
      setTimeout(() => playTone(600 + Math.random() * 400, 0.06, 'triangle', 0.08), i * 60);
    }
  },
  wheelStop() {
    playTone(1200, 0.4, 'sine', 0.2);
    playTone(1500, 0.3, 'triangle', 0.12, 0.1);
    for (let i = 0; i < 8; i++) playCoinHit(0.2 + i * 0.06, 0.08);
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
    playTone(2400, 0.08, 'square', 0.06, 0.05);
  },
  freeSpinStart() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.4, 'sine', 0.16);
      playTone(f * 0.5, 0.3, 'triangle', 0.06);
    }, i * 100));
    for (let i = 0; i < 10; i++) playCoinHit(0.6 + i * 0.08, 0.06);
  },
};
