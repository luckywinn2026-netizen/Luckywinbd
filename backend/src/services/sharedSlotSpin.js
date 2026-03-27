const { supabaseAdmin } = require('./supabase');
const { calculateOutcome, secureRandom } = require('./gameOutcome');

const LUCKY_SPIN_MULTIPLIERS = [2, 5, 10, 12, 20];
const SPIN_WHEEL_MULTIPLIERS = [0.5, 1.5, 2, 5, 10, 100];

async function loadWalletBalance(userId) {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Wallet not found');
  }

  return Number(data.balance) || 0;
}

function applyLuckySpinMultiplier(result, betAmount) {
  if (result.outcome === 'loss') {
    return { ...result, multiplier: 0, maxWinAmount: 0 };
  }

  const maxAffordable = result.maxWinAmount / betAmount;
  const affordable = LUCKY_SPIN_MULTIPLIERS.filter((multiplier) => multiplier <= maxAffordable);

  if (affordable.length === 0) {
    return { ...result, outcome: 'loss', multiplier: 0, maxWinAmount: 0 };
  }

  let picked;
  if (result.outcome === 'mega_win' || result.outcome === 'jackpot') {
    picked = affordable[affordable.length - 1];
  } else if (result.outcome === 'big_win') {
    const topHalf = affordable.slice(Math.floor(affordable.length / 2));
    picked = topHalf[Math.floor(secureRandom() * topHalf.length)];
  } else if (result.outcome === 'medium_win') {
    picked = affordable[Math.floor(affordable.length / 2)];
  } else {
    picked = affordable[0];
  }

  return {
    ...result,
    multiplier: picked,
    maxWinAmount: Math.round(betAmount * picked),
  };
}

function clampToMultiplierSet(result, betAmount, allowedMultipliers) {
  if (!result || result.maxWinAmount <= 0) return { ...result, multiplier: 0 };

  const affordable = allowedMultipliers
    .filter((m) => m > 0 && betAmount * m <= result.maxWinAmount)
    .sort((a, b) => a - b);

  if (!affordable.length) {
    return { ...result, outcome: 'loss', maxWinAmount: 0, multiplier: 0 };
  }

  const picked = affordable[affordable.length - 1];
  return {
    ...result,
    multiplier: picked,
    maxWinAmount: Math.round(betAmount * picked),
  };
}

function clampToDigitMultiplierProduct(result, betAmount, multipliers, maxDigit) {
  if (!result || result.maxWinAmount <= 0) return result;
  let best = 0;
  let bestMultiplier = 0;

  for (const mult of multipliers) {
    const digit = Math.floor(result.maxWinAmount / mult);
    if (digit >= 1 && digit <= maxDigit) {
      const value = digit * mult;
      if (value <= result.maxWinAmount && value > best) {
        best = value;
        bestMultiplier = mult;
      }
    }
  }

  if (best <= 0) {
    return { ...result, outcome: 'loss', maxWinAmount: 0, multiplier: 0 };
  }

  return {
    ...result,
    maxWinAmount: best,
    multiplier: Math.round((best / betAmount) * 100) / 100 || bestMultiplier,
  };
}

async function runSharedSlotSpin(userId, betAmount, gameId, gameName) {
  const bet = Number(betAmount);
  if (!Number.isFinite(bet) || bet <= 0) {
    return { error: 'Invalid bet amount' };
  }

  const balance = await loadWalletBalance(userId);
  if (balance < bet) {
    return { error: 'Insufficient balance' };
  }

  let outcome = await calculateOutcome(userId, bet, 'slot', gameId);

  if (gameId === 'lucky-spin') {
    outcome = applyLuckySpinMultiplier(outcome, bet);
  }

  // Spin Wheel: outcome must land on one of the exact wheel segment multipliers.
  if (gameId === 'spin-wheel') {
    if (outcome.outcome === 'loss' || outcome.maxWinAmount <= 0) {
      outcome = { ...outcome, multiplier: 0, maxWinAmount: 0 };
    } else {
      outcome = clampToMultiplierSet(outcome, bet, SPIN_WHEEL_MULTIPLIERS);
    }
  }

  // Lucky 777: win must be displayable as digit × multiplier (matches frontend reel logic)
  if (gameId === 'lucky-777' && outcome.maxWinAmount > 0) {
    const mults = bet <= 5 ? [1, 2, 3, 5, 10, 25, 50] : [1, 2, 3, 5, 10, 25, 50, 100, 200, 500];
    const maxDigit = bet >= 5 ? 999 : 99;
    outcome = clampToDigitMultiplierProduct(outcome, bet, mults, maxDigit);
  }

  // Shared numeric slots: ensure backend win is exactly reachable by UI (digits × 4th-reel multiplier).
  if (['money-coming', 'fortune-wheel', 'classic-casino', 'tropical-fruits', 'fruit-party'].includes(gameId) && outcome.maxWinAmount > 0) {
    const maxDigit = bet >= 5 ? 999 : 99;
    const allowedMults = bet <= 5
      ? [1, 2, 3, 5, 10, 20, 25, 50]
      : [1, 2, 3, 5, 10, 20, 25, 50, 100, 200, 500];
    outcome = clampToDigitMultiplierProduct(outcome, bet, allowedMults, maxDigit);
  }

  // Fortune Gems: sync outcome tier to actual amount so UI shows correct gem count
  // Paytable: small 0.5–1.5x, medium 2–4x, big 5–12x, mega 15x+
  if (gameId === 'fortune-gems' && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  // Fortune Wheel: sync outcome tier so frontend picks correct multiplier reel
  // small <2x, medium 2–5x, big 5–15x, mega 15x+
  if (gameId === 'fortune-wheel' && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  // Money Coming: sync outcome tier (same as Fortune Wheel)
  if (gameId === 'money-coming' && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  // Fruit Party, Tropical Fruits, Classic Casino: sync outcome tier
  if (['fruit-party', 'tropical-fruits', 'classic-casino'].includes(gameId) && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  // Spin Wheel: sync outcome tier for segment selection
  if (gameId === 'spin-wheel' && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  // Lucky Win: sync outcome tier for grid/symbol selection
  if (gameId === 'lucky-win' && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  // Classic 777, Golden Book: sync outcome tier for symbol selection
  if (['classic-777', 'golden-book'].includes(gameId) && outcome.maxWinAmount > 0) {
    const mult = outcome.maxWinAmount / bet;
    if (mult < 2) outcome = { ...outcome, outcome: 'small_win' };
    else if (mult < 5) outcome = { ...outcome, outcome: 'medium_win' };
    else if (mult < 15) outcome = { ...outcome, outcome: 'big_win' };
    else outcome = { ...outcome, outcome: 'mega_win' };
  }

  const multiplier = outcome.multiplier ?? (outcome.maxWinAmount > 0 ? Math.round((outcome.maxWinAmount / bet) * 100) / 100 : 0);
  const { data, error } = await supabaseAdmin.rpc('settle_generic_game_round', {
    p_user_id: userId,
    p_game_id: gameId,
    p_game_name: gameName,
    p_game_type: 'slot',
    p_bet_amount: bet,
    p_total_win: outcome.maxWinAmount,
    p_result: outcome.maxWinAmount > 0 ? 'win' : 'loss',
    p_multiplier: multiplier || null,
  });

  if (error) {
    return { error: error.message || 'Failed to settle game' };
  }

  return {
    ...outcome,
    winAmount: outcome.maxWinAmount,
    newBalance: Number(data?.new_balance ?? balance - bet + outcome.maxWinAmount),
  };
}

module.exports = { runSharedSlotSpin };
