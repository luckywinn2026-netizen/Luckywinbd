// ─── Reel Generation Engine ───
import {
  SymbolDef, ALL_SYMBOLS, TOTAL_WEIGHT,
  FREE_SPIN_WEIGHT_OVERRIDES, makeGolden,
} from './SymbolConfig';

export const ROWS = 4;
export const COLS = 5;
// 1024 ways = 4^5 (each of 5 reels has 4 positions)

export type Grid = SymbolDef[][];

/**
 * Secure-ish PRNG. Uses crypto.getRandomValues when available.
 */
const secureRandom = (): number => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xFFFFFFFF + 1);
  }
  return Math.random();
};

/**
 * Pick a symbol using weighted random selection.
 */
export const pickWeightedSymbol = (freeSpinMode = false): SymbolDef => {
  let symbols = ALL_SYMBOLS;
  let totalW = TOTAL_WEIGHT;

  if (freeSpinMode) {
    // Recalculate with overrides
    symbols = ALL_SYMBOLS.map(s => {
      const override = FREE_SPIN_WEIGHT_OVERRIDES[s.id];
      return override !== undefined ? { ...s, weight: override } : s;
    });
    totalW = symbols.reduce((acc, s) => acc + s.weight, 0);
  }

  let r = secureRandom() * totalW;
  for (const sym of symbols) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return symbols[symbols.length - 1];
};

/**
 * Generate a full 5x4 grid.
 * @param freeSpinMode - Increases scatter/golden frequency
 * @param goldenChance - Probability of a cell being golden (reels 2-4 only)
 */
export const generateGrid = (freeSpinMode = false, goldenChance = 0.08): Grid => {
  const grid: Grid = [];
  for (let row = 0; row < ROWS; row++) {
    const rowArr: SymbolDef[] = [];
    for (let col = 0; col < COLS; col++) {
      let sym = pickWeightedSymbol(freeSpinMode);

      // Golden cards only appear on reels 2-4 (index 1-3)
      if (!sym.isWild && !sym.isScatter && col >= 1 && col <= 3) {
        const gc = freeSpinMode ? goldenChance * 1.5 : goldenChance;
        if (secureRandom() < gc) {
          sym = makeGolden(sym);
        }
      }
      rowArr.push(sym);
    }
    grid.push(rowArr);
  }
  return grid;
};

/**
 * Generate a tall reel strip for animation (extra symbols above final positions).
 */
export const generateReelStrip = (
  finalCol: SymbolDef[],
  extraCount = 12,
  freeSpinMode = false
): SymbolDef[] => {
  const extra = Array.from({ length: extraCount }, () => pickWeightedSymbol(freeSpinMode));
  return [...extra, ...finalCol];
};

/**
 * Log a spin result for auditing / RTP tracking.
 */
export interface SpinLog {
  timestamp: number;
  grid: string[][];
  bet: number;
  totalWin: number;
  cascades: number;
  freeSpinMode: boolean;
}

const spinHistory: SpinLog[] = [];

export const logSpin = (log: SpinLog) => {
  spinHistory.push(log);
  // Keep last 1000 spins in memory
  if (spinHistory.length > 1000) spinHistory.shift();
};

export const getSpinHistory = () => [...spinHistory];

export const calculateRTP = (): number => {
  if (spinHistory.length === 0) return 0;
  const totalBet = spinHistory.reduce((s, l) => s + l.bet, 0);
  const totalWin = spinHistory.reduce((s, l) => s + l.totalWin, 0);
  return totalBet > 0 ? (totalWin / totalBet) * 100 : 0;
};
