/**
 * Centralized Paytable Configurations for all slot games.
 * Shows symbols, win tiers, and rules — user-facing only.
 */
import type { SymbolPayout, CustomWinTier, GameRule } from '@/components/PaytableModal';

/* ═══════════════════════════════════════════════════════
   3+1 REEL GAMES (Digit × Multiplier)
   ═══════════════════════════════════════════════════════ */

const DIGIT_REEL_TIERS: CustomWinTier[] = [
  { label: 'MEGA WIN', multiplier: '999 × 500x', example: 'Triple 9 + Max multiplier', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
  { label: 'BIG WIN', multiplier: '100–999 × 25x–100x', example: 'High digits + high multiplier', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
  { label: 'MEDIUM WIN', multiplier: '10–99 × 5x–10x', example: 'Two non-zero digits + mid multiplier', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
  { label: 'SMALL WIN', multiplier: '1–9 × 1x–3x', example: 'One non-zero digit + low multiplier', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
];

const DIGIT_REEL_MULTIPLIER_SYMBOLS: SymbolPayout[] = [
  { emoji: '💰', label: '500x', description: 'Max multiplier' },
  { emoji: '💎', label: '200x', description: 'Ultra high multiplier' },
  { emoji: '🔥', label: '100x', description: 'High multiplier' },
  { emoji: '⭐', label: '25x', description: 'Mid-high multiplier' },
  { emoji: '🎯', label: '10x', description: 'Mid multiplier' },
  { emoji: '✨', label: '5x', description: 'Low-mid multiplier' },
  { emoji: '🔢', label: '3x', description: 'Low multiplier' },
  { emoji: '📊', label: '2x', description: 'Common multiplier' },
  { emoji: '1️⃣', label: '1x', description: 'Base multiplier' },
  { emoji: '🃏', label: 'WILD', description: 'Random 5x–50x multiplier', isSpecial: true },
  { emoji: '💫', label: 'FREE', description: '10 Free Spins', isSpecial: true },
];

const DIGIT_REEL_RULES: GameRule[] = [
  { emoji: '🎰', text: 'WIN = 3-Digit Number × 4th Reel Multiplier' },
  { emoji: '🔒', text: '৳0.5: 1 reel active | ৳10: 2 reels | ৳20+: all 3' },
  { emoji: '🃏', text: 'WILD: Random 5x–50x multiplier applied' },
  { emoji: '💫', text: 'Scatter: Triggers 10 Free Spins' },
  { emoji: '✅', text: 'Provably Fair — certified RNG' },
  { emoji: '💰', text: 'Minimum bet ৳0.5' },
];

/* ═══════════════════════════════════════════════════════
   MONEY COMING
   ═══════════════════════════════════════════════════════ */
export const MONEY_COMING_PAYTABLE = {
  mechanic: '3+1 Reel' as const,
  winTiers: DIGIT_REEL_TIERS,
  symbolPayouts: DIGIT_REEL_MULTIPLIER_SYMBOLS,
  rules: DIGIT_REEL_RULES,
};

/* ═══════════════════════════════════════════════════════
   LUCKY 777
   ═══════════════════════════════════════════════════════ */
export const LUCKY_777_PAYTABLE = {
  mechanic: '3+1 Reel' as const,
  winTiers: [
    { label: 'JACKPOT', multiplier: '777 × 200x', example: 'Triple 7 = 155,400× bet', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '888 × 50x', example: 'Triple 8 = 44,400× bet', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    ...DIGIT_REEL_TIERS.slice(2),
  ],
  symbolPayouts: DIGIT_REEL_MULTIPLIER_SYMBOLS,
  rules: DIGIT_REEL_RULES,
};

/* ═══════════════════════════════════════════════════════
   TROPICAL FRUITS
   ═══════════════════════════════════════════════════════ */
export const TROPICAL_FRUITS_PAYTABLE = {
  mechanic: '3+1 Reel' as const,
  winTiers: DIGIT_REEL_TIERS,
  symbolPayouts: [
    { emoji: '🍒', label: 'Cherry (1)', description: 'Digit value: 1' },
    { emoji: '🍋', label: 'Lemon (2)', description: 'Digit value: 2' },
    { emoji: '🍊', label: 'Orange (3)', description: 'Digit value: 3' },
    { emoji: '🍇', label: 'Grape (4)', description: 'Digit value: 4' },
    { emoji: '🍉', label: 'Melon (5)', description: 'Digit value: 5' },
    { emoji: '🍌', label: 'Banana (6)', description: 'Digit value: 6' },
    { emoji: '🥭', label: 'Mango (7)', description: 'Digit value: 7' },
    { emoji: '🍓', label: 'Strawberry (8)', description: 'Digit value: 8' },
    { emoji: '🫐', label: 'Blueberry (9)', description: 'Digit value: 9' },
    { emoji: '🥝', label: 'Kiwi (0)', description: 'Digit value: 0' },
  ],
  rules: DIGIT_REEL_RULES,
};

/* ═══════════════════════════════════════════════════════
   FRUIT PARTY
   ═══════════════════════════════════════════════════════ */
export const FRUIT_PARTY_PAYTABLE = {
  mechanic: '3+1 Reel' as const,
  winTiers: [
    { label: 'MEGA WIN', multiplier: '⭐⭐⭐ × 500x', example: 'Star Star Star (999) × Max multiplier', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '🍓🫧⭐ × 25x–100x', example: 'High fruits (789) × high multiplier', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '🍑🍇 × 5x–10x', example: 'Mid fruits (56x) × mid multiplier', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '🍎🍐🍋 × 1x–3x', example: 'Low fruits (1-9) × low multiplier', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  symbolPayouts: [
    { emoji: '🎉', label: 'Party (0)', description: 'Digit 0' },
    { emoji: '🍎', label: 'Apple (1)', description: 'Digit 1' },
    { emoji: '🍐', label: 'Pear (2)', description: 'Digit 2' },
    { emoji: '🍋', label: 'Lemon (3)', description: 'Digit 3' },
    { emoji: '🍒', label: 'Cherry (4)', description: 'Digit 4' },
    { emoji: '🍑', label: 'Peach (5)', description: 'Digit 5' },
    { emoji: '🍇', label: 'Grape (6)', description: 'Digit 6' },
    { emoji: '🍓', label: 'Strawberry (7)', description: 'Digit 7' },
    { emoji: '🫧', label: 'Bubble (8)', description: 'Digit 8' },
    { emoji: '⭐', label: 'Star (9)', description: 'Digit 9' },
  ],
  rules: DIGIT_REEL_RULES,
};

/* ═══════════════════════════════════════════════════════
   FORTUNE WHEEL
   ═══════════════════════════════════════════════════════ */
export const FORTUNE_WHEEL_PAYTABLE = {
  mechanic: '3+1 Reel' as const,
  winTiers: DIGIT_REEL_TIERS,
  symbolPayouts: DIGIT_REEL_MULTIPLIER_SYMBOLS,
  rules: DIGIT_REEL_RULES,
};

/* ═══════════════════════════════════════════════════════
   CLASSIC CASINO (Symbol-to-digit mapping)
   ═══════════════════════════════════════════════════════ */
export const CLASSIC_CASINO_PAYTABLE = {
  mechanic: '3+1 Reel' as const,
  winTiers: DIGIT_REEL_TIERS,
  symbolPayouts: [
    { emoji: '🅱️', label: 'BAR (0)', description: 'Digit 0' },
    { emoji: '🍒', label: 'Cherry (1)', description: 'Digit 1' },
    { emoji: '🍋', label: 'Lemon (2)', description: 'Digit 2' },
    { emoji: '🍊', label: 'Orange (3)', description: 'Digit 3' },
    { emoji: '🍇', label: 'Grape (4)', description: 'Digit 4' },
    { emoji: '🔔', label: 'Bell (5)', description: 'Digit 5' },
    { emoji: '⭐', label: 'Star (6)', description: 'Digit 6' },
    { emoji: '7️⃣', label: 'Seven (7)', description: 'Digit 7' },
    { emoji: '💎', label: 'Diamond (8)', description: 'Digit 8' },
    { emoji: '👑', label: 'Crown (9)', description: 'Digit 9' },
  ],
  rules: [
    { emoji: '🎰', text: 'Symbols map to digits 0–9. WIN = 3-digit × 4th reel' },
    { emoji: '🔒', text: '৳0.5: 1 reel | ৳10: 2 reels | ৳20+: all 3 active' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   CLASSIC 777
   ═══════════════════════════════════════════════════════ */
export const CLASSIC_777_PAYTABLE = {
  mechanic: '3-Reel Match' as const,
  winTiers: [
    { label: 'JACKPOT', multiplier: '777 Match', example: 'Triple 7 = Mega payout', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: 'BAR Match', example: 'Triple BAR = Big payout', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: 'Symbol Match', example: 'Triple Cherry/Bell', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '2 Match', example: 'Two matching symbols', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  symbolPayouts: [
    { emoji: '7️⃣', label: 'Seven', description: 'Highest value symbol' },
    { emoji: '🅱️', label: 'BAR', description: 'High value' },
    { emoji: '🍒', label: 'Cherry', description: 'Medium value' },
    { emoji: '🔔', label: 'Bell', description: 'Medium value' },
    { emoji: '⭐', label: 'Star', description: 'Low-medium value' },
    { emoji: '🍋', label: 'Lemon', description: 'Low value' },
  ],
  rules: [
    { emoji: '🎰', text: 'Match 3 symbols on the payline to win' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   GOLDEN BOOK (576-Ways)
   ═══════════════════════════════════════════════════════ */
export const GOLDEN_BOOK_PAYTABLE = {
  mechanic: '5-Reel Ways' as const,
  winTiers: [
    { label: 'MEGA WIN', multiplier: '50x+ (576 ways)', example: 'Premium symbol × 5 reels × max ways', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '10x – 40x', example: 'High symbol × 4–5 reels', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '3x – 8x', example: 'Mid symbol × 3–4 reels', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '0.3x – 2x', example: 'Low symbol × 3 reels', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  symbolPayouts: [
    { emoji: '📕', label: 'Book', match3: 2, match4: 20, match5: 200, description: 'Wild + Scatter', isSpecial: true },
    { emoji: '👸', label: 'Princess', match3: 3, match4: 10, match5: 50 },
    { emoji: '🤴', label: 'Prince', match3: 2.5, match4: 8, match5: 40 },
    { emoji: '🐅', label: 'Tiger', match3: 2, match4: 6, match5: 25 },
    { emoji: '🏰', label: 'Palace', match3: 1.5, match4: 5, match5: 20 },
    { emoji: '🌹', label: 'Rose', match3: 1, match4: 3, match5: 12 },
    { emoji: '🅰️', label: 'Ace', match3: 0.8, match4: 2, match5: 8 },
    { emoji: '👑', label: 'King', match3: 0.6, match4: 1.5, match5: 6 },
    { emoji: '💎', label: 'Queen', match3: 0.5, match4: 1.2, match5: 5 },
    { emoji: '🃏', label: 'Jack', match3: 0.4, match4: 1, match5: 4 },
    { emoji: '🔟', label: 'Ten', match3: 0.3, match4: 0.8, match5: 3 },
  ],
  rules: [
    { emoji: '🎰', text: '576-Ways: Match symbols left-to-right on adjacent reels' },
    { emoji: '📕', text: 'Book = Wild (substitutes all) + Scatter (3+ = Free Spins)' },
    { emoji: '🔄', text: 'Free Spins: Random expanding symbol covers entire reels' },
    { emoji: '📐', text: 'Payout = Bet × SymbolPay × Ways / 10' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   SUPER ACE (5-Reel Cascade)
   ═══════════════════════════════════════════════════════ */
export const SUPER_ACE_PAYTABLE = {
  mechanic: 'Cascade' as const,
  winTiers: [
    { label: 'MEGA WIN', multiplier: '20x+ (cascade)', example: 'Multiple cascades with multiplier buildup', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '8x – 15x', example: 'High symbol × 5 match + cascades', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '3x – 6x', example: 'Mid symbol × 4–5 match', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '1x – 2x', example: 'Low symbol × 3 match', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  symbolPayouts: [
    { emoji: '🃏', label: 'Joker', description: 'Wild — Substitutes all symbols', isSpecial: true },
    { emoji: '💫', label: 'Scatter', description: '3+ triggers Free Spins', isSpecial: true },
    { emoji: '🅰️', label: 'Ace', match3: 4, match4: 8, match5: 20 },
    { emoji: '👑', label: 'King', match3: 2.5, match4: 5, match5: 10 },
    { emoji: '💎', label: 'Queen', match3: 2, match4: 4, match5: 8 },
    { emoji: '🃏', label: 'Jack', match3: 1.5, match4: 3, match5: 6 },
    { emoji: '♦️', label: 'Diamond', match3: 1.2, match4: 2.5, match5: 5 },
    { emoji: '♠️', label: 'Spade', match3: 1, match4: 2, match5: 4 },
    { emoji: '♥️', label: 'Heart', match3: 1, match4: 2, match5: 4 },
    { emoji: '♣️', label: 'Club', match3: 1, match4: 2, match5: 4 },
  ],
  rules: [
    { emoji: '🎰', text: '5×3 grid with Cascade mechanic — wins disappear, new symbols fall' },
    { emoji: '📈', text: 'Each cascade increases the multiplier (1x → 2x → 3x...)' },
    { emoji: '🃏', text: 'Joker Wild substitutes for all normal symbols' },
    { emoji: '💫', text: '3+ Scatter = Free Spins with enhanced wilds' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   FORTUNE GEMS (5×3 Grid)
   ═══════════════════════════════════════════════════════ */
export const FORTUNE_GEMS_PAYTABLE = {
  mechanic: '5-Reel Grid' as const,
  winTiers: [
    { label: 'MEGA WIN', multiplier: '15x+', example: '5× Star gems on payline', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '5x – 12x', example: '4–5 matching gems', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '2x – 4x', example: '3–4 matching gems', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '0.5x – 1.5x', example: '3 low-value gems', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  symbolPayouts: [
    { emoji: '⭐', label: 'Star', description: 'Highest value — golden gem' },
    { emoji: '💙', label: 'Blue', description: 'High value' },
    { emoji: '❤️', label: 'Red', description: 'High value' },
    { emoji: '💜', label: 'Purple', description: 'Medium value' },
    { emoji: '💚', label: 'Green', description: 'Low value' },
  ],
  rules: [
    { emoji: '💎', text: '5×3 gem grid — match 3+ identical gems on paylines' },
    { emoji: '⭐', text: 'Star gem is the highest paying symbol' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   SIMPLE 3-REEL SLOTS (Starburst, Mega Moolah, Book of Dead)
   ═══════════════════════════════════════════════════════ */
export const SIMPLE_3REEL_PAYTABLE = {
  mechanic: '3-Reel Match' as const,
  winTiers: [
    { label: 'MEGA WIN', multiplier: '30x – 50x', example: 'Triple premium symbol match', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '15x – 25x', example: 'Triple high-value symbol', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '5x – 10x', example: '2–3 matching symbols', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '0.5x – 2x', example: 'Two symbol match', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  rules: [
    { emoji: '🎰', text: 'Match symbols on the payline to win' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   Lucky Boxing King
   ═══════════════════════════════════════════════════════ */
export const SWEET_BONANZA_PAYTABLE = {
  mechanic: '5-Reel Grid' as const,
  winTiers: [
    { label: 'MEGA WIN', multiplier: '20x+', example: 'Premium symbols with multiplier bombs', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '8x – 15x', example: '8+ high-value symbols', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '3x – 6x', example: '8+ medium symbols clustered', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '1x – 2x', example: '8+ low-value symbols', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  rules: [
    { emoji: '🎰', text: 'Cluster pays — 8+ matching symbols anywhere = win' },
    { emoji: '💣', text: 'Multiplier bombs appear during free spins' },
    { emoji: '💫', text: '4+ Scatter = Free Spins' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   SPIN WHEEL / LUCKY SPIN
   ═══════════════════════════════════════════════════════ */
export const SPIN_WHEEL_PAYTABLE = {
  mechanic: 'Custom' as const,
  winTiers: [
    { label: 'JACKPOT', multiplier: '100x – 500x', example: 'Land on jackpot segment', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '20x – 50x', example: 'Premium wheel segment', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '5x – 15x', example: 'Mid-value segment', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '1x – 3x', example: 'Common segment', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  rules: [
    { emoji: '🎡', text: 'Spin the wheel — land on a segment to win' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};

/* ═══════════════════════════════════════════════════════
   LUCKY WIN (5×3 Pirate Slot)
   ═══════════════════════════════════════════════════════ */
export const LUCKY_WIN_PAYTABLE = {
  mechanic: '5-Reel Grid' as const,
  winTiers: [
    { label: 'JACKPOT', multiplier: '5 of a kind', example: '5 Treasure = 50× bet', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
    { label: 'BIG WIN', multiplier: '4 of a kind', example: '4 Compass = 25× bet', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
    { label: 'MEDIUM WIN', multiplier: '4 of a kind (low)', example: '4 Barrel = 5× bet', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
    { label: 'SMALL WIN', multiplier: '3 of a kind', example: '3 matching symbols on a row', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
  ],
  symbolPayouts: [
    { emoji: '💀', label: 'Wild', description: 'Substitutes all symbols except Scatter', isSpecial: true },
    { emoji: '🗺️', label: 'Scatter', description: '3+ triggers Free Spins', isSpecial: true },
    { emoji: '💎', label: 'Treasure', match3: 15, match4: 30, match5: 50 },
    { emoji: '🧭', label: 'Compass', match3: 8, match4: 15, match5: 25 },
    { emoji: '☠️', label: 'Skull', match3: 5, match4: 10, match5: 15 },
    { emoji: '🦜', label: 'Parrot', match3: 3, match4: 6, match5: 10 },
    { emoji: '🐙', label: 'Octopus', match3: 2.5, match4: 5, match5: 8 },
    { emoji: '🛢️', label: 'Barrel', match3: 1.5, match4: 3, match5: 5 },
  ],
  rules: [
    { emoji: '🏴‍☠️', text: '5×3 grid — match 3+ identical symbols on a row to win' },
    { emoji: '💀', text: 'Wild substitutes for all symbols (except Scatter)' },
    { emoji: '🗺️', text: '3+ Scatter anywhere = Free Spins bonus round' },
    { emoji: '📐', text: 'Payout = Bet × Symbol Multiplier' },
    { emoji: '✅', text: 'Provably Fair — certified RNG' },
    { emoji: '💰', text: 'Minimum bet ৳0.5' },
  ] as GameRule[],
};
