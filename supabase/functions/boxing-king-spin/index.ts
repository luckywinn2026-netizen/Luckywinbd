// @ts-nocheck - Deno URL imports; deploy works, IDE uses Node resolution
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════
// BOXING KING — 5x3, 25 Paylines, Medium-High Volatility
// Target RTP: ~96%
// ═══════════════════════════════════════════════

// ─── Symbol Configuration ───
interface SymbolDef {
  id: string;
  label: string;
  payouts: Record<number, number>; // count → multiplier on bet
  weight: number;
  isWild: boolean;
  isScatter: boolean;
}

// High value: boxer
const BOXER: SymbolDef = { id: 'boxer', label: 'boxer', payouts: { 2: 0.5, 3: 5, 4: 15, 5: 50 }, weight: 8, isWild: false, isScatter: false };

// Medium value: boxing items
const GLOVES: SymbolDef = { id: 'gloves', label: 'gloves', payouts: { 3: 2.5, 4: 8, 5: 25 }, weight: 10, isWild: false, isScatter: false };
const TROPHY: SymbolDef = { id: 'trophy', label: 'trophy', payouts: { 3: 1.5, 4: 5, 5: 15 }, weight: 12, isWild: false, isScatter: false };

// Low value: card symbols
const SYM_A: SymbolDef = { id: 'A', label: 'A', payouts: { 3: 1, 4: 3, 5: 10 }, weight: 16, isWild: false, isScatter: false };
const SYM_K: SymbolDef = { id: 'K', label: 'K', payouts: { 3: 0.8, 4: 2.5, 5: 8 }, weight: 17, isWild: false, isScatter: false };
const SYM_Q: SymbolDef = { id: 'Q', label: 'Q', payouts: { 3: 0.6, 4: 2, 5: 6 }, weight: 18, isWild: false, isScatter: false };
const SYM_J: SymbolDef = { id: 'J', label: 'J', payouts: { 3: 0.5, 4: 1.5, 5: 5 }, weight: 19, isWild: false, isScatter: false };
const SYM_10: SymbolDef = { id: '10', label: '10', payouts: { 3: 0.4, 4: 1.2, 5: 4 }, weight: 20, isWild: false, isScatter: false };

// Special
const WILD: SymbolDef = { id: 'wild', label: 'wild', payouts: { 2: 1, 3: 10, 4: 50, 5: 200 }, weight: 3, isWild: true, isScatter: false };
const SCATTER: SymbolDef = { id: 'scatter', label: 'scatter', payouts: { 3: 2, 4: 10, 5: 50 }, weight: 2, isWild: false, isScatter: true };

const ALL_SYMBOLS: SymbolDef[] = [BOXER, GLOVES, TROPHY, SYM_A, SYM_K, SYM_Q, SYM_J, SYM_10, WILD, SCATTER];
const NORMAL_SYMBOLS = ALL_SYMBOLS.filter(s => !s.isWild && !s.isScatter);

const ROWS = 3;
const COLS = 5;
const MAX_WIN_CAP = 5000;
const FREE_SPIN_TRIGGER = 3;
const FREE_SPIN_AWARD = 10;

// ─── 25 Paylines (standard 5x3) ───
// Each payline is an array of row indices for each reel [reel0, reel1, reel2, reel3, reel4]
const PAYLINES: number[][] = [
  [1,1,1,1,1], // line 1 - middle
  [0,0,0,0,0], // line 2 - top
  [2,2,2,2,2], // line 3 - bottom
  [0,1,2,1,0], // line 4 - V shape
  [2,1,0,1,2], // line 5 - inverted V
  [1,0,0,0,1], // line 6
  [1,2,2,2,1], // line 7
  [0,0,1,2,2], // line 8
  [2,2,1,0,0], // line 9
  [0,1,1,1,0], // line 10
  [2,1,1,1,2], // line 11
  [1,0,1,0,1], // line 12
  [1,2,1,2,1], // line 13
  [0,1,0,1,0], // line 14
  [2,1,2,1,2], // line 15
  [1,1,0,1,1], // line 16
  [1,1,2,1,1], // line 17
  [0,2,0,2,0], // line 18
  [2,0,2,0,2], // line 19
  [0,2,2,2,0], // line 20
  [2,0,0,0,2], // line 21
  [0,0,2,0,0], // line 22
  [2,2,0,2,2], // line 23
  [1,0,2,0,1], // line 24
  [1,2,0,2,1], // line 25
];

