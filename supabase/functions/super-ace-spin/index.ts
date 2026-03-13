import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Symbol Configuration ───
interface SymbolDef {
  id: string;
  label: string;
  payout: { 3: number; 4: number; 5: number };
  weight: number;
  isWild: boolean;
  isScatter: boolean;
  isGolden: boolean;
}

const NORMAL_SYMBOLS: SymbolDef[] = [
  { id: 'spade', label: '♠', payout: { 3: 1, 4: 2, 5: 4 }, weight: 18, isWild: false, isScatter: false, isGolden: false },
  { id: 'heart', label: '♥', payout: { 3: 1, 4: 2, 5: 4 }, weight: 18, isWild: false, isScatter: false, isGolden: false },
  { id: 'club', label: '♣', payout: { 3: 1, 4: 2, 5: 4 }, weight: 18, isWild: false, isScatter: false, isGolden: false },
  { id: 'diamond', label: '♦', payout: { 3: 1.2, 4: 2.5, 5: 5 }, weight: 16, isWild: false, isScatter: false, isGolden: false },
  { id: 'jack', label: 'J', payout: { 3: 1.5, 4: 3, 5: 6 }, weight: 14, isWild: false, isScatter: false, isGolden: false },
  { id: 'queen', label: 'Q', payout: { 3: 2, 4: 4, 5: 8 }, weight: 12, isWild: false, isScatter: false, isGolden: false },
  { id: 'king', label: 'K', payout: { 3: 2.5, 4: 5, 5: 10 }, weight: 10, isWild: false, isScatter: false, isGolden: false },
  { id: 'ace', label: 'A', payout: { 3: 4, 4: 8, 5: 20 }, weight: 8, isWild: false, isScatter: false, isGolden: false },
];

const JOKER_WILD: SymbolDef = { id: 'joker', label: 'W', payout: { 3: 0, 4: 0, 5: 0 }, weight: 3, isWild: true, isScatter: false, isGolden: false };
const SCATTER: SymbolDef = { id: 'scatter', label: 'S', payout: { 3: 5, 4: 20, 5: 100 }, weight: 1, isWild: false, isScatter: true, isGolden: false };

const ALL_SYMBOLS: SymbolDef[] = [...NORMAL_SYMBOLS, JOKER_WILD, SCATTER];
const TOTAL_WEIGHT = ALL_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
const FREE_SPIN_WEIGHT_OVERRIDES: Record<string, number> = { scatter: 2, joker: 5 };

const ROWS = 4;
const COLS = 5;
const BASE_MULTIPLIERS = [1, 2, 3, 5];
const FREE_MULTIPLIERS = [2, 4, 6, 10];
const MAX_WIN_CAP = 10000; // 10,000x bet — matches JILI original
const FREE_SPIN_TRIGGER = 3;
const FREE_SPIN_AWARD = 10;
const FREE_SPIN_RETRIGGER_AWARD = 5; // JILI original: retrigger gives +5, not +10

// ─── Secure RNG ───
function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xFFFFFFFF + 1);
}

// ─── Symbol Picker (weighted) ───
function pickSymbol(freeSpinMode = false): SymbolDef {
  let symbols = ALL_SYMBOLS;
  let totalW = TOTAL_WEIGHT;

  if (freeSpinMode) {
    symbols = ALL_SYMBOLS.map(s => {
      const ow = FREE_SPIN_WEIGHT_OVERRIDES[s.id];
      return ow !== undefined ? { ...s, weight: ow } : s;
    });
    totalW = symbols.reduce((a, s) => a + s.weight, 0);
  }

  let r = secureRandom() * totalW;
  for (const sym of symbols) {
    r -= sym.weight;
    if (r <= 0) return { ...sym };
  }
  return { ...symbols[symbols.length - 1] };
}

// ─── Grid Generation ───
type Grid = SymbolDef[][];

