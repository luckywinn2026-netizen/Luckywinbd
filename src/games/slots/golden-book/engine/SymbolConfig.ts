// ─── Golden Book Symbol Configuration ───

export interface GBSymbol {
  id: string;
  label: string;
  emoji: string;
  payout3: number;
  payout4: number;
  payout5: number;
  weight: number;
  isWild: boolean;
  isScatter: boolean;
}

// Golden Book = Wild + Scatter
export const BOOK: GBSymbol = {
  id: 'book', label: 'Book', emoji: '📕',
  payout3: 2, payout4: 20, payout5: 200,
  weight: 3, isWild: true, isScatter: true,
};

// High value
export const PRINCESS: GBSymbol = {
  id: 'princess', label: 'Princess', emoji: '👸',
  payout3: 3, payout4: 10, payout5: 50,
  weight: 6, isWild: false, isScatter: false,
};

export const PRINCE: GBSymbol = {
  id: 'prince', label: 'Prince', emoji: '🤴',
  payout3: 2.5, payout4: 8, payout5: 40,
  weight: 7, isWild: false, isScatter: false,
};

export const TIGER: GBSymbol = {
  id: 'tiger', label: 'Tiger', emoji: '🐅',
  payout3: 2, payout4: 6, payout5: 25,
  weight: 8, isWild: false, isScatter: false,
};

export const PALACE: GBSymbol = {
  id: 'palace', label: 'Palace', emoji: '🏰',
  payout3: 1.5, payout4: 5, payout5: 20,
  weight: 9, isWild: false, isScatter: false,
};

// Medium value
export const ROSE: GBSymbol = {
  id: 'rose', label: 'Rose', emoji: '🌹',
  payout3: 1, payout4: 3, payout5: 12,
  weight: 12, isWild: false, isScatter: false,
};

// Low value (card ranks)
export const ACE: GBSymbol = {
  id: 'ace', label: 'A', emoji: '🅰️',
  payout3: 0.8, payout4: 2, payout5: 8,
  weight: 16, isWild: false, isScatter: false,
};

export const KING: GBSymbol = {
  id: 'king', label: 'K', emoji: '👑',
  payout3: 0.6, payout4: 1.5, payout5: 6,
  weight: 18, isWild: false, isScatter: false,
};

export const QUEEN: GBSymbol = {
  id: 'queen', label: 'Q', emoji: '💎',
  payout3: 0.5, payout4: 1.2, payout5: 5,
  weight: 18, isWild: false, isScatter: false,
};

export const JACK: GBSymbol = {
  id: 'jack', label: 'J', emoji: '🃏',
  payout3: 0.4, payout4: 1, payout5: 4,
  weight: 20, isWild: false, isScatter: false,
};

export const TEN: GBSymbol = {
  id: 'ten', label: '10', emoji: '🔟',
  payout3: 0.3, payout4: 0.8, payout5: 3,
  weight: 20, isWild: false, isScatter: false,
};

export const ALL_SYMBOLS: GBSymbol[] = [
  BOOK, PRINCESS, PRINCE, TIGER, PALACE, ROSE, ACE, KING, QUEEN, JACK, TEN,
];

export const NORMAL_SYMBOLS: GBSymbol[] = ALL_SYMBOLS.filter(s => !s.isScatter);

export const TOTAL_WEIGHT = ALL_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

// Free spin mode: higher scatter/wild frequency
export const FREE_SPIN_WEIGHTS: Partial<Record<string, number>> = {
  book: 5,
};

export const getSymbolById = (id: string): GBSymbol =>
  ALL_SYMBOLS.find(s => s.id === id) || TEN;
