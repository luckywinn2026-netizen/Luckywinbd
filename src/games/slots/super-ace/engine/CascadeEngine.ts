// ─── Cascade (Tumble) System ───
import { SymbolDef, JOKER_WILD } from './SymbolConfig';
import { Grid, ROWS, COLS, pickWeightedSymbol } from './ReelEngine';

/**
 * Cascade multipliers for base game and free spin mode.
 */
export const BASE_MULTIPLIERS = [1, 2, 3, 5] as const;
export const FREE_MULTIPLIERS = [2, 4, 6, 10] as const;

export const getMultiplier = (
  cascadeIndex: number,
  freeSpinMode: boolean
): number => {
  const table = freeSpinMode ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;
  return table[Math.min(cascadeIndex, table.length - 1)];
};

/**
 * Remove winning symbols and apply gravity drop.
 * New symbols are generated at the top of each column.
 */
export const cascadeGrid = (
  grid: Grid,
  winPositions: Set<string>,
  freeSpinMode = false
): Grid => {
  const newGrid: SymbolDef[][] = grid.map(row => [...row]);

  for (let col = 0; col < COLS; col++) {
    // Collect surviving symbols (bottom to top order maintained)
    const remaining: SymbolDef[] = [];
    for (let row = 0; row < ROWS; row++) {
      if (!winPositions.has(`${row}-${col}`)) {
        remaining.push(newGrid[row][col]);
      }
    }

    // Generate new symbols for the removed count
    const removed = ROWS - remaining.length;
    const newSymbols = Array.from({ length: removed }, () =>
      pickWeightedSymbol(freeSpinMode)
    );

    // Stack: new symbols on top, remaining below
    const fullCol = [...newSymbols, ...remaining];
    for (let row = 0; row < ROWS; row++) {
      newGrid[row][col] = fullCol[row];
    }
  }

  return newGrid;
};

/**
 * Golden Card Feature:
 * If a golden card is part of a winning combo, convert its position
 * to a Joker Wild in the next cascade. Converts only once per spin.
 */
export const applyGoldenConversion = (
  grid: Grid,
  winPositions: Set<string>,
  alreadyConverted: Set<string>
): { grid: Grid; newConversions: Set<string> } => {
  const newGrid: SymbolDef[][] = grid.map(row => [...row]);
  const newConversions = new Set<string>();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r}-${c}`;
      if (
        newGrid[r][c].isGolden &&
        winPositions.has(key) &&
        !alreadyConverted.has(key)
      ) {
        // Don't remove this position in cascade - instead convert to wild
        newGrid[r][c] = { ...JOKER_WILD };
        newConversions.add(key);
      }
    }
  }

  return { grid: newGrid, newConversions };
};