// ─── Weighted Reel Strips ───
// Each reel has its own weighted symbol distribution
interface ReelStrip {
  symbols: SymbolDef[];
  weights: number[];
  totalWeight: number;
}

function buildReelStrip(scatterWeight: number, wildWeight: number): ReelStrip {
  const symbols = ALL_SYMBOLS.map(s => {
    if (s.isScatter) return { ...s, weight: scatterWeight };
    if (s.isWild) return { ...s, weight: wildWeight };
    return { ...s };
  });
  const weights = symbols.map(s => s.weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return { symbols, weights, totalWeight };
}

// Scatter appears less on reels 1,5 and more on reels 2,3,4
const BASE_REEL_STRIPS: ReelStrip[] = [
  buildReelStrip(1, 2),  // Reel 1 - less scatter, less wild
  buildReelStrip(2, 3),  // Reel 2
  buildReelStrip(3, 4),  // Reel 3 - most scatter/wild
  buildReelStrip(2, 3),  // Reel 4
  buildReelStrip(1, 2),  // Reel 5
];

// Free spin mode: enhanced wild drop rate
const FREE_REEL_STRIPS: ReelStrip[] = [
  buildReelStrip(2, 5),
  buildReelStrip(3, 6),
  buildReelStrip(4, 8),
  buildReelStrip(3, 6),
  buildReelStrip(2, 5),
];

// ─── Secure RNG ───
function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xFFFFFFFF + 1);
}

// ─── Pick symbol from reel strip ───
function pickFromReel(strip: ReelStrip): SymbolDef {
  let r = secureRandom() * strip.totalWeight;
  for (let i = 0; i < strip.symbols.length; i++) {
    r -= strip.weights[i];
    if (r <= 0) return { ...strip.symbols[i] };
  }
  return { ...strip.symbols[strip.symbols.length - 1] };
}

// ─── Grid Types ───
type Grid = SymbolDef[][];

interface SimpleSymbol {
  id: string;
  isWild: boolean;
  isScatter: boolean;
}

function simplifyGrid(grid: Grid): SimpleSymbol[][] {
  return grid.map(row => row.map(s => ({ id: s.id, isWild: s.isWild, isScatter: s.isScatter })));
}

// ─── Grid Generation ───
function generateGrid(freeSpinMode = false): Grid {
  const strips = freeSpinMode ? FREE_REEL_STRIPS : BASE_REEL_STRIPS;
  const grid: Grid = Array.from({ length: ROWS }, () => []);
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      grid[row].push(pickFromReel(strips[col]));
    }
  }
  return grid;
}

// ─── No-Win Grid ───
function generateNoWinGrid(): Grid {
  const grid: Grid = Array.from({ length: ROWS }, () => []);
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      let sym: SymbolDef;
      let attempts = 0;
      do {
        const idx = Math.floor(secureRandom() * NORMAL_SYMBOLS.length);
        sym = { ...NORMAL_SYMBOLS[idx] };
        attempts++;
      } while (attempts < 50 && wouldCreatePaylineWin(grid, row, col, sym));
      grid[row].push(sym);
    }
  }
  return grid;
}

function wouldCreatePaylineWin(grid: Grid, row: number, col: number, sym: SymbolDef): boolean {
  if (col < 2) return false;
  // Check if any payline through this position has 3+ consecutive matches from left
  for (const payline of PAYLINES) {
    if (payline[col] !== row) continue;
    // Check if reels 0..col-1 all match
    let allMatch = true;
    let matchId = '';
    for (let c = 0; c < col; c++) {
      const pr = payline[c];
      if (!grid[pr] || !grid[pr][c]) { allMatch = false; break; }
      const cell = grid[pr][c];
      if (c === 0) {
        matchId = cell.isWild ? sym.id : cell.id;
      } else {
        if (cell.id !== matchId && !cell.isWild) { allMatch = false; break; }
      }
    }
    if (allMatch && (sym.id === matchId || sym.isWild)) return true;
  }
  return false;
}

