// Procedural audio for Spin Wheel using Web Audio API

let ctx: AudioContext | null = null;
const getCtx = (): AudioContext => {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

/** Short click/tick sound — called rapidly during spin */
export const playTick = (pitch = 1) => {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800 * pitch;
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.05);
  } catch {}
};

/** Spin start whoosh */
export const playSpinStart = () => {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.4);
  } catch {}
};

/** Landing thud when wheel stops */
export const playLand = () => {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.25);
  } catch {}
};

/** Win celebration — ascending arpeggio */
export const playWinCelebration = (big = false) => {
  try {
    const c = getCtx();
    const notes = big
      ? [523, 659, 784, 1047, 1319, 1568] // C5-G6 big win
      : [523, 659, 784, 1047]; // C5-C6 normal win

    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });

    // Shimmer overlay for big wins
    if (big) {
      const noise = c.createOscillator();
      const nGain = c.createGain();
      noise.type = 'sine';
      noise.frequency.value = 2093; // C7
      const t = c.currentTime + 0.5;
      nGain.gain.setValueAtTime(0.05, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      noise.connect(nGain).connect(c.destination);
      noise.start(t);
      noise.stop(t + 0.8);
    }
  } catch {}
};

/** Loss/miss sound — descending tone */
export const playLoss = () => {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.35);
  } catch {}
};
