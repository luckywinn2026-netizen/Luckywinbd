// ─── Mega Moolah Sound Engine (Procedural Audio) ───

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
  [4000, 5500].forEach(freq => {
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

export const MegaMoolahSound = {
  spin() { for (let i = 0; i < 8; i++) setTimeout(() => playTone(280 + i * 70, 0.08, 'square', 0.06), i * 40); },
  reelStop(i: number) { playTone(200 + i * 140, 0.15, 'triangle', 0.1); playTone(100, 0.08, 'square', 0.08); },
  tick() { playTone(750, 0.03, 'square', 0.04); },
  win() {
    [494, 622, 740, 988].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 120));
    for (let i = 0; i < 6; i++) playCoinHit(0.5 + i * 0.09, 0.07);
  },
  bigWin() {
    [494, 622, 740, 831, 988, 1109, 1245].forEach((f, i) => setTimeout(() => { playTone(f, 0.4, 'sine', 0.18); playTone(f * 1.5, 0.3, 'triangle', 0.08); }, i * 100));
    for (let i = 0; i < 15; i++) playCoinHit(0.3 + i * 0.07, 0.06);
    for (let i = 0; i < 10; i++) playCoinHit(1.5 + i * 0.08, 0.04);
  },
  jackpot() {
    for (let i = 0; i < 12; i++) setTimeout(() => { playTone(380 + i * 95, 0.5, 'sine', 0.2); playTone(190 + i * 48, 0.3, 'square', 0.06); }, i * 80);
    for (let i = 0; i < 20; i++) playCoinHit(0.2 + i * 0.06, 0.08);
    for (let i = 0; i < 15; i++) playCoinHit(1.5 + i * 0.07, 0.06);
  },
  buttonClick() { playTone(1150, 0.05, 'sine', 0.08); },
  loss() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(380, t); osc.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    gain.gain.setValueAtTime(0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(c.destination); osc.start(t); osc.stop(t + 0.55);
  },
};