// ─── Forced Win Grids ───
function generateSmallWinGrid(freeSpinMode = false): Grid {
  const grid = generateGrid(freeSpinMode);
  // Force a 3-match on payline 1 (middle row) with a low symbol
  const lowSyms = [SYM_J, SYM_Q, SYM_K, SYM_10];
  const sym = lowSyms[Math.floor(secureRandom() * lowSyms.length)];
  for (let c = 0; c < 3; c++) {
    grid[1][c] = { ...sym };
  }
  // Ensure reels 4,5 don't extend the win
  for (let c = 3; c < COLS; c++) {
    if (grid[1][c].id === sym.id || grid[1][c].isWild) {
      const other = NORMAL_SYMBOLS.filter(s => s.id !== sym.id);
      grid[1][c] = { ...other[Math.floor(secureRandom() * other.length)] };
    }
  }
  return grid;
}

function generateBigWinGrid(freeSpinMode = false): Grid {
  const grid = generateGrid(freeSpinMode);
  // Force a 4 or 5 match on middle row with medium symbol
  const medSyms = [GLOVES, TROPHY, SYM_A];
  const sym = medSyms[Math.floor(secureRandom() * medSyms.length)];
  const matchLen = secureRandom() < 0.5 ? 4 : 5;
  for (let c = 0; c < matchLen; c++) {
    grid[1][c] = { ...sym };
  }
  return grid;
}

function generateMegaWinGrid(freeSpinMode = false): Grid {
  const grid = generateGrid(freeSpinMode);
  // Force 5-match on multiple paylines with high-value symbol
  const sym = BOXER;
  // Fill rows 0 and 1 with the same symbol for multi-payline wins
  for (let c = 0; c < COLS; c++) {
    grid[0][c] = { ...sym };
    grid[1][c] = { ...sym };
  }
  return grid;
}

// ─── Payline Win Evaluation ───
interface PaylineWin {
  paylineIndex: number;
  symbolId: string;
  matchCount: number;
  payout: number;
  positions: [number, number][]; // [row, col]
}

function evaluatePaylineWins(grid: Grid, betPerLine: number): PaylineWin[] {
  const wins: PaylineWin[] = [];

  for (let pi = 0; pi < PAYLINES.length; pi++) {
    const payline = PAYLINES[pi];
    const firstSym = grid[payline[0]][0];

    // Skip scatter — scatter pays anywhere separately
    if (firstSym.isScatter) continue;

    // Determine the matching symbol (wild matches anything)
    let matchSymId = firstSym.isWild ? '' : firstSym.id;
    let matchCount = 1;
    const positions: [number, number][] = [[payline[0], 0]];

    for (let col = 1; col < COLS; col++) {
      const cell = grid[payline[col]][col];
      if (cell.isScatter) break;

      if (cell.isWild) {
        // Wild continues the match
        matchCount++;
        positions.push([payline[col], col]);
      } else if (matchSymId === '' || cell.id === matchSymId) {
        // Either first was wild (matchSymId='') or same symbol
        if (matchSymId === '') matchSymId = cell.id;
        matchCount++;
        positions.push([payline[col], col]);
      } else {
        break;
      }
    }

    if (matchCount < 2) continue; // Min 2 for boxer, 3 for others

    // Find the symbol def
    const symDef = matchSymId === ''
      ? WILD // All wilds
      : ALL_SYMBOLS.find(s => s.id === matchSymId) || WILD;

    const payout = symDef.payouts[matchCount] ?? 0;
    if (payout <= 0) continue;

    const winAmount = Math.round(betPerLine * payout * 100) / 100;

    wins.push({
      paylineIndex: pi,
      symbolId: symDef.id,
      matchCount,
      payout: winAmount,
      positions,
    });
  }

  return wins;
}

// ─── Scatter Evaluation (pays anywhere) ───
function evaluateScatterWins(grid: Grid, totalBet: number): { count: number; payout: number; positions: [number, number][] } {
  const positions: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isScatter) positions.push([r, c]);
    }
  }
  const count = positions.length;
  const scatterPayout = SCATTER.payouts[count] ?? 0;
  return { count, payout: Math.round(totalBet * scatterPayout * 100) / 100, positions };
}

// ─── Bonus Fight Round ───
interface BonusFightResult {
  triggered: boolean;
  multiplier: number;
  tier: string;
}

