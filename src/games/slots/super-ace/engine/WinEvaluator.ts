// ─── 1024-Ways Win Evaluation Engine ───
import { SymbolDef, NORMAL_SYMBOLS } from './SymbolConfig';
import { Grid, ROWS, COLS } from './ReelEngine';

export interface WinResult {
  symbol: SymbolDef;
  matchCount: number;     // 3, 4, or 5
  ways: number;           // Number of ways this win occurs
  positions: [number, number][];  // All [row, col] involved
  payPerWay: number;      // Base payout per way (from symbol table)
  totalBasePayout: number; // payPerWay * ways * bet / 10
}

/**
 * Evaluate all wins on the grid using 1024-ways (left-to-right adjacent matching).
 * Wild (Joker) substitutes for all symbols except Scatter.
 *
 * Algorithm:
 * For each normal symbol, walk reels left to right.
 * On each reel, collect positions where the symbol or a wild appears.
 * If a reel has 0 matches, stop. The match count = number of consecutive reels from reel 1.
 * Ways = product of matching positions per reel.
 */
export const evaluateWins = (grid: Grid, bet: number): WinResult[] => {
  const wins: WinResult[] = [];

  for (const sym of NORMAL_SYMBOLS) {
    const reelMatches: [number, number][][] = [];

    for (let col = 0; col < COLS; col++) {
      const colPositions: [number, number][] = [];
      for (let row = 0; row < ROWS; row++) {
        const cell = grid[row][col];
        if (cell.id === sym.id || cell.isWild) {
          colPositions.push([row, col]);
        }
      }
      if (colPositions.length === 0) break;
      reelMatches.push(colPositions);
    }

    const matchCount = reelMatches.length;
    if (matchCount < 3) continue;

    const ways = reelMatches.reduce((acc, reel) => acc * reel.length, 1);
    const payPerWay = sym.payout[matchCount as 3 | 4 | 5] ?? sym.payout[5];
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
 * Count and locate scatter symbols anywhere on the grid.
 */
export const findScatters = (grid: Grid): [number, number][] => {
  const positions: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isScatter) positions.push([r, c]);
    }
  }
  return positions;
};

/**
 * Find all golden card positions in the grid.
 */
export const findGoldenCards = (grid: Grid): [number, number][] => {
  const positions: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isGolden) positions.push([r, c]);
    }
  }
  return positions;
};

/**
 * Check if a position is part of any win result.
 */
export const isWinningPosition = (
  row: number, col: number, wins: WinResult[]
): boolean => {
  return wins.some(w => w.positions.some(([r, c]) => r === row && c === col));
};

/**
 * Get all unique winning position keys.
 */
export const getWinPositionSet = (wins: WinResult[]): Set<string> => {
  const s = new Set<string>();
  wins.forEach(w => w.positions.forEach(([r, c]) => s.add(`${r}-${c}`)));
  return s;
};
