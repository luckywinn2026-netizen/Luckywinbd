// Procedural sound engine for Chicken Road using Web Audio API

let audioCtx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

/** Short cheerful "bock" sound when chicken crosses safely */
export const playStepSound = () => {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Quick chirp oscillator
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.12);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);

  // Pop noise layer
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
  const noise = ctx.createBufferSource();
  const ng = ctx.createGain();
  noise.buffer = buf;
  ng.gain.setValueAtTime(0.2, t);
  ng.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
  noise.connect(ng).connect(ctx.destination);
  noise.start(t);
};

/** Crash / explosion sound when chicken hits obstacle */
export const playCrashSound = () => {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Low boom
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);

  // Noise burst (explosion texture)
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * env * 0.4;
  }
  const noise = ctx.createBufferSource();
  const ng = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  noise.buffer = buf;
  ng.gain.setValueAtTime(0.4, t);
  ng.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
  noise.connect(filter).connect(ng).connect(ctx.destination);
  noise.start(t);
};

/** Cash out / win chime */
export const playCashOutSound = () => {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = t + i * 0.08;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
};

/** Big win fanfare */
export const playBigWinSound = () => {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Ascending fanfare
  const melody = [523, 659, 784, 1047, 1319, 1568];
  melody.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i < 3 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    const start = t + i * 0.1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
};

/** Start game click sound */
export const playStartSound = () => {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
};