function resolveBonusFight(): BonusFightResult {
  const roll = secureRandom() * 100;
  let multiplier: number;
  let tier: string;
  if (roll < 2) { multiplier = 50; tier = 'KNOCKOUT'; }
  else if (roll < 10) { multiplier = 25; tier = 'TKO'; }
  else if (roll < 25) { multiplier = 10; tier = 'UPPERCUT'; }
  else if (roll < 50) { multiplier = 5; tier = 'HOOK'; }
  else { multiplier = 2; tier = 'JAB'; }
  return { triggered: true, multiplier, tier };
}

// ─── Cascading Wins ───
function cascadeGrid(grid: Grid, winPositions: Set<string>, freeSpinMode = false): Grid {
  const newGrid: Grid = grid.map(row => row.map(s => ({ ...s })));
  const strips = freeSpinMode ? FREE_REEL_STRIPS : BASE_REEL_STRIPS;

  for (let col = 0; col < COLS; col++) {
    const remaining: SymbolDef[] = [];
    for (let row = 0; row < ROWS; row++) {
      if (!winPositions.has(`${row}-${col}`)) {
        remaining.push(newGrid[row][col]);
      }
    }
    const removed = ROWS - remaining.length;
    const newSyms = Array.from({ length: removed }, () => pickFromReel(strips[col]));
    const fullCol = [...newSyms, ...remaining];
    for (let row = 0; row < ROWS; row++) {
      newGrid[row][col] = fullCol[row];
    }
  }
  return newGrid;
}

// ─── Big Win Detection ───
function detectWinTier(totalWin: number, bet: number): string {
  const ratio = totalWin / bet;
  if (ratio >= 100) return 'ultra_win';
  if (ratio >= 50) return 'mega_win';
  if (ratio >= 10) return 'big_win';
  if (ratio > 0) return 'win';
  return 'loss';
}

// ─── Utility ───
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function pickWinPositions(seed: number, total: number, winCount: number): number[] {
  const positions = Array.from({ length: total }, (_, i) => i);
  let s = seed;
  for (let i = positions.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, winCount);
}

// ─── Cascade Step ───
interface CascadeStep {
  grid: SimpleSymbol[][];
  winPositions: string[];
  paylineWins: { paylineIndex: number; symbolId: string; matchCount: number; payout: number }[];
  cascadePayout: number;
  multiplier: number;
}

// ─── Response Types ───
interface SpinResponse {
  initialGrid: SimpleSymbol[][];
  scatterPositions: string[];
  cascadeSteps: CascadeStep[];
  paylineWins: { paylineIndex: number; symbolId: string; matchCount: number; payout: number; positions: [number, number][] }[];
  scatterWin: { count: number; payout: number; positions: [number, number][] };
  bonusFight: BonusFightResult | null;
  totalWin: number;
  newBalance: number;
  winTier: string;
  freeSpins: {
    triggered: boolean;
    remaining: number;
    sessionId: string | null;
    multiplier: number;
  };
}

