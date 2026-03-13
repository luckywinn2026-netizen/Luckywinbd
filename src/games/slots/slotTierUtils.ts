/**
 * Shared slot win-tier logic: matches backend (gameOutcome / Super Ace / Boxing King).
 * Use for UI labels so win display matches game logic across all slots.
 * Thresholds: mega 20x+, big 10x+, medium 5x+, small >0 (and "Win" when win < stake for partial return).
 *
 * Usage in any slot game:
 * - Import: outcomeToTier, getTierDisplayLabel, shouldShowFinalWinOverlay, getWinTierFromRatio
 * - Server outcome → outcomeToTier(outcome.outcome) for tier; getTierDisplayLabel(tier, winAmount, stake).short for label
 * - Show Big Win overlay only for big_win / mega_win; show "Final win" overlay for small_win / medium_win (2.5s)
 * - Toast/UI: use getTierDisplayLabel so "Win" vs "SMALL WIN" matches (partial return when win < stake)
 */

export type WinTier = 'loss' | 'small_win' | 'medium_win' | 'big_win' | 'mega_win';

/** Derive tier from actual win amount and stake (e.g. for display after spin). */
export function getWinTierFromRatio(winAmount: number, stake: number): WinTier {
  if (!stake || winAmount <= 0) return 'loss';
  const ratio = winAmount / stake;
  if (ratio >= 20) return 'mega_win';
  if (ratio >= 10) return 'big_win';
  if (ratio >= 5) return 'medium_win';
  if (ratio > 0) return 'small_win';
  return 'loss';
}

/** Map server outcome string to WinTier. */
export function outcomeToTier(outcome: string): WinTier {
  if (outcome === 'mega_win' || outcome === 'jackpot') return 'mega_win';
  if (outcome === 'big_win') return 'big_win';
  if (outcome === 'medium_win') return 'medium_win';
  if (outcome === 'small_win') return 'small_win';
  return 'loss';
}

/**
 * Label for UI: "Win" when partial return (win < stake), else "SMALL WIN" / "MEDIUM WIN" / "BIG WIN" / "MEGA WIN".
 * Games can use their own wording (e.g. "JACKPOT" for mega) but tier logic stays consistent.
 */
export function getTierDisplayLabel(
  tier: WinTier,
  winAmount: number,
  stake: number
): { short: string; isPartialWin: boolean } {
  if (tier === 'loss') return { short: 'Loss', isPartialWin: false };
  const isPartialWin = stake > 0 && winAmount > 0 && winAmount < stake;
  if (tier === 'small_win') return { short: 'Win', isPartialWin: isPartialWin };
  if (tier === 'medium_win') return { short: 'MEDIUM WIN', isPartialWin: false };
  if (tier === 'big_win') return { short: 'BIG WIN', isPartialWin: false };
  if (tier === 'mega_win') return { short: 'MEGA WIN', isPartialWin: false };
  return { short: 'Win', isPartialWin: isPartialWin };
}

/** Should show big overlay (Big Win / Mega style)? Only for big_win and mega_win. */
export function shouldShowBigWinOverlay(tier: WinTier): boolean {
  return tier === 'big_win' || tier === 'mega_win';
}

/** Should show final-win overlay (small/medium total)? */
export function shouldShowFinalWinOverlay(tier: WinTier): boolean {
  return tier === 'small_win' || tier === 'medium_win';
}
