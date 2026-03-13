// ─── Payout Engine ───
import { WinResult } from './WinEvaluator';

export const MAX_WIN_CAP_MULTIPLIER = 5000; // Max win = bet * 5000

export interface PayoutResult {
  basePayout: number;
  multiplier: number;
  totalPayout: number;
  capped: boolean;
}

/**
 * Calculate total payout:
 * TotalWin = SUM(SymbolPayout × Ways) × CascadeMultiplier
 * Capped at MAX_WIN_CAP_MULTIPLIER × bet.
 */
export const calculatePayout = (
  wins: WinResult[],
  multiplier: number,
  bet: number
): PayoutResult => {
  const basePayout = wins.reduce((sum, w) => sum + w.totalBasePayout, 0);
  let totalPayout = Math.round(basePayout * multiplier);
  const maxWin = bet * MAX_WIN_CAP_MULTIPLIER;
  const capped = totalPayout > maxWin;
  if (capped) totalPayout = maxWin;

  return { basePayout, multiplier, totalPayout, capped };
};
