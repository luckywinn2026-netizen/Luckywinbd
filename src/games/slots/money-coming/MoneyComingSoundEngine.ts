// ─── Money Coming Sound Engine (Procedural Audio) ───

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

export const MoneyComingSound = {
  spin() {
    const c = getCtx();
    if (!c) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playTone(350 + i * 70, 0.08, 'square', 0.06), i * 40);
    }
  },
  reelStop(reelIndex: number) {
    setTimeout(() => {
      playTone(250 + reelIndex * 130, 0.15, 'triangle', 0.1);
      playTone(120, 0.08, 'square', 0.08);
    }, 0);
  },
  tick() {
    playTone(900, 0.03, 'square', 0.04);
  },
  win() {
    const notes = [587, 740, 880, 1175];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 110));
    for (let i = 0; i < 6; i++) playCoinHit(0.5 + i * 0.09, 0.07 + Math.random() * 0.04);
  },
  bigWin() {
    const notes = [587, 740, 880, 988, 1175, 1319, 1480];
    notes.forEach((f, i) => setTimeout(() => {
      playTone(f, 0.4, 'sine', 0.18);
      playTone(f * 1.5, 0.3, 'triangle', 0.08);
    }, i * 95));
    for (let i = 0; i < 15; i++) playCoinHit(0.3 + i * 0.07, 0.06 + Math.random() * 0.05);
    for (let i = 0; i < 10; i++) playCoinHit(1.5 + i * 0.08, 0.04 + Math.random() * 0.03);
  },
  jackpot() {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        playTone(450 + i * 90, 0.5, 'sine', 0.2);
        playTone(225 + i * 45, 0.3, 'square', 0.06);
        playTone(675 + i * 110, 0.2, 'triangle', 0.1);
      }, i * 75);
    }
    for (let i = 0; i < 20; i++) playCoinHit(0.2 + i * 0.06, 0.08 + Math.random() * 0.05);
    for (let i = 0; i < 15; i++) playCoinHit(1.5 + i * 0.07, 0.06 + Math.random() * 0.04);
    for (let i = 0; i < 10; i++) playCoinHit(2.8 + i * 0.09, 0.04 + Math.random() * 0.03);
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
  coinDrop() {
    for (let i = 0; i < 8; i++) playCoinHit(i * 0.07, 0.08 - i * 0.008);
  },
  /** Crowd cheer effect — layered noise + short "woo" sweeps, plays after multiplier lands */
  crowdCheer() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    const duration = 0.9;
    // Layered filtered noise = crowd murmur/cheer
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const x = (Math.random() * 2 - 1) * 0.35;
      const env = Math.sin((i / bufferSize) * Math.PI); // rise and fall
      data[i] = x * env;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const nGain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.8;
    nGain.gain.setValueAtTime(0, t);
    nGain.gain.linearRampToValueAtTime(0.22, t + 0.08);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    noise.connect(filter).connect(nGain).connect(c.destination);
    noise.start(t);
    noise.stop(t + duration);
    // Short "woo" sweeps (crowd peaks)
    [0, 0.12, 0.25, 0.35].forEach((delay, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280 + i * 80, t + delay);
      osc.frequency.exponentialRampToValueAtTime(520 + i * 60, t + delay + 0.2);
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.08, t + delay + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25);
      osc.connect(g).connect(c.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.26);
    });
  },

  multiplierActivate() {
    const notes = [880, 1175, 1480];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.15), i * 80));
    // Crowd cheer after multiplier lands
    setTimeout(() => MoneyComingSound.crowdCheer(), 180);
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
    for (let i = 0; i < 10; i++) playCoinHit(0.6 + i * 0.08, 0.06);
  },
  nearMiss() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    // Dramatic rising sweep that drops — "almost had it!"
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
    // Tension wobble
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
    // Metallic ping
    playTone(2400, 0.08, 'square', 0.06, 0.05);
    playTone(1600, 0.1, 'triangle', 0.08, 0.15);
  },
};
