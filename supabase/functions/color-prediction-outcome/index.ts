import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * color-prediction-outcome: HGZY-style Color Prediction Game
 * 
 * Profit-maximizing logic:
 * 1. Determines winning number (0-9), maps to color
 * 2. Picks the outcome that minimizes platform payout
 * 3. Uses per-game profit pool from game-outcome pattern
 * 4. Supports "killing streak" — consecutive winners get harder odds
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xffffffff + 1);
}

// Color mapping: even=Red, odd=Green, 0&5=Violet overlap
function numberToColor(num: number): string {
  if (num === 0 || num === 5) return "violet"; // Also has red(0) or green(5)
  return num % 2 === 0 ? "red" : "green";
}

function numberToColors(num: number): string[] {
  if (num === 0) return ["red", "violet"];
  if (num === 5) return ["green", "violet"];
  return num % 2 === 0 ? ["red"] : ["green"];
}

// Calculate payout for a given bet against a winning number
function calculatePayout(
  betType: string, // 'color' or 'number'
  betValue: string, // 'red'/'green'/'violet' or '0'-'9'
  winningNumber: number,
  betAmount: number
): number {
  const winColors = numberToColors(winningNumber);

  if (betType === "number") {
    if (parseInt(betValue) === winningNumber) return betAmount * 9;
    return 0;
  }

  if (betType === "color") {
    if (betValue === "violet" && winColors.includes("violet")) {
      return betAmount * 4.5;
    }
    if (betValue === "red" && winColors.includes("red")) {
      // If number is 0 (red+violet), reduced payout
      if (winningNumber === 0) return betAmount * 1.5;
      return betAmount * 2;
    }
    if (betValue === "green" && winColors.includes("green")) {
      // If number is 5 (green+violet), reduced payout
      if (winningNumber === 5) return betAmount * 1.5;
      return betAmount * 2;
    }
  }

  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode JWT locally — no network call, no flaky auth server
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64));
      if (!payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) {
        throw new Error("Token expired or invalid");
      }
      userId = payload.sub;
    } catch (e) {
      console.error("JWT decode error:", e);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bet_amount, bet_type, bet_value, period_id } = await req.json();

    if (!bet_amount || bet_amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid bet amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gameId = "color-prediction";

    // ─── Fetch profit settings & pools in parallel ───
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const [profitSettingsRes, globalStatsRes, windowRes, recentWinsRes] = await Promise.all([
      supabase.from("game_profit_settings")
        .select("profit_margin, max_win_multiplier, loss_rate")
        .eq("game_id", gameId).single(),
      supabase.rpc("get_total_bets_and_wins"),
      supabase.from("game_sessions")
        .select("bet_amount, win_amount")
        .eq("game_id", gameId)
        .gte("created_at", fiveMinAgo),
      // Killing streak: check user's recent consecutive wins
      supabase.from("game_sessions")
        .select("result")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const profitSettings = profitSettingsRes.data || { profit_margin: 25, max_win_multiplier: 9, loss_rate: 70 };
    const configMarginRatio = Math.max(5, Math.min(40, Number(profitSettings.profit_margin))) / 100;
    const lossRate = Math.max(50, Math.min(99, Number(profitSettings.loss_rate ?? 70)));

    // ─── Global profit check ───
    const globalStats = globalStatsRes.data;
    let globalTotalBets = 0, globalTotalWins = 0;
    if (globalStats && globalStats.length > 0) {
      globalTotalBets = Number(globalStats[0].total_bets) || 0;
      globalTotalWins = Number(globalStats[0].total_wins) || 0;
    }
    const globalAvailablePool = Math.max(0, globalTotalBets * (1 - configMarginRatio) - globalTotalWins);

    // ─── 5-min window pool ───
    const windowSessions = windowRes.data || [];
    let windowBets = 0, windowWins = 0;
    windowSessions.forEach((s: any) => {
      windowBets += Number(s.bet_amount) || 0;
      windowWins += Number(s.win_amount) || 0;
    });
    windowBets += bet_amount;
    const windowPool = Math.max(0, windowBets * (1 - configMarginRatio) - windowWins);

    const availablePool = Math.min(globalAvailablePool, windowPool);

    // ─── Killing streak detection ───
    const recentResults = (recentWinsRes.data || []).map((r: any) => r.result);
    let consecutiveWins = 0;
    for (const r of recentResults) {
      if (r === "win") consecutiveWins++;
      else break;
    }
    // Increase loss rate for streak players
    const streakPenalty = Math.min(consecutiveWins * 8, 25); // Max +25% penalty
    const effectiveLossRate = Math.min(98, lossRate + streakPenalty);

    // ─── Determine outcome ───
    const roll = secureRandom() * 100;
    const isLoss = roll < effectiveLossRate || availablePool < bet_amount * 0.5;

    let winningNumber: number;

    if (isLoss) {
      // Pick a number that does NOT match the user's bet → guaranteed loss
      const losingNumbers = [];
      for (let n = 0; n <= 9; n++) {
        const payout = calculatePayout(bet_type, bet_value, n, bet_amount);
        if (payout === 0) losingNumbers.push(n);
      }
      if (losingNumbers.length > 0) {
        winningNumber = losingNumbers[Math.floor(secureRandom() * losingNumbers.length)];
      } else {
        // Edge case: all numbers pay (shouldn't happen), pick random
        winningNumber = Math.floor(secureRandom() * 10);
      }
    } else {
      // Win — pick a number that matches the bet but minimize payout
      const winningNumbers = [];
      for (let n = 0; n <= 9; n++) {
        const payout = calculatePayout(bet_type, bet_value, n, bet_amount);
        if (payout > 0) winningNumbers.push({ number: n, payout });
      }
      
      if (winningNumbers.length === 0) {
        // No winning number possible (shouldn't happen), random loss
        winningNumber = Math.floor(secureRandom() * 10);
      } else {
        // Pick the winning number with minimum payout (profit maximizing)
        winningNumbers.sort((a, b) => a.payout - b.payout);
        winningNumber = winningNumbers[0].number;
        
        // Cap win at available pool
        const winPayout = winningNumbers[0].payout;
        if (winPayout > availablePool) {
          // Can't afford this win — force loss
          const losingNumbers = [];
          for (let n = 0; n <= 9; n++) {
            if (calculatePayout(bet_type, bet_value, n, bet_amount) === 0) losingNumbers.push(n);
          }
          winningNumber = losingNumbers.length > 0
            ? losingNumbers[Math.floor(secureRandom() * losingNumbers.length)]
            : Math.floor(secureRandom() * 10);
        }
      }
    }

    const winningColor = numberToColor(winningNumber);
    const winningColors = numberToColors(winningNumber);
    const payout = calculatePayout(bet_type, bet_value, winningNumber, bet_amount);
    const isWin = payout > 0;

    return new Response(JSON.stringify({
      winning_number: winningNumber,
      winning_color: winningColor,
      winning_colors: winningColors,
      payout,
      is_win: isWin,
      period_id,
      streak_penalty: streakPenalty,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("color-prediction-outcome error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
