// ─── Golden Book Reel Engine ───
// 5 reels × 4 rows with 4-3-4-3-4 pattern = 576 ways

import { GBSymbol, ALL_SYMBOLS, TOTAL_WEIGHT, FREE_SPIN_WEIGHTS } from './SymbolConfig';

export const ROWS = 4;
export const COLS = 5;
// Active rows per reel: 4-3-4-3-4 pattern
export const REEL_HEIGHTS = [4, 3, 4, 3, 4] as const;
// Total ways = 4 * 3 * 4 * 3 * 4 = 576

export type Grid = (GBSymbol | null)[][];

const secureRandom = (): number => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xFFFFFFFF + 1);
  }
  return Math.random();
};

export const pickWeightedSymbol = (freeSpinMode = false): GBSymbol => {
  let symbols = ALL_SYMBOLS;
  let totalW = TOTAL_WEIGHT;

  if (freeSpinMode) {
    symbols = ALL_SYMBOLS.map(s => {
      const override = FREE_SPIN_WEIGHTS[s.id];
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
 * Generate a 4×5 grid following the 4-3-4-3-4 pattern.
 * Reels with 3 rows have null in row index 3.
 */
export const generateGrid = (freeSpinMode = false): Grid => {
  const grid: Grid = [];
  for (let row = 0; row < ROWS; row++) {
    const rowArr: (GBSymbol | null)[] = [];
    for (let col = 0; col < COLS; col++) {
      if (row >= REEL_HEIGHTS[col]) {
        rowArr.push(null); // inactive cell
      } else {
        rowArr.push(pickWeightedSymbol(freeSpinMode));
      }
    }
    grid.push(rowArr);
  }
  return grid;
};

/**
 * Check if a cell is active in the 4-3-4-3-4 pattern
 */
export const isCellActive = (row: number, col: number): boolean => {
  return row < REEL_HEIGHTS[col];
};