function generateGrid(freeSpinMode = false, goldenChance = 0.08): Grid {
  const grid: Grid = [];
  for (let row = 0; row < ROWS; row++) {
    const rowArr: SymbolDef[] = [];
    for (let col = 0; col < COLS; col++) {
      const sym = pickSymbol(freeSpinMode);
      // Golden cards only on reels 2-4
      if (!sym.isWild && !sym.isScatter && col >= 1 && col <= 3) {
        const gc = freeSpinMode ? goldenChance * 1.5 : goldenChance;
        if (secureRandom() < gc) {
          sym.isGolden = true;
        }
      }
      rowArr.push(sym);
    }
    grid.push(rowArr);
  }
  return grid;
}

// ─── No-Win Grid (for forced loss) ───
function generateNoWinGrid(freeSpinMode = false): Grid {
  // Ensure no symbol appears in 3+ consecutive reels from left
  const grid: Grid = [];
  for (let row = 0; row < ROWS; row++) {
    grid.push([]);
  }

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      let sym: SymbolDef;
      let attempts = 0;
      do {
        // Pick from normal symbols only (no scatter, no wild)
        const idx = Math.floor(secureRandom() * NORMAL_SYMBOLS.length);
        sym = { ...NORMAL_SYMBOLS[idx] };
        attempts++;
        // If col >= 2, ensure this symbol doesn't create a 3-match with cols 0..col-1
      } while (col >= 2 && wouldCreateWin(grid, row, col, sym) && attempts < 50);
      grid[row].push(sym);
    }
  }
  return grid;
}

function wouldCreateWin(grid: Grid, row: number, col: number, sym: SymbolDef): boolean {
  // Check if placing sym at [row][col] would allow a 3+ reel consecutive match
  // For simplicity: ensure no symbol matches across all 3 leftmost reels in any row path
  if (col < 2) return false;
  // Check if reels 0..col all have this symbol (or wild) in at least one row position
  for (let c = 0; c < col; c++) {
    let hasMatch = false;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] && (grid[r][c].id === sym.id || grid[r][c].isWild)) {
        hasMatch = true;
        break;
      }
    }
    if (!hasMatch) return false; // No continuous path, safe
  }
  return true; // All previous reels have this symbol — would create a win
}

// ─── Forced Win Grid (for mega_win / big_win) ───
function generateForcedWinGrid(freeSpinMode = false, isMega = false): Grid {
  const grid: Grid = [];
  // Pick a high-value symbol to fill across all 5 reels
  const highSymbols = isMega
    ? NORMAL_SYMBOLS.filter(s => s.id === 'ace' || s.id === 'king')
    : NORMAL_SYMBOLS.filter(s => s.id === 'queen' || s.id === 'king');
  const winSym = highSymbols[Math.floor(secureRandom() * highSymbols.length)];

  for (let row = 0; row < ROWS; row++) {
    const rowArr: SymbolDef[] = [];
    for (let col = 0; col < COLS; col++) {
      if (row === 0) {
        // First row: all same symbol for guaranteed 5-way match
        rowArr.push({ ...winSym });
      } else if (isMega && row === 1) {
        // Second row also matches for mega (more ways)
        rowArr.push({ ...winSym });
      } else {
        // Fill randomly
        rowArr.push(pickSymbol(freeSpinMode));
      }
    }
    grid.push(rowArr);
  }
  return grid;
}

