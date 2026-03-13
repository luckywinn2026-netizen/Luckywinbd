// ─── Classic Casino Sound Engine (Procedural Audio) ───

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
  [4200, 5800].forEach(freq => {
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
  const bufferSize = c.sampleRate * 0.03;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const nGain = c.createGain();
  const hpFilter = c.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 3000;
  nGain.gain.setValueAtTime(vol * 0.5, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  noise.connect(hpFilter).connect(nGain).connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.05);
};

export const ClassicCasinoSound = {
  spin() {
    const c = getCtx();
    if (!c) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playTone(280 + i * 70, 0.08, 'square', 0.06), i * 40);
    }
  },
  reelStop(reelIndex: number) {
    setTimeout(() => {
      playTone(180 + reelIndex * 140, 0.15, 'triangle', 0.1);
      playTone(90, 0.08, 'square', 0.08);
    }, 0);
  },
  tick() { playTone(750, 0.03, 'square', 0.04); },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 120));
    for (let i = 0; i < 6; i++) playCoinHit(0.5 + i * 0.09, 0.07 + Math.random() * 0.04);
  },
  bigWin() {
    const notes = [523, 659, 784, 880, 1047, 1175, 1319];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.4, 'sine', 0.18);
      playTone(f * 1.5, 0.3, 'triangle', 0.08);
    }, i * 100));
    for (let i = 0; i < 15; i++) playCoinHit(0.3 + i * 0.07, 0.06 + Math.random() * 0.05);
    for (let i = 0; i < 10; i++) playCoinHit(1.5 + i * 0.08, 0.04 + Math.random() * 0.03);
  },
  jackpot() {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        playTone(400 + i * 100, 0.5, 'sine', 0.2);
        playTone(200 + i * 50, 0.3, 'square', 0.06);
        playTone(600 + i * 120, 0.2, 'triangle', 0.1);
      }, i * 80);
    }
    for (let i = 0; i < 20; i++) playCoinHit(0.2 + i * 0.06, 0.08 + Math.random() * 0.05);
    for (let i = 0; i < 15; i++) playCoinHit(1.5 + i * 0.07, 0.06 + Math.random() * 0.04);
  },
  buttonClick() { playTone(1200, 0.05, 'sine', 0.08); },
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
  },
};
