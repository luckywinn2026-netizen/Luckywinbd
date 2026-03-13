// ─── Symbol Configuration & Types ───

export interface SymbolDef {
  id: string;
  label: string;
  payout: { 3: number; 4: number; 5: number };
  weight: number;
  isWild: boolean;
  isScatter: boolean;
  isGolden: boolean;
}

// High value symbols
const ACE: SymbolDef = {
  id: 'ace', label: 'A',
  payout: { 3: 4, 4: 8, 5: 20 },
  weight: 8, isWild: false, isScatter: false, isGolden: false,
};

const KING: SymbolDef = {
  id: 'king', label: 'K',
  payout: { 3: 2.5, 4: 5, 5: 10 },
  weight: 10, isWild: false, isScatter: false, isGolden: false,
};

const QUEEN: SymbolDef = {
  id: 'queen', label: 'Q',
  payout: { 3: 2, 4: 4, 5: 8 },
  weight: 12, isWild: false, isScatter: false, isGolden: false,
};

const JACK: SymbolDef = {
  id: 'jack', label: 'J',
  payout: { 3: 1.5, 4: 3, 5: 6 },
  weight: 14, isWild: false, isScatter: false, isGolden: false,
};

// Medium value symbols
const DIAMOND: SymbolDef = {
  id: 'diamond', label: '♦',
  payout: { 3: 1.2, 4: 2.5, 5: 5 },
  weight: 16, isWild: false, isScatter: false, isGolden: false,
};

// Low value symbols
const SPADE: SymbolDef = {
  id: 'spade', label: '♠',
  payout: { 3: 1, 4: 2, 5: 4 },
  weight: 18, isWild: false, isScatter: false, isGolden: false,
};

const HEART: SymbolDef = {
  id: 'heart', label: '♥',
  payout: { 3: 1, 4: 2, 5: 4 },
  weight: 18, isWild: false, isScatter: false, isGolden: false,
};

const CLUB: SymbolDef = {
  id: 'club', label: '♣',
  payout: { 3: 1, 4: 2, 5: 4 },
  weight: 18, isWild: false, isScatter: false, isGolden: false,
};

// Special symbols
export const JOKER_WILD: SymbolDef = {
  id: 'joker', label: 'W',
  payout: { 3: 0, 4: 0, 5: 0 },
  weight: 3, isWild: true, isScatter: false, isGolden: false,
};

export const SCATTER: SymbolDef = {
  id: 'scatter', label: 'S',
  payout: { 3: 0, 4: 0, 5: 0 },
  weight: 3, isWild: false, isScatter: true, isGolden: false,
};

// All normal (non-special) symbols in order
export const NORMAL_SYMBOLS: SymbolDef[] = [
  SPADE, HEART, CLUB, DIAMOND, JACK, QUEEN, KING, ACE,
];

// Complete symbol table including specials
export const ALL_SYMBOLS: SymbolDef[] = [
  ...NORMAL_SYMBOLS, JOKER_WILD, SCATTER,
];

// Total weight for weighted random selection
export const TOTAL_WEIGHT = ALL_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

// Free spin mode has higher golden card & scatter frequency
export const FREE_SPIN_WEIGHT_OVERRIDES: Partial<Record<string, number>> = {
  scatter: 5,
  joker: 5,
};

/**
 * Create a golden-card variant of a symbol.
 * Golden cards convert to Joker Wild when part of a winning combo.
 */
export const makeGolden = (sym: SymbolDef): SymbolDef => ({
  ...sym,
  isGolden: true,
});

export const getSymbolById = (id: string): SymbolDef | undefined =>
  ALL_SYMBOLS.find(s => s.id === id);