// ─── Small Win Grid (for controlled wins — 3-match with low-value symbol) ───
function generateSmallWinGrid(freeSpinMode = false): Grid {
  const grid: Grid = [];
  // Use a low-value symbol for small payout
  const lowSymbols = NORMAL_SYMBOLS.filter(s => ['spade', 'heart', 'club'].includes(s.id));
  const winSym = lowSymbols[Math.floor(secureRandom() * lowSymbols.length)];

  for (let row = 0; row < ROWS; row++) {
    const rowArr: SymbolDef[] = [];
    for (let col = 0; col < COLS; col++) {
      if (row === 0 && col < 3) {
        // First row, first 3 reels: same low symbol for guaranteed 3-way match
        rowArr.push({ ...winSym });
      } else {
        // Fill randomly but avoid extending the win
        let sym: SymbolDef;
        let attempts = 0;
        do {
          sym = pickSymbol(freeSpinMode);
          attempts++;
        } while (sym.id === winSym.id && col >= 3 && row === 0 && attempts < 20);
        rowArr.push(sym);
      }
    }
    grid.push(rowArr);
  }
  return grid;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

function pickWinPositions(seed: number, total: number, winCount: number): number[] {
  // Seeded shuffle to pick winCount positions from 0..total-1
  const positions = Array.from({ length: total }, (_, i) => i);
  let s = seed;
  for (let i = positions.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, winCount);
}

interface SimpleSymbol {
  id: string;
  isWild: boolean;
  isScatter: boolean;
  isGolden: boolean;
}

function simplifyGrid(grid: Grid): SimpleSymbol[][] {
  return grid.map(row => row.map(s => ({
    id: s.id, isWild: s.isWild, isScatter: s.isScatter, isGolden: s.isGolden,
  })));
}

// ─── Win Evaluation (1024-ways) ───
interface WinResult {
  symbolId: string;
  matchCount: number;
  ways: number;
  positions: [number, number][];
  basePayout: number;
}

function evaluateWins(grid: Grid, bet: number): WinResult[] {
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
    const payKey = matchCount as 3 | 4 | 5;
    const payPerWay = sym.payout[payKey] ?? sym.payout[5];
    const basePayout = Math.round((bet * payPerWay * ways) / 10);

    if (basePayout > 0) {
      wins.push({
        symbolId: sym.id,
        matchCount,
        ways,
        positions: reelMatches.flat(),
        basePayout,
      });
    }
  }

  return wins;
}

// ─── Find Scatters ───
function findScatters(grid: Grid): [number, number][] {
  const pos: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c].isScatter) pos.push([r, c]);
  return pos;
}

// ─── Win position set ───
function getWinPosSet(wins: WinResult[]): Set<string> {
  const s = new Set<string>();
  wins.forEach(w => w.positions.forEach(([r, c]) => s.add(`${r}-${c}`)));
  return s;
}

