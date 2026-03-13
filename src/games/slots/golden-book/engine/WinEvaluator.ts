// ─── Golden Book 576-Ways Win Evaluator ───
import { GBSymbol, NORMAL_SYMBOLS, BOOK } from './SymbolConfig';
import { Grid, ROWS, COLS, REEL_HEIGHTS } from './ReelEngine';

export interface WinResult {
  symbol: GBSymbol;
  matchCount: number;
  ways: number;
  positions: [number, number][];
  payPerWay: number;
  totalBasePayout: number;
}

/**
 * Evaluate 576-ways wins (left-to-right adjacent matching).
 * Book (Wild) substitutes for all normal symbols.
 */
export const evaluateWins = (grid: Grid, bet: number): WinResult[] => {
  const wins: WinResult[] = [];

  for (const sym of NORMAL_SYMBOLS) {
    const reelMatches: [number, number][][] = [];

    for (let col = 0; col < COLS; col++) {
      const colPositions: [number, number][] = [];
      for (let row = 0; row < REEL_HEIGHTS[col]; row++) {
        const cell = grid[row][col];
        if (cell && (cell.id === sym.id || cell.isWild)) {
          colPositions.push([row, col]);
        }
      }
      if (colPositions.length === 0) break;
      reelMatches.push(colPositions);
    }

    const matchCount = reelMatches.length;
    if (matchCount < 3) continue;

    const ways = reelMatches.reduce((acc, reel) => acc * reel.length, 1);
    const payKey = matchCount >= 5 ? 'payout5' : matchCount === 4 ? 'payout4' : 'payout3';
    const payPerWay = sym[payKey as keyof GBSymbol] as number;
    const totalBasePayout = Math.round((bet * payPerWay * ways) / 10);

    if (totalBasePayout > 0) {
      wins.push({
        symbol: sym,
        matchCount,
        ways,
        positions: reelMatches.flat(),
        payPerWay,
        totalBasePayout,
      });
    }
  }

  return wins;
};

/**
 * Find scatter (Book) positions
 */
export const findScatters = (grid: Grid): [number, number][] => {
  const positions: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell && cell.isScatter) positions.push([r, c]);
    }
  }
  return positions;
};

/**
 * Check if a position is part of any win
 */
export const getWinPositionSet = (wins: WinResult[]): Set<string> => {
  const s = new Set<string>();
  wins.forEach(w => w.positions.forEach(([r, c]) => s.add(`${r}-${c}`)));
  return s;
};
