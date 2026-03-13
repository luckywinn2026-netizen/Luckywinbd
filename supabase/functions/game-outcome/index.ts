import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * game-outcome v2: Pool-Based Casino Reward System
 * 
 * Features:
 * 1. Server-side RNG with configurable probability tiers
 * 2. Global reward pools (Small/Medium/Big/Jackpot) funded by each bet
 * 3. Pool-based payouts — wins come from appropriate pool, downgrade if insufficient
 * 4. User cooldown tracking — prevents same user from repeated big/jackpot wins
 * 5. Global jackpot distribution across user base
 * 6. Max win cap per bet (configurable, default 200x)
 * 7. Admin-configurable profit margin (15-40%) with automatic RTP maintenance
 * 8. Triple-layer profit protection: global, per-game, and pool-based
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

export interface GameOutcome {
  outcome: "loss" | "small_win" | "medium_win" | "big_win" | "mega_win";
  maxWinAmount: number;
  availablePool: number;
  multiplier?: number;
  poolUsed?: string;
}

interface GameProfitSettings {
  profit_margin: number;
  max_win_multiplier: number;
  loss_rate: number;
  small_win_pool_pct: number;
  medium_win_pool_pct: number;
  big_win_pool_pct: number;
  jackpot_pool_pct: number;
  max_win_cap: number;
  jackpot_cooldown_hours: number;
  big_win_cooldown_hours: number;
  small_win_pct: number;
  medium_win_pct: number;
  big_win_pct: number;
  jackpot_win_pct: number;
}

const DEFAULT_SETTINGS: GameProfitSettings = {
  profit_margin: 25,
  max_win_multiplier: 25,
  loss_rate: 60,
  small_win_pool_pct: 30,
  medium_win_pool_pct: 20,
  big_win_pool_pct: 10,
  jackpot_pool_pct: 5,
  max_win_cap: 200,
  jackpot_cooldown_hours: 48,
  big_win_cooldown_hours: 24,
  small_win_pct: 25,
  medium_win_pct: 10,
  big_win_pct: 4,
  jackpot_win_pct: 1,
};

async function getGameProfitSettings(
  supabase: ReturnType<typeof createClient>,
  gameId: string
): Promise<GameProfitSettings> {
  const { data } = await supabase
    .from("game_profit_settings")
    .select("*")
    .eq("game_id", gameId)
    .single();

  if (data) {
    return {
      profit_margin: Math.max(15, Math.min(40, Number(data.profit_margin))),
      max_win_multiplier: Number(data.max_win_multiplier || 25),
      loss_rate: Math.max(40, Math.min(90, Number(data.loss_rate ?? 60))),
      small_win_pool_pct: Number(data.small_win_pool_pct ?? 30),
      medium_win_pool_pct: Number(data.medium_win_pool_pct ?? 20),
      big_win_pool_pct: Number(data.big_win_pool_pct ?? 10),
      jackpot_pool_pct: Number(data.jackpot_pool_pct ?? 5),
      max_win_cap: Number(data.max_win_cap ?? 200),
      jackpot_cooldown_hours: Number(data.jackpot_cooldown_hours ?? 48),
      big_win_cooldown_hours: Number(data.big_win_cooldown_hours ?? 24),
      small_win_pct: Number(data.small_win_pct ?? 25),
      medium_win_pct: Number(data.medium_win_pct ?? 10),
      big_win_pct: Number(data.big_win_pct ?? 4),
      jackpot_win_pct: Number(data.jackpot_win_pct ?? 1),
    };
  }
  return DEFAULT_SETTINGS;
}

interface PoolBalances {
  small_win: number;
  medium_win: number;
  big_win: number;
  jackpot: number;
}

async function getPoolBalances(supabase: ReturnType<typeof createClient>): Promise<PoolBalances> {
  const { data } = await supabase.from("reward_pools").select("pool_type, balance");
  const pools: PoolBalances = { small_win: 0, medium_win: 0, big_win: 0, jackpot: 0 };
  if (data) {
    data.forEach((p: any) => {
      if (p.pool_type in pools) pools[p.pool_type as keyof PoolBalances] = Number(p.balance);
    });
  }
  return pools;
}

/**
 * Check cooldown: user is on cooldown if they won within cooldownHours
 * AND the relevant pool hasn't refilled enough since their last win.
 * "Pool refill" = current pool balance >= the amount they won last time (pool recovered).
 */