// ─── Golden Card Conversion ───
function applyGoldenConversion(
  grid: Grid,
  winPositions: Set<string>,
  alreadyConverted: Set<string>
): { grid: Grid; newConversions: string[]; jokerType: 'big' | 'little' | 'none' } {
  const newGrid: Grid = grid.map(row => row.map(s => ({ ...s })));
  const newConversions: string[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r}-${c}`;
      if (newGrid[r][c].isGolden && winPositions.has(key) && !alreadyConverted.has(key)) {
        newGrid[r][c] = { ...JOKER_WILD };
        newConversions.push(key);
      }
    }
  }

  // Determine Joker type: Big (50% chance) or Little
  let jokerType: 'big' | 'little' | 'none' = 'none';
  if (newConversions.length > 0) {
    jokerType = secureRandom() < 0.5 ? 'big' : 'little';
  }

  // Big Joker: randomly convert 1-4 additional symbols on reels 2-5 to Wild
  if (jokerType === 'big') {
    const convertCount = 1 + Math.floor(secureRandom() * 4); // 1 to 4
    const candidates: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 1; c < COLS; c++) { // reels 2-5 (index 1-4)
        if (!newGrid[r][c].isWild && !newGrid[r][c].isScatter && !winPositions.has(`${r}-${c}`)) {
          candidates.push([r, c]);
        }
      }
    }
    // Shuffle and pick
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const toConvert = candidates.slice(0, Math.min(convertCount, candidates.length));
    for (const [r, c] of toConvert) {
      newGrid[r][c] = { ...JOKER_WILD };
      newConversions.push(`${r}-${c}`);
    }
  }
  // Little Joker: only the golden→joker conversion happens (already done above)

  return { grid: newGrid, newConversions, jokerType };
}

// ─── Cascade Grid ───
function cascadeGrid(grid: Grid, winPositions: Set<string>, freeSpinMode = false): Grid {
  const newGrid: Grid = grid.map(row => row.map(s => ({ ...s })));

  for (let col = 0; col < COLS; col++) {
    const remaining: SymbolDef[] = [];
    for (let row = 0; row < ROWS; row++) {
      if (!winPositions.has(`${row}-${col}`)) {
        remaining.push(newGrid[row][col]);
      }
    }
    const removed = ROWS - remaining.length;
    const newSyms = Array.from({ length: removed }, () => pickSymbol(freeSpinMode));
    const fullCol = [...newSyms, ...remaining];
    for (let row = 0; row < ROWS; row++) {
      newGrid[row][col] = fullCol[row];
    }
  }

  return newGrid;
}

// ─── Cascade Step (for frontend animation) ───
interface CascadeStep {
  grid: SimpleSymbol[][];
  winPositions: string[];
  cascadePayout: number;
  multiplier: number;
  goldenConversions: string[];
}

// ─── Main Spin Logic ───
interface SpinRequest {
  bet: number;
}

interface SpinResponse {
  initialGrid: SimpleSymbol[][];
  goldenPositions: string[];
  scatterPositions: string[];
  cascadeSteps: CascadeStep[];
  totalWin: number;
  newBalance: number;
  freeSpins: {
    triggered: boolean;
    remaining: number;
    sessionId: string | null;
  };
}

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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User client for auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseUser.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    // Service client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bet } = await req.json() as SpinRequest;

    // Validate bet
    const validBets = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    if (!validBets.includes(bet)) {
      return new Response(JSON.stringify({ error: "Invalid bet amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── FAST: All initial reads in parallel (casino-grade latency) ───
    const GAME_ID = 'super-ace';
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

    // Deduct bet (skip in free spin mode)
    if (!isFreeSpinMode) {
      if (wallet.balance < bet) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase
        .from("wallets")
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

        // Mega win: 1 per 60 spins
        const megaPos = totalSpins % 60;
        const megaSeed = hashString(user.id + '_mega_' + Math.floor(totalSpins / 60));
        if (pickWinPositions(megaSeed, 60, 1).includes(megaPos)) {
          outcomeType = 'mega_win';
          controlledWinCap = Math.min(Math.round(bet * (10 + secureRandom() * (maxWinMultiplier - 10))), availablePool);
        }
        // Big win: 1 per 40 spins
        else {
          const bigPos = totalSpins % 40;
          const bigSeed = hashString(user.id + '_big_' + Math.floor(totalSpins / 40));
          if (pickWinPositions(bigSeed, 40, 1).includes(bigPos)) {
            outcomeType = 'big_win';
            controlledWinCap = Math.min(Math.round(bet * (5 + secureRandom() * 3)), availablePool);
          }
          // Small win: 3 per 10 spins (~30% win rate)
          else {
            const smallPos = totalSpins % 10;
            const smallSeed = hashString(user.id + '_small_' + Math.floor(totalSpins / 10));
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

    // ─── Generate Grid based on outcome ───
    let initialGrid: Grid;

    if (outcomeType === 'loss' && !isFreeSpinMode) {
      initialGrid = generateNoWinGrid(isFreeSpinMode);
    } else if (outcomeType === 'mega_win') {
      initialGrid = generateForcedWinGrid(isFreeSpinMode, true);
    } else if (outcomeType === 'big_win') {
      initialGrid = generateForcedWinGrid(isFreeSpinMode, false);
    } else if (outcomeType === 'small_win') {
      initialGrid = generateGrid(isFreeSpinMode);
      const testWins = evaluateWins(initialGrid, bet);
      if (testWins.length === 0) {
        initialGrid = generateSmallWinGrid(isFreeSpinMode);
      }
    } else {
      initialGrid = generateGrid(isFreeSpinMode);
    }

    // Collect golden & scatter positions
    const goldenPositions: string[] = [];
    const scatterPositions: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (initialGrid[r][c].isGolden) goldenPositions.push(`${r}-${c}`);
        if (initialGrid[r][c].isScatter) scatterPositions.push(`${r}-${c}`);
      }
    }

    // ─── Cascade Loop ───
    let currentGrid = initialGrid;
    let totalWin = 0;
    let cascadeNum = 0;
    const cascadeSteps: CascadeStep[] = [];
    const goldenConverted = new Set<string>();
    const multipliers = isFreeSpinMode ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;
    const maxWin = bet * MAX_WIN_CAP;

    while (true) {
      const wins = evaluateWins(currentGrid, bet);
      if (wins.length === 0) break;

      const allWinPos = getWinPosSet(wins);
      const mult = multipliers[Math.min(cascadeNum, multipliers.length - 1)];
      const basePay = wins.reduce((s, w) => s + w.basePayout, 0);
      let cascadePay = Math.round(basePay * mult);

      // Max win cap check
      if (totalWin + cascadePay > maxWin) {
        cascadePay = maxWin - totalWin;
      }

      // Profit-based: cap total win
      if (controlledWinCap > 0 && !isFreeSpinMode) {
        if (totalWin + cascadePay > controlledWinCap) {
          cascadePay = Math.max(0, controlledWinCap - totalWin);
        }
      }
      totalWin += cascadePay;

      // Golden conversion (Big/Little Joker mechanic)
      const { grid: convertedGrid, newConversions, jokerType } =
        applyGoldenConversion(currentGrid, allWinPos, goldenConverted);
      newConversions.forEach(k => goldenConverted.add(k));

      cascadeSteps.push({
        grid: simplifyGrid(currentGrid),
        winPositions: Array.from(allWinPos),
        cascadePayout: cascadePay,
        multiplier: mult,
        goldenConversions: newConversions,
      });

      // Cascade: remove winners, gravity drop, fill new
      currentGrid = cascadeGrid(convertedGrid, allWinPos, isFreeSpinMode);
      cascadeNum++;

      // Safety: max 20 cascades
      if (cascadeNum >= 20 || totalWin >= maxWin) break;
    }

    // ─── Free Spin Logic + newBalance ───
    let freeSpinTriggered = false;
    let freeSpinSessionId: string | null = activeSession?.id ?? null;
    let spinsRemaining = activeSession?.spins_remaining ?? 0;

    // Free spin only when 3+ scatters are in the final settled grid (after cascade)
    const scatters = findScatters(currentGrid);
    const needsForcedResultClear = forcedResult && ['one_big_win','one_mega_win','one_small_win','one_loss'].includes(forcedResult);

    let newSessionData: { id: string } | null = null;
    const writePromises: Promise<unknown>[] = [];

    if (scatters.length >= FREE_SPIN_TRIGGER) {
      freeSpinTriggered = true;
      if (activeSession) {
        spinsRemaining = (activeSession.spins_remaining - 1) + FREE_SPIN_RETRIGGER_AWARD;
        writePromises.push(
          supabase.from("super_ace_sessions").update({
            spins_remaining: spinsRemaining,
            total_spins_awarded: activeSession.total_spins_awarded + FREE_SPIN_RETRIGGER_AWARD,
            updated_at: new Date().toISOString(),
          }).eq("id", activeSession.id)
        );
      } else {
        const insertP = supabase.from("super_ace_sessions").insert({
          user_id: user.id,
          spins_remaining: FREE_SPIN_AWARD,
          total_spins_awarded: FREE_SPIN_AWARD,
        }).select("id").single();
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

    writePromises.push(
      supabase.from("game_sessions").insert({
        user_id: user.id,
        game_type: "slot",
        game_name: "Super Ace",
        game_id: GAME_ID,
        bet_amount: isFreeSpinMode ? 0 : bet,
        win_amount: totalWin,
        result: totalWin > 0 ? "win" : "loss",
        multiplier: totalWin > 0 && cascadeSteps.length > 0 ? cascadeSteps[cascadeSteps.length - 1].multiplier : 1,
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
      writePromises.push(supabase.from("profiles").update({ forced_result: null }).eq("user_id", user.id));
    }

    // ─── FAST: All writes in parallel (casino-grade latency) ───
    await Promise.all(writePromises);

    if (newSessionData) freeSpinSessionId = newSessionData.id;

    const response: SpinResponse = {
      initialGrid: simplifyGrid(initialGrid),
      goldenPositions,
      scatterPositions,
      cascadeSteps,
      totalWin,
      newBalance,
      freeSpins: {
        triggered: freeSpinTriggered,
        remaining: spinsRemaining,
        sessionId: freeSpinSessionId,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Super Ace spin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
