// ─── Book of Dead Sound Engine (Procedural Audio) ───

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

export const BookOfDeadSound = {
  spin() { for (let i = 0; i < 8; i++) setTimeout(() => playTone(250 + i * 60, 0.08, 'square', 0.06), i * 40); },
  reelStop(i: number) { playTone(180 + i * 120, 0.15, 'triangle', 0.1); playTone(90, 0.08, 'square', 0.08); },
  tick() { playTone(700, 0.03, 'square', 0.04); },
  win() {
    [440, 554, 659, 880].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 120));
    for (let i = 0; i < 6; i++) playCoinHit(0.5 + i * 0.09, 0.07);
  },
  bigWin() {
    [440, 554, 659, 784, 880, 1047, 1175].forEach((f, i) => setTimeout(() => { playTone(f, 0.4, 'sine', 0.18); playTone(f * 1.5, 0.3, 'triangle', 0.08); }, i * 100));
    for (let i = 0; i < 15; i++) playCoinHit(0.3 + i * 0.07, 0.06);
    for (let i = 0; i < 10; i++) playCoinHit(1.5 + i * 0.08, 0.04);
  },
  jackpot() {
    for (let i = 0; i < 12; i++) setTimeout(() => { playTone(350 + i * 90, 0.5, 'sine', 0.2); playTone(175 + i * 45, 0.3, 'square', 0.06); }, i * 80);
    for (let i = 0; i < 20; i++) playCoinHit(0.2 + i * 0.06, 0.08);
    for (let i = 0; i < 15; i++) playCoinHit(1.5 + i * 0.07, 0.06);
  },
  buttonClick() { playTone(1100, 0.05, 'sine', 0.08); },
  loss() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(350, t); osc.frequency.exponentialRampToValueAtTime(150, t + 0.5);
    gain.gain.setValueAtTime(0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(c.destination); osc.start(t); osc.stop(t + 0.55);
  },
};