async function checkUserCooldown(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  winType: string,
  cooldownHours: number,
  currentPoolBalance: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("user_win_cooldowns")
    .select("id, win_amount")
    .eq("user_id", userId)
    .eq("win_type", winType)
    .gte("last_win_at", cutoff)
    .order("last_win_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return false; // No recent win → no cooldown

  // Pool refill bypass: if pool has recovered to at least the last win amount, lift cooldown
  const lastWinAmount = Number(data[0].win_amount) || 0;
  if (currentPoolBalance >= lastWinAmount) {
    console.log(`[COOLDOWN BYPASS] user=${userId} type=${winType} pool=${currentPoolBalance} >= lastWin=${lastWinAmount}`);
    return false; // Pool refilled → cooldown lifted
  }

  return true; // Still on cooldown
}

async function recordUserWin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  winType: string,
  winAmount: number,
  gameId: string
): Promise<void> {
  await supabase.from("user_win_cooldowns").insert({
    user_id: userId,
    win_type: winType,
    win_amount: winAmount,
    game_id: gameId,
    last_win_at: new Date().toISOString(),
  });
}

export async function calculateOutcome(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  betAmount: number,
  gameType: string,
  gameId: string
): Promise<GameOutcome> {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // ─── Run ALL queries in parallel ───
  const [profileRes, globalStatsRes, profitSettings, pools, todayGameRes] = await Promise.all([
    supabase.from("profiles").select("forced_result").eq("user_id", userId).single(),
    supabase.rpc("get_total_bets_and_wins"),
    getGameProfitSettings(supabase, gameId),
    getPoolBalances(supabase),
    supabase.from("game_sessions")
      .select("bet_amount, win_amount")
      .eq("game_id", gameId)
      .gte("created_at", todayStart),
  ]);

  const configMarginRatio = profitSettings.profit_margin / 100;
  const maxWinCap = profitSettings.max_win_cap; // e.g., 200x

  // ─── 1. Check forced result from admin ───
  const forcedResult = profileRes.data?.forced_result ?? null;
  if (forcedResult === "loss") return { outcome: "loss", maxWinAmount: 0, availablePool: 0 };
  if (forcedResult === "big_win") return { outcome: "big_win", maxWinAmount: Math.round(betAmount * 15), availablePool: 999999 };
  if (forcedResult === "mega_win") return { outcome: "mega_win", maxWinAmount: Math.round(betAmount * Math.min(maxWinCap, 100)), availablePool: 999999 };
  if (forcedResult === "small_win") return { outcome: "small_win", maxWinAmount: Math.round(betAmount * 1.5), availablePool: 999999 };

  const oneTimeResults: Record<string, GameOutcome> = {
    one_big_win: { outcome: "big_win", maxWinAmount: Math.round(betAmount * 15), availablePool: 999999 },
    one_mega_win: { outcome: "mega_win", maxWinAmount: Math.round(betAmount * Math.min(maxWinCap, 100)), availablePool: 999999 },
    one_small_win: { outcome: "small_win", maxWinAmount: Math.round(betAmount * 1.5), availablePool: 999999 },
    one_loss: { outcome: "loss", maxWinAmount: 0, availablePool: 0 },
  };
  if (forcedResult && oneTimeResults[forcedResult]) {
    await supabase.from("profiles").update({ forced_result: null }).eq("user_id", userId);
    return oneTimeResults[forcedResult];
  }

  // ─── 2. Distribute bet into pools ───
  await supabase.rpc("distribute_bet_to_pools", {
    p_bet_amount: betAmount,
    p_small_pct: profitSettings.small_win_pool_pct,
    p_medium_pct: profitSettings.medium_win_pool_pct,
    p_big_pct: profitSettings.big_win_pool_pct,
    p_jackpot_pct: profitSettings.jackpot_pool_pct,
  });

  // Refresh pool balances after distribution
  const updatedPools = await getPoolBalances(supabase);

  // ─── 3. Global profit check ───
  const globalStats = globalStatsRes.data;
  let globalTotalBets = 0, globalTotalWins = 0;
  if (globalStats && globalStats.length > 0) {
    globalTotalBets = Number(globalStats[0].total_bets) || 0;
    globalTotalWins = Number(globalStats[0].total_wins) || 0;
  }
  globalTotalBets += betAmount;

  const globalCurrentRTP = globalTotalBets > 0 ? (globalTotalWins / globalTotalBets) * 100 : 0;
  const targetRTP = 100 - profitSettings.profit_margin; // e.g., 75% RTP for 25% margin
  const globalAvailablePool = Math.max(0, globalTotalBets * (1 - configMarginRatio) - globalTotalWins);

  // If RTP exceeds target, reduce win probability
  const rtpExcess = Math.max(0, globalCurrentRTP - targetRTP);
  const rtpPenalty = Math.min(rtpExcess * 2, 30); // Up to 30% penalty on win rates

  if (globalAvailablePool <= 0) {
    return { outcome: "loss", maxWinAmount: 0, availablePool: 0 };
  }

  // ─── 4. Daily profit gate ───
  const todayGameSessions = todayGameRes.data || [];
  let todayBets = betAmount, todayWins = 0;
  todayGameSessions.forEach((s: any) => {
    todayBets += Number(s.bet_amount) || 0;
    todayWins += Number(s.win_amount) || 0;
  });
  const todayProfit = todayBets - todayWins;
  const todayMinProfit = todayBets * configMarginRatio;
  const dailyProfitHealthy = todayBets < 200 || todayProfit >= todayMinProfit;

  // ─── 5. Server-side RNG with configurable probabilities ───
  const roll = secureRandom() * 100;

  // Apply RTP penalty to loss rate (increase losses when RTP is too high)
  const effectiveLossRate = Math.min(95, profitSettings.loss_rate + rtpPenalty);
  const effectiveSmallPct = profitSettings.small_win_pct * (1 - rtpPenalty / 100);
  const effectiveMedPct = profitSettings.medium_win_pct * (1 - rtpPenalty / 100);
  const effectiveBigPct = profitSettings.big_win_pct * (1 - rtpPenalty / 100);
  const effectiveJackpotPct = profitSettings.jackpot_win_pct * (1 - rtpPenalty / 100);

  // Probability bands: Loss → Small → Medium → Big → Jackpot
  const lossCutoff = effectiveLossRate;
  const smallCutoff = lossCutoff + effectiveSmallPct;
  const medCutoff = smallCutoff + effectiveMedPct;
  const bigCutoff = medCutoff + effectiveBigPct;
  // Anything above bigCutoff = jackpot (if within 100)

  // Max win amount cap
  const absoluteMaxWin = Math.round(betAmount * maxWinCap);

  if (roll < lossCutoff) {
    return { outcome: "loss", maxWinAmount: 0, availablePool: globalAvailablePool };
  }

  // ─── JACKPOT (mega_win) ───
  if (roll >= bigCutoff && roll < bigCutoff + effectiveJackpotPct) {
    // Check cooldown
    const onCooldown = await checkUserCooldown(supabase, userId, "jackpot", profitSettings.jackpot_cooldown_hours, updatedPools.jackpot);
    if (onCooldown || !dailyProfitHealthy) {
      // Downgrade to big win
      console.log(`[JACKPOT→BIG DOWNGRADE] user=${userId} cooldown=${onCooldown}`);
    } else {
      const jackpotPool = updatedPools.jackpot;
      if (jackpotPool >= betAmount * 50) {
        const mult = 50 + secureRandom() * 150; // 50x-200x
        const maxWin = Math.min(
          Math.round(betAmount * mult),
          absoluteMaxWin,
          Math.floor(jackpotPool * 0.8),
          Math.floor(globalAvailablePool)
        );
        if (maxWin >= betAmount * 20) {
          await Promise.all([
            supabase.rpc("deduct_from_pool", { p_pool_type: "jackpot", p_amount: maxWin }),
            recordUserWin(supabase, userId, "jackpot", maxWin, gameId),
          ]);
          console.log(`[JACKPOT WIN] game=${gameId} user=${userId} maxWin=${maxWin}`);
          return { outcome: "mega_win", maxWinAmount: maxWin, availablePool: globalAvailablePool, poolUsed: "jackpot" };
        }
      }
      // Pool insufficient — downgrade to big
    }
  }

  // ─── BIG WIN ───
  if (roll >= medCutoff && roll < bigCutoff + effectiveJackpotPct) {
    const onCooldown = await checkUserCooldown(supabase, userId, "big_win", profitSettings.big_win_cooldown_hours, updatedPools.big_win);
    if (onCooldown || !dailyProfitHealthy) {
      // Downgrade to medium
      console.log(`[BIG→MED DOWNGRADE] user=${userId} cooldown=${onCooldown}`);
    } else {
      const bigPool = updatedPools.big_win;
      if (bigPool >= betAmount * 10) {
        const mult = 10 + secureRandom() * 20; // 10x-30x
        const maxWin = Math.min(
          Math.round(betAmount * mult),
          absoluteMaxWin,
          Math.floor(bigPool * 0.5),
          Math.floor(globalAvailablePool)
        );
        if (maxWin >= betAmount * 5) {
          await Promise.all([
            supabase.rpc("deduct_from_pool", { p_pool_type: "big_win", p_amount: maxWin }),
            recordUserWin(supabase, userId, "big_win", maxWin, gameId),
          ]);
          console.log(`[BIG WIN] game=${gameId} user=${userId} maxWin=${maxWin}`);
          return { outcome: "big_win", maxWinAmount: maxWin, availablePool: globalAvailablePool, poolUsed: "big_win" };
        }
      }
      // Pool insufficient — downgrade to medium
    }
  }

  // ─── MEDIUM WIN ───
  if (roll >= smallCutoff) {
    const medPool = updatedPools.medium_win;
    if (medPool >= betAmount * 2) {
      const mult = 2 + secureRandom() * 3; // 2x-5x
      const maxWin = Math.min(
        Math.round(betAmount * mult),
        absoluteMaxWin,
        Math.floor(medPool * 0.3),
        Math.floor(globalAvailablePool)
      );
      if (maxWin > 0) {
        await supabase.rpc("deduct_from_pool", { p_pool_type: "medium_win", p_amount: maxWin });
        return { outcome: "medium_win", maxWinAmount: maxWin, availablePool: globalAvailablePool, poolUsed: "medium_win" };
      }
    }
    // Pool insufficient — downgrade to small
  }

  // ─── SMALL WIN (most common win) ───
  if (roll >= lossCutoff) {
    const smallPool = updatedPools.small_win;
    const mult = 1.2 + secureRandom() * 0.8; // 1.2x-2x
    const maxWin = Math.min(
      Math.round(betAmount * mult),
      absoluteMaxWin,
      Math.floor(Math.max(smallPool * 0.1, betAmount * 2)),
      Math.floor(globalAvailablePool)
    );
    if (maxWin > 0 && smallPool >= betAmount * 0.5) {
      await supabase.rpc("deduct_from_pool", { p_pool_type: "small_win", p_amount: maxWin });
      return { outcome: "small_win", maxWinAmount: maxWin, availablePool: globalAvailablePool, poolUsed: "small_win" };
    }
  }

  // All pools depleted — force loss
  return { outcome: "loss", maxWinAmount: 0, availablePool: globalAvailablePool };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual JWT decode
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const payloadB64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      if (!payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) {
        throw new Error("Invalid or expired token");
      }
      userId = payload.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { bet_amount, game_type, game_id } = await req.json();

    if (!bet_amount || bet_amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid bet amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await calculateOutcome(supabase, userId, bet_amount, game_type || "slot", game_id || game_type || "unknown");

    // Lucky Spin segment picker
    if (game_id === "lucky-spin" && result.outcome !== "loss") {
      const WHEEL_MULTIPLIERS = [2, 5, 10, 12, 20];
      const maxAffordable = result.maxWinAmount / bet_amount;
      const affordable = WHEEL_MULTIPLIERS.filter(m => m <= maxAffordable && m * bet_amount <= result.maxWinAmount);

      if (affordable.length === 0) {
        result.outcome = "loss";
        result.maxWinAmount = 0;
        result.multiplier = 0;
      } else {
        let picked: number;
        if (result.outcome === "mega_win") picked = affordable[affordable.length - 1];
        else if (result.outcome === "big_win") {
          const topHalf = affordable.slice(Math.floor(affordable.length / 2));
          picked = topHalf[Math.floor(secureRandom() * topHalf.length)];
        } else if (result.outcome === "medium_win") picked = affordable[Math.floor(affordable.length / 2)];
        else picked = affordable[0];
        result.multiplier = picked;
        result.maxWinAmount = Math.round(bet_amount * picked);
      }
    } else if (game_id === "lucky-spin" && result.outcome === "loss") {
      result.multiplier = 0;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("game-outcome error:", err);
    // Default to loss on any error
    return new Response(JSON.stringify({ outcome: "loss", maxWinAmount: 0, availablePool: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