// ═══════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ─── Auth ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { bet } = await req.json() as { bet: number };

    // Validate bet
    const validBets = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    if (!validBets.includes(bet)) {
      return new Response(JSON.stringify({ error: "Invalid bet amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const betPerLine = bet / 25; // 25 paylines

    // ─── FAST: All initial reads in parallel (casino-grade latency) ───
    const GAME_ID = 'sweet-bonanza';
    const DEFAULT_PROFIT_MARGIN = 25;

    const [
      sessionRes,
      walletRes,
      profitSettingsRes,
      profileRes,
      globalStatsRes,
      gameStatsRes,
      spinCountRes,
    ] = await Promise.all([
      supabase.from("super_ace_sessions").select("*").eq("user_id", user.id).eq("active", true).maybeSingle(),
      supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
      supabase.from("game_profit_settings").select("profit_margin, max_win_multiplier").eq("game_id", GAME_ID).single(),
      supabase.from("profiles").select("forced_result").eq("user_id", user.id).single(),
      supabase.rpc("get_total_bets_and_wins"),
      supabase.from("game_sessions").select("bet_amount, win_amount").eq("game_id", GAME_ID),
      supabase.from("game_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const activeSession = sessionRes.data;
    const wallet = walletRes.data;
    const walletErr = walletRes.error;

    if (walletErr || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFreeSpinMode = !!(activeSession && activeSession.spins_remaining > 0);
    const freeSpinMultiplier = isFreeSpinMode
      ? Math.min(1 + (activeSession!.total_spins_awarded - activeSession!.spins_remaining) * 0.5, 5)
      : 1;

    if (!isFreeSpinMode) {
      if (wallet.balance < bet) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("wallets")
        .update({ balance: wallet.balance - bet, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    // Enforce minimum 5% profit margin, max 40%
    const rawMargin = profitSettingsRes.data ? Number(profitSettingsRes.data.profit_margin) : DEFAULT_PROFIT_MARGIN;
    const profitMargin = Math.max(5, Math.min(40, rawMargin));
    const maxWinMultiplier = profitSettingsRes.data ? Number(profitSettingsRes.data.max_win_multiplier) : 25;
    const profitMarginRatio = profitMargin / 100;
    const forcedResult = profileRes.data?.forced_result ?? null;

    let outcomeType: 'loss' | 'small_win' | 'big_win' | 'mega_win' = 'loss';
    let controlledWinCap = 0;

    if (forcedResult === 'loss') {
      outcomeType = 'loss';
    } else if (forcedResult === 'big_win') {
      outcomeType = 'big_win';
    } else if (forcedResult === 'mega_win') {
      outcomeType = 'mega_win';
    } else if (forcedResult === 'small_win') {
      outcomeType = 'small_win';
    } else if (forcedResult && ['one_big_win','one_mega_win','one_small_win','one_loss'].includes(forcedResult)) {
      const map: Record<string, typeof outcomeType> = { one_big_win: 'big_win', one_mega_win: 'mega_win', one_small_win: 'small_win', one_loss: 'loss' };
      outcomeType = map[forcedResult] || 'loss';
    } else if (!isFreeSpinMode) {
      // Global pool
      const globalStats = globalStatsRes.data;
      let globalTotalBets = 0, globalTotalWins = 0;
      if (globalStats && globalStats.length > 0) {
        globalTotalBets = Number(globalStats[0].total_bets) || 0;
        globalTotalWins = Number(globalStats[0].total_wins) || 0;
      }
      const globalAvailablePool = Math.max(0, globalTotalBets * (1 - profitMarginRatio) - globalTotalWins);
      const globalCurrentProfit = globalTotalBets - globalTotalWins;
      const globalMinimumProfit = globalTotalBets * profitMarginRatio;

      // Per-game pool
      const gameSessions = gameStatsRes.data || [];
      let gameTotalBets = 0, gameTotalWins = 0;
      gameSessions.forEach((s: any) => {
        gameTotalBets += Number(s.bet_amount) || 0;
        gameTotalWins += Number(s.win_amount) || 0;
      });
      const gameAvailablePool = Math.max(0, gameTotalBets * (1 - profitMarginRatio) - gameTotalWins);
      const gameCurrentProfit = gameTotalBets - gameTotalWins;
      const gameMinimumProfit = gameTotalBets * profitMarginRatio;

      const availablePool = Math.min(
        globalAvailablePool > 0 ? globalAvailablePool : 0,
        gameAvailablePool > 0 ? gameAvailablePool : globalAvailablePool
      );

      if (availablePool <= 0 || globalCurrentProfit <= globalMinimumProfit ||
          (gameTotalBets > 0 && gameCurrentProfit <= gameMinimumProfit)) {
        outcomeType = 'loss';
      } else {
        const totalSpins = spinCountRes.count ?? 0;

        const megaPos = totalSpins % 60;
        const megaSeed = hashString(user.id + '_bk_mega_' + Math.floor(totalSpins / 60));
        if (pickWinPositions(megaSeed, 60, 1).includes(megaPos)) {
          outcomeType = 'mega_win';
          controlledWinCap = Math.min(Math.round(bet * (10 + secureRandom() * (maxWinMultiplier - 10))), availablePool);
        } else {
          const bigPos = totalSpins % 40;
          const bigSeed = hashString(user.id + '_bk_big_' + Math.floor(totalSpins / 40));
          if (pickWinPositions(bigSeed, 40, 1).includes(bigPos)) {
            outcomeType = 'big_win';
            controlledWinCap = Math.min(Math.round(bet * (5 + secureRandom() * 3)), availablePool);
          } else {
            const smallPos = totalSpins % 10;
            const smallSeed = hashString(user.id + '_bk_small_' + Math.floor(totalSpins / 10));
            if (pickWinPositions(smallSeed, 10, 3).includes(smallPos)) {
              outcomeType = 'small_win';
              controlledWinCap = Math.min(Math.round(bet * (0.1 + secureRandom() * 0.3)), availablePool);
            } else {
              outcomeType = 'loss';
            }
          }
        }
      }
    }

    // ─── Generate Grid ───
    let initialGrid: Grid;
    if (outcomeType === 'loss' && !isFreeSpinMode) {
      initialGrid = generateNoWinGrid();
    } else if (outcomeType === 'mega_win') {
      initialGrid = generateMegaWinGrid(isFreeSpinMode);
    } else if (outcomeType === 'big_win') {
      initialGrid = generateBigWinGrid(isFreeSpinMode);
    } else if (outcomeType === 'small_win') {
      initialGrid = generateSmallWinGrid(isFreeSpinMode);
    } else {
      initialGrid = generateGrid(isFreeSpinMode);
    }

    // ─── Evaluate Initial Wins ───
    const paylineWins = evaluatePaylineWins(initialGrid, betPerLine);
    const scatterResult = evaluateScatterWins(initialGrid, bet);

    // Collect scatter positions
    const scatterPositions = scatterResult.positions.map(([r, c]) => `${r}-${c}`);

    // ─── Cascade Loop ───
    let currentGrid = initialGrid;
    let totalWin = 0;
    let cascadeNum = 0;
    const cascadeSteps: CascadeStep[] = [];
    const maxWin = bet * MAX_WIN_CAP;

    // Base multipliers increase with cascades
    const cascadeMultipliers = isFreeSpinMode ? [1, 2, 3, 5, 8] : [1, 1.5, 2, 3, 5];

    // First evaluation already done
    let currentPaylineWins = paylineWins;
    let firstRound = true;

    while (true) {
      const wins = firstRound ? currentPaylineWins : evaluatePaylineWins(currentGrid, betPerLine);
      firstRound = false;

      if (wins.length === 0 && cascadeNum > 0) break;
      if (wins.length === 0 && cascadeNum === 0) break;

      const allWinPos = new Set<string>();
      wins.forEach(w => w.positions.forEach(([r, c]) => allWinPos.add(`${r}-${c}`)));

      const mult = cascadeMultipliers[Math.min(cascadeNum, cascadeMultipliers.length - 1)];
      const fsMult = isFreeSpinMode ? freeSpinMultiplier : 1;
      let basePay = wins.reduce((s, w) => s + w.payout, 0);
      let cascadePay = Math.round(basePay * mult * fsMult * 100) / 100;

      // Cap checks
      if (totalWin + cascadePay > maxWin) cascadePay = maxWin - totalWin;
      if (controlledWinCap > 0 && !isFreeSpinMode && totalWin + cascadePay > controlledWinCap) {
        cascadePay = Math.max(0, controlledWinCap - totalWin);
      }
      totalWin += cascadePay;

      cascadeSteps.push({
        grid: simplifyGrid(currentGrid),
        winPositions: Array.from(allWinPos),
        paylineWins: wins.map(w => ({ paylineIndex: w.paylineIndex, symbolId: w.symbolId, matchCount: w.matchCount, payout: w.payout })),
        cascadePayout: cascadePay,
        multiplier: mult,
      });

      if (allWinPos.size === 0) break;

      // Cascade
      currentGrid = cascadeGrid(currentGrid, allWinPos, isFreeSpinMode);
      cascadeNum++;

      // Re-evaluate for next cascade
      currentPaylineWins = evaluatePaylineWins(currentGrid, betPerLine);

      if (cascadeNum >= 20 || totalWin >= maxWin) break;
      if (currentPaylineWins.length === 0) break;
    }

    // Add scatter payout
    if (scatterResult.payout > 0) {
      totalWin += scatterResult.payout;
    }

    // ─── Bonus Fight (4+ scatters) ───
    let bonusFight: BonusFightResult | null = null;
    if (scatterResult.count >= 4) {
      bonusFight = resolveBonusFight();
      // Bonus fight multiplies the total win so far (or trigger bet if no win)
      const fightBase = totalWin > 0 ? totalWin : bet;
      const fightWin = Math.round(fightBase * bonusFight.multiplier);
      // Cap
      const cappedFightWin = Math.min(fightWin, maxWin - totalWin);
      totalWin += cappedFightWin;
    }

    // ─── Free Spin Logic + newBalance + parallel writes ───
    let freeSpinTriggered = false;
    let freeSpinSessionId: string | null = activeSession?.id ?? null;
    let spinsRemaining = activeSession?.spins_remaining ?? 0;

    const needsForcedResultClear = forcedResult && forcedResult !== 'persistent_loss';
    let newSessionData: { id: string } | null = null;
    const writePromises: Promise<unknown>[] = [];

    if (scatterResult.count >= FREE_SPIN_TRIGGER) {
      freeSpinTriggered = true;
      if (activeSession) {
        spinsRemaining = (activeSession.spins_remaining - 1) + FREE_SPIN_AWARD;
        writePromises.push(
          supabase.from("super_ace_sessions").update({
            spins_remaining: spinsRemaining,
            total_spins_awarded: activeSession.total_spins_awarded + FREE_SPIN_AWARD,
            updated_at: new Date().toISOString(),
          }).eq("id", activeSession.id)
        );
      } else {
        const insertP = supabase.from("super_ace_sessions")
          .insert({ user_id: user.id, spins_remaining: FREE_SPIN_AWARD, total_spins_awarded: FREE_SPIN_AWARD })
          .select("id").single();
        writePromises.push(insertP.then((r: { data?: { id: string } }) => { if (r?.data) newSessionData = r.data; return r; }));
        spinsRemaining = FREE_SPIN_AWARD;
      }
    } else if (isFreeSpinMode && activeSession) {
      spinsRemaining = activeSession.spins_remaining - 1;
      if (spinsRemaining <= 0) {
        writePromises.push(
          supabase.from("super_ace_sessions").update({ spins_remaining: 0, active: false, updated_at: new Date().toISOString() }).eq("id", activeSession.id)
        );
        spinsRemaining = 0;
        freeSpinSessionId = null;
      } else {
        writePromises.push(
          supabase.from("super_ace_sessions").update({ spins_remaining: spinsRemaining, updated_at: new Date().toISOString() }).eq("id", activeSession.id)
        );
      }
    }

    let newBalance = isFreeSpinMode ? wallet.balance : wallet.balance - bet;
    if (newBalance < 0) newBalance = 0;
    if (totalWin > 0) {
      newBalance += totalWin;
      writePromises.push(
        supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("user_id", user.id)
      );
    }

    const winTier = detectWinTier(totalWin, bet);
    writePromises.push(
      supabase.from("game_sessions").insert({
        user_id: user.id,
        game_type: "slot",
        game_name: "Boxing King",
        game_id: GAME_ID,
        bet_amount: isFreeSpinMode ? 0 : bet,
        win_amount: totalWin,
        result: totalWin > 0 ? "win" : "loss",
        multiplier: totalWin > 0 ? totalWin / bet : 0,
      })
    );

    writePromises.push(
      supabase.from("super_ace_spin_logs").insert({
        user_id: user.id,
        bet_amount: isFreeSpinMode ? 0 : bet,
        total_win: totalWin,
        cascades: cascadeNum,
        free_spin_mode: isFreeSpinMode,
        grid_result: simplifyGrid(initialGrid),
      })
    );

    if (needsForcedResultClear) {
      writePromises.push(
        supabase.from("profiles").update({ forced_result: null, updated_at: new Date().toISOString() }).eq("user_id", user.id)
      );
    }

    // ─── FAST: All writes in parallel (casino-grade latency) ───
    await Promise.all(writePromises);

    if (newSessionData) freeSpinSessionId = newSessionData.id;

    const response: SpinResponse = {
      initialGrid: simplifyGrid(initialGrid),
      scatterPositions,
      cascadeSteps,
      paylineWins: paylineWins.map(w => ({
        paylineIndex: w.paylineIndex,
        symbolId: w.symbolId,
        matchCount: w.matchCount,
        payout: w.payout,
        positions: w.positions,
      })),
      scatterWin: scatterResult,
      bonusFight,
      totalWin,
      newBalance,
      winTier,
      freeSpins: {
        triggered: freeSpinTriggered,
        remaining: spinsRemaining,
        sessionId: freeSpinSessionId,
        multiplier: freeSpinMultiplier,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Boxing King spin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
