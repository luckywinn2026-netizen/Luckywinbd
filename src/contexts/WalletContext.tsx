import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'win';
  amount: number;
  description: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'rejected';
}

interface VipTier {
  name: string;
  minPoints: number;
  icon: string;
  cashbackRate: number;
  bonusMultiplier: number;
  withdrawPriority: boolean;
  exclusiveGames: boolean;
  personalManager: boolean;
}

export const VIP_TIERS: VipTier[] = [
  { name: 'Bronze', minPoints: 0, icon: '🥉', cashbackRate: 1, bonusMultiplier: 1, withdrawPriority: false, exclusiveGames: false, personalManager: false },
  { name: 'Silver', minPoints: 500, icon: '🥈', cashbackRate: 2, bonusMultiplier: 1.25, withdrawPriority: false, exclusiveGames: false, personalManager: false },
  { name: 'Gold', minPoints: 2000, icon: '🥇', cashbackRate: 3, bonusMultiplier: 1.5, withdrawPriority: true, exclusiveGames: false, personalManager: false },
  { name: 'Platinum', minPoints: 5000, icon: '💎', cashbackRate: 5, bonusMultiplier: 2, withdrawPriority: true, exclusiveGames: true, personalManager: false },
  { name: 'Diamond', minPoints: 15000, icon: '👑', cashbackRate: 8, bonusMultiplier: 3, withdrawPriority: true, exclusiveGames: true, personalManager: true },
];

