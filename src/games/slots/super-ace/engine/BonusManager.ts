// ─── Free Spins / Bonus Manager ───

export const FREE_SPIN_TRIGGER_COUNT = 3; // Scatters needed
export const FREE_SPIN_AWARD = 10;        // Spins awarded

export interface BonusState {
  active: boolean;
  spinsRemaining: number;
  totalSpinsAwarded: number;
}

export const createBonusState = (): BonusState => ({
  active: false,
  spinsRemaining: 0,
  totalSpinsAwarded: 0,
});

/**
 * Check if free spins should trigger.
 */
export const shouldTriggerFreeSpins = (scatterCount: number): boolean =>
  scatterCount >= FREE_SPIN_TRIGGER_COUNT;

/**
 * Trigger free spins (initial or retrigger).
 */
export const triggerFreeSpins = (state: BonusState): BonusState => ({
  active: true,
  spinsRemaining: state.spinsRemaining + FREE_SPIN_AWARD,
  totalSpinsAwarded: state.totalSpinsAwarded + FREE_SPIN_AWARD,
});

/**
 * Consume one free spin.
 */
export const consumeFreeSpin = (state: BonusState): BonusState => {
  const remaining = Math.max(0, state.spinsRemaining - 1);
  return {
    ...state,
    spinsRemaining: remaining,
    active: remaining > 0,
  };
};
