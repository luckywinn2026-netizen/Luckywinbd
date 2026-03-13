import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import type { CrashGameState } from '@/hooks/useCrashRound';

export type CrashBetPanel = {
  stake: string;
  autoCashout: string;
  hasBet: boolean;
  cashedOut: boolean;
  mode: 'bet' | 'auto';
  betId: string | null;
};

export type CrashRoundPlayer = {
  id: string;
  user_id: string;
  username: string;
  panel_index: number;
  bet_amount: number;
  status: 'playing' | 'cashed_out' | 'lost';
  cashout_multiplier?: number;
  win_amount?: number;
  isReal?: boolean;
};

type UseCrashBettingArgs = {
  gameId: string;
  gameName: string;
  gameState: CrashGameState;
  multiplier: number;
  roundId: string | null;
  liveBets: api.CrashLiveBet[];
  refreshRound: () => Promise<void>;
};

export function useCrashBetting({
  gameId,
  gameName,
  gameState,
  multiplier,
  roundId,
  liveBets,
  refreshRound,
}: UseCrashBettingArgs) {
  const { user } = useAuth();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const [panels, setPanels] = useState<[CrashBetPanel, CrashBetPanel]>([
    { stake: '10.00', autoCashout: '2.00', hasBet: false, cashedOut: false, mode: 'bet', betId: null },
    { stake: '10.00', autoCashout: '2.00', hasBet: false, cashedOut: false, mode: 'bet', betId: null },
  ]);
  const [panelBusy, setPanelBusy] = useState<Record<0 | 1, boolean>>({ 0: false, 1: false });

  const updatePanel = useCallback((idx: 0 | 1, updates: Partial<CrashBetPanel>) => {
    setPanels((prev) => {
      const copy = [...prev] as [CrashBetPanel, CrashBetPanel];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  }, []);

  const currentRoundPlayers = useMemo<CrashRoundPlayer[]>(() => {
    return liveBets.map((bet) => ({
      id: bet.id,
      user_id: bet.user_id,
      username: bet.username_snapshot || 'Player',
      panel_index: bet.panel_index,
      bet_amount: Number(bet.bet_amount),
      status: bet.status === 'active' ? 'playing' : bet.status,
      cashout_multiplier: bet.cashout_multiplier ?? undefined,
      win_amount: bet.win_amount ? Number(bet.win_amount) : undefined,
      isReal: true,
    }));
  }, [liveBets]);

  const ownRoundBets = useMemo(
    () => currentRoundPlayers.filter((bet) => bet.user_id === user?.id),
    [currentRoundPlayers, user?.id]
  );

  const otherPlayerBets = useMemo(
    () => currentRoundPlayers.filter((bet) => bet.user_id !== user?.id),
    [currentRoundPlayers, user?.id]
  );

  useEffect(() => {
    setPanels((prev) => {
      const next = [...prev] as [CrashBetPanel, CrashBetPanel];
      ([0, 1] as const).forEach((panelIndex) => {
        const ownBet = ownRoundBets.find((bet) => bet.panel_index === panelIndex);
        next[panelIndex] = {
          ...next[panelIndex],
          hasBet: Boolean(ownBet),
          cashedOut: ownBet?.status === 'cashed_out',
          betId: ownBet?.id ?? null,
        };
      });
      return next;
    });
  }, [ownRoundBets, roundId]);

  const runPanelAction = useCallback(async (idx: 0 | 1, action: () => Promise<void>) => {
    if (panelBusy[idx]) {
      return;
    }
    setPanelBusy((prev) => ({ ...prev, [idx]: true }));
    try {
      await action();
    } finally {
      setPanelBusy((prev) => ({ ...prev, [idx]: false }));
    }
  }, [panelBusy]);

  const handlePlaceBet = useCallback(async (idx: 0 | 1) => {
    await runPanelAction(idx, async () => {
      if (gameState !== 'waiting') {
        toast.error('Wait for next round');
        return;
      }
      if (!roundId) {
        toast.error('Round is syncing. Try again.');
        await refreshRound();
        return;
      }

      const stake = Number(panels[idx].stake);
      const autoCashout = panels[idx].mode === 'auto' ? Number(panels[idx].autoCashout) : null;
      if (stake < 5) {
        toast.error('Min bet ৳5');
        return;
      }
      if (stake > 10000) {
        toast.error('Max bet ৳10,000');
        return;
      }

      const response = await api.placeCrashBet({
        game_id: gameId,
        round_id: roundId,
        panel_index: idx,
        bet_amount: stake,
        auto_cashout: autoCashout && autoCashout > 0 ? autoCashout : null,
      });

      applyAuthoritativeBalance(response.newBalance);
      await refreshRound();
      toast.success(`Bet ৳${stake.toLocaleString()} placed!`);
    });
  }, [applyAuthoritativeBalance, gameId, gameState, panels, refreshRound, roundId, runPanelAction]);

  const handleCancelBet = useCallback(async (idx: 0 | 1) => {
    await runPanelAction(idx, async () => {
      const betId = panels[idx].betId;
      if (!betId || gameState !== 'waiting') {
        return;
      }

      const response = await api.cancelCrashBet({ bet_id: betId });
      applyAuthoritativeBalance(response.newBalance);
      await refreshRound();
      toast.info('Bet cancelled');
    });
  }, [applyAuthoritativeBalance, gameState, panels, refreshRound, runPanelAction]);

  const handleCashout = useCallback(async (idx: 0 | 1) => {
    await runPanelAction(idx, async () => {
      const betId = panels[idx].betId;
      if (!betId || panels[idx].cashedOut || gameState !== 'flying') {
        return;
      }

      const response = await api.cashoutCrashBet({ bet_id: betId });
      applyAuthoritativeBalance(response.newBalance);
      await refreshRound();
      if ((response.winAmount || 0) > 0) {
        toast.success(
          `Cashed out at ${(response.cashoutMultiplier || multiplier).toFixed(2)}x — Won ৳${Number(response.winAmount || 0).toLocaleString()}!`
        );
      }
    });
  }, [applyAuthoritativeBalance, gameState, multiplier, panels, refreshRound, runPanelAction]);

  return {
    balance,
    panels,
    panelBusy,
    updatePanel,
    handlePlaceBet,
    handleCancelBet,
    handleCashout,
    ownRoundBets,
    otherPlayerBets,
    currentRoundPlayers,
    user,
  };
}