interface WalletContextType {
  balance: number;
  pendingWithdraw: number;
  transactions: Transaction[];
  vipPoints: number;
  totalBetAmount: number;
  currentTier: VipTier;
  nextTier: VipTier | null;
  pointsToNext: number;
  upgradedTier: VipTier | null;
  clearUpgradedTier: () => void;
  placeBet: (amount: number, gameName: string, gameType: string) => boolean;
  addWin: (amount: number, gameName: string, gameType: string, multiplier?: number, betAmount?: number, gameId?: string) => void;
  logLoss: (betAmount: number, gameName: string, gameType: string, gameId?: string) => void;
  deposit: (amount: number, method: string, trxId: string, senderPhone: string, assignedAgentId?: string) => Promise<boolean>;
  withdraw: (amount: number, method: string, number: string, assignedAgentId?: string) => Promise<boolean>;
  claimCashback: () => Promise<number>;
  refreshBalance: () => Promise<void>;
  applyAuthoritativeBalance: (amount: number) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside WalletProvider');
  return ctx;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [pendingWithdraw, setPendingWithdraw] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vipPoints, setVipPoints] = useState(0);
  const [totalBetAmount, setTotalBetAmount] = useState(0);
  const [upgradedTier, setUpgradedTier] = useState<VipTier | null>(null);
  const [prevTierName, setPrevTierName] = useState<string | null>(null);

  const currentTier = [...VIP_TIERS].reverse().find(t => vipPoints >= t.minPoints) || VIP_TIERS[0];
  const currentTierIdx = VIP_TIERS.findIndex(t => t.name === currentTier.name);
  const nextTier = currentTierIdx < VIP_TIERS.length - 1 ? VIP_TIERS[currentTierIdx + 1] : null;
  const pointsToNext = nextTier ? nextTier.minPoints - vipPoints : 0;

  // Detect tier upgrades
  useEffect(() => {
    if (prevTierName && prevTierName !== currentTier.name) {
      const prevIdx = VIP_TIERS.findIndex(t => t.name === prevTierName);
      const currIdx = VIP_TIERS.findIndex(t => t.name === currentTier.name);
      if (currIdx > prevIdx) {
        setUpgradedTier(currentTier);
      }
    }
    setPrevTierName(currentTier.name);
  }, [currentTier.name]);

  const clearUpgradedTier = useCallback(() => setUpgradedTier(null), []);
  const applyAuthoritativeBalance = useCallback((amount: number) => {
    setBalance(Math.round(Number(amount) * 100) / 100);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!user) { setBalance(0); setPendingWithdraw(0); return; }
    const [walletRes, pendingRes, vipRes] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
      supabase.from('withdrawals').select('amount').eq('user_id', user.id).eq('status', 'pending'),
      supabase.from('user_vip_data').select('vip_points, total_bet_amount').eq('user_id', user.id).single(),
    ]);
    if (walletRes.data) setBalance(Math.round(Number(walletRes.data.balance) * 100) / 100);
    if (pendingRes.data) setPendingWithdraw(pendingRes.data.reduce((s, w) => s + Number(w.amount), 0));
    if (vipRes.data) {
      setVipPoints(Number(vipRes.data.vip_points));
      setTotalBetAmount(Number(vipRes.data.total_bet_amount));
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) { setTransactions([]); return; }
    const [deps, withs, games] = await Promise.all([
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('game_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);

    const txs: Transaction[] = [];
    (deps.data || []).forEach(d => txs.push({
      id: d.id, type: 'deposit', amount: Number(d.amount),
      description: `${d.method} - TrxID: ${d.trx_id || 'N/A'}`,
      timestamp: new Date(d.created_at).getTime(),
      status: d.status === 'approved' ? 'completed' : d.status === 'rejected' ? 'rejected' : 'pending',
    }));
    (withs.data || []).forEach(w => txs.push({
      id: w.id, type: 'withdraw', amount: Number(w.amount),
      description: `${w.method} - ${w.phone || 'N/A'}`,
      timestamp: new Date(w.created_at).getTime(),
      status: w.status === 'approved' ? 'completed' : w.status === 'rejected' ? 'rejected' : 'pending',
    }));
    (games.data || []).forEach(g => txs.push({
      id: g.id, type: g.result === 'win' ? 'win' : 'bet', amount: g.result === 'win' ? Number(g.win_amount) : Number(g.bet_amount),
      description: g.game_name || g.game_type,
      timestamp: new Date(g.created_at).getTime(),
      status: 'completed',
    }));

    txs.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(txs);
  }, [user]);

  // Initial fetch - only balance, NOT transactions (lazy load on demand)
  useEffect(() => {
    refreshBalance();
  }, [user, refreshBalance]);

  // Realtime balance subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && typeof payload.new.balance !== 'undefined') {
            setBalance(Math.round(Number(payload.new.balance) * 100) / 100);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const placeBet = useCallback((amount: number, gameName: string, gameType: string) => {
    if (amount <= 0 || amount > balance) {
      toast.error('Insufficient balance');
      return false;
    }
    setBalance(b => Math.round(Math.max(0, b - amount) * 100) / 100);
    const points = Math.floor(amount / 100);
    setVipPoints(p => p + points);
    setTotalBetAmount(t => t + amount);
    if (user) {
      api.rpc<number>('adjust_wallet_balance', { p_user_id: user.id, p_amount: -amount }).then((data) => {
        if (data !== null && data !== undefined) setBalance(Math.round(Number(data) * 100) / 100);
      }).catch(() => {
        setBalance(b => Math.round((b + amount) * 100) / 100);
        setVipPoints(p => p - points);
        setTotalBetAmount(t => t - amount);
        refreshBalance();
      });
      api.rpc('add_vip_points', { p_user_id: user.id, p_points: points, p_bet_amount: amount }).catch((err) => {
        console.error('VIP points RPC failed, rolling back:', err);
        setVipPoints(p => p - points);
        setTotalBetAmount(t => t - amount);
      });
    }
    return true;
  }, [balance, refreshBalance, user]);

  const addWin = useCallback((amount: number, gameName: string, gameType: string, multiplier?: number, betAmount?: number, gameId?: string) => {
    setBalance(b => Math.round((b + amount) * 100) / 100);
    if (user) {
      api.rpc<number>('adjust_wallet_balance', { p_user_id: user.id, p_amount: amount }).then((data) => {
        if (data !== null && data !== undefined) setBalance(Math.round(Number(data) * 100) / 100);
      }).catch(() => {});
      supabase.from('game_sessions').insert({
        user_id: user.id, game_type: gameType, game_name: gameName,
        game_id: gameId || null,
        bet_amount: betAmount || 0, win_amount: amount, result: 'win',
        multiplier: multiplier || null,
      }).then(({ error }) => { if (error) console.error('game_sessions insert error:', error); });
    }
  }, [user]);

  const logLoss = useCallback((betAmount: number, gameName: string, gameType: string, gameId?: string) => {
    if (user) {
      supabase.from('game_sessions').insert({
        user_id: user.id, game_type: gameType, game_name: gameName,
        game_id: gameId || null,
        bet_amount: betAmount, win_amount: 0, result: 'loss',
      }).then(({ error }) => { if (error) console.error('game_sessions insert error:', error); });
    }
  }, [user]);

  const deposit = useCallback(async (amount: number, method: string, trxId: string, senderPhone: string, assignedAgentId?: string) => {
    if (!user) return false;
    try {
      const result = await api.createDeposit({
        amount, method, trx_id: trxId, phone: senderPhone,
        ...(assignedAgentId && { assigned_agent_id: assignedAgentId }),
      });
      if (result?.success) {
        fetchTransactions();
        return true;
      }
    } catch {
      toast.error('Failed to submit deposit');
    }
    return false;
  }, [user, fetchTransactions]);

  const withdraw = useCallback(async (amount: number, method: string, number: string, assignedAgentId?: string) => {
    if (!user || amount > balance || amount < 500) return false;
    try {
      const result = await api.createWithdrawal({
        amount, method, phone: number,
        ...(assignedAgentId && { assigned_agent_id: assignedAgentId }),
      });
      if (result?.success && result.new_balance != null) {
        setBalance(Math.round(Number(result.new_balance) * 100) / 100);
        setPendingWithdraw(p => p + amount);
        fetchTransactions();
        refreshBalance();
        return true;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to process withdrawal');
    }
    return false;
  }, [user, balance, fetchTransactions, refreshBalance]);

  const claimCashback = useCallback(async () => {
    if (!user) return 0;
    try {
      const data = await api.rpc<number>('claim_cashback', { p_user_id: user.id });
      const cashback = Number(data ?? 0);
      if (cashback > 0) refreshBalance();
      return cashback;
    } catch {
      return 0;
    }
  }, [user, refreshBalance]);

  return (
    <WalletContext.Provider value={{
      balance, pendingWithdraw, transactions,
      vipPoints, totalBetAmount, currentTier, nextTier, pointsToNext,
      upgradedTier, clearUpgradedTier,
      placeBet, addWin, logLoss, deposit, withdraw, claimCashback, refreshBalance, applyAuthoritativeBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
};
