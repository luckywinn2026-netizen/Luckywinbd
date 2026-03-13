import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { Users, TrendingUp, TrendingDown, DollarSign, Wifi, Database, Wrench } from 'lucide-react';
import { useMaintenance } from '@/hooks/useMaintenance';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActivePlayersSection from '@/components/admin/ActivePlayersSection';

interface Stats {
  totalUsers: number;
  totalOnline: number;
  approvedDeposits: number;
  approvedWithdrawals: number;
  totalBetAmount: number;
  totalWinAmount: number;
}

interface ProfitStats {
  todayBets: number;
  todayWins: number;
  weekBets: number;
  weekWins: number;
  monthBets: number;
  monthWins: number;
  totalBets: number;
  totalWins: number;
}

interface PoolData {
  game_id: string;
  pool_type: string;
  balance: number;
  total_contributed: number;
  total_paid_out: number;
}

const AdminDashboard = () => {
  const { appUnderMaintenance, message, loading: maintenanceLoading, setAppMaintenance } = useMaintenance();
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  useEffect(() => {
    setMaintenanceMessage(message);
  }, [message]);

  const handleToggleAppMaintenance = async () => {
    setSavingMaintenance(true);
    await setAppMaintenance(!appUnderMaintenance, maintenanceMessage);
    setSavingMaintenance(false);
  };

  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalOnline: 0,
    approvedDeposits: 0, approvedWithdrawals: 0,
    totalBetAmount: 0, totalWinAmount: 0,
  });
  const [profitPeriod, setProfitPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [profitChartData, setProfitChartData] = useState<{ label: string; profit: number; bets: number; wins: number }[]>([]);
  const [profitStats, setProfitStats] = useState<ProfitStats>({
    todayBets: 0, todayWins: 0, weekBets: 0, weekWins: 0,
    monthBets: 0, monthWins: 0, totalBets: 0, totalWins: 0,
  });
  const [perGameStats, setPerGameStats] = useState<Record<string, ProfitStats>>({});
  const [showAllGames, setShowAllGames] = useState(true);
  const [poolData, setPoolData] = useState<PoolData[]>([]);

  const fetchData = useCallback(async () => {
    const [profiles, depositTotal, withdrawalTotal, gameStatsSummary, activePlayers, poolsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      api.rpc('get_approved_deposit_total').catch(() => 0),
      api.rpc('get_approved_withdrawal_total').catch(() => 0),
      api.rpc('get_total_bets_and_wins').catch(() => []),
      supabase.from('active_players').select('id', { count: 'exact', head: true }),
      supabase.from('reward_pools').select('game_id, pool_type, balance, total_contributed, total_paid_out'),
    ]);
    const summaryRow = (Array.isArray(gameStatsSummary) ? gameStatsSummary[0] : gameStatsSummary) as any || { total_bets: 0, total_wins: 0 };
    setStats({
      totalUsers: profiles.count || 0,
      totalOnline: activePlayers.count || 0,
      approvedDeposits: Number(depositTotal) || 0,
      approvedWithdrawals: Number(withdrawalTotal) || 0,
      totalBetAmount: Number(summaryRow?.total_bets ?? 0),
      totalWinAmount: Number(summaryRow?.total_wins ?? 0),
    });
    if (poolsRes.data) {
      setPoolData(poolsRes.data as PoolData[]);
    }
  }, []);

  const fetchProfitStats = useCallback(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [todayRes, weekRes, monthRes, totalRes, todayGameRes, weekGameRes, monthGameRes, gamesRes] = await Promise.all([
      api.rpc('get_session_stats_by_range', { p_start: todayStart }).catch(() => []),
      api.rpc('get_session_stats_by_range', { p_start: weekStart }).catch(() => []),
      api.rpc('get_session_stats_by_range', { p_start: monthStart }).catch(() => []),
      api.rpc('get_total_bets_and_wins').catch(() => []),
      api.rpc('get_per_game_stats_by_range', { p_start: todayStart }).catch(() => []),
      api.rpc('get_per_game_stats_by_range', { p_start: weekStart }).catch(() => []),
      api.rpc('get_per_game_stats_by_range', { p_start: monthStart }).catch(() => []),
      supabase.from('games').select('name'),
    ]);
    const todayRow = (Array.isArray(todayRes) ? todayRes[0] : todayRes) as any || { total_bets: 0, total_wins: 0 };
    const weekRow = (Array.isArray(weekRes) ? weekRes[0] : weekRes) as any || { total_bets: 0, total_wins: 0 };
    const monthRow = (Array.isArray(monthRes) ? monthRes[0] : monthRes) as any || { total_bets: 0, total_wins: 0 };
    const totalRow = (Array.isArray(totalRes) ? totalRes[0] : totalRes) as any || { total_bets: 0, total_wins: 0 };

    setProfitStats({
      todayBets: Number(todayRow.total_bets), todayWins: Number(todayRow.total_wins),
      weekBets: Number(weekRow.total_bets), weekWins: Number(weekRow.total_wins),
      monthBets: Number(monthRow.total_bets), monthWins: Number(monthRow.total_wins),
      totalBets: Number(totalRow.total_bets), totalWins: Number(totalRow.total_wins),
    });

    const allGames = gamesRes.data || [];
    const emptyStats = (): ProfitStats => ({ todayBets: 0, todayWins: 0, weekBets: 0, weekWins: 0, monthBets: 0, monthWins: 0, totalBets: 0, totalWins: 0 });
    const gameMap: Record<string, ProfitStats> = {};
    allGames.forEach(g => { if (!gameMap[g.name]) gameMap[g.name] = emptyStats(); });

    const addFromRpc = (data: any[] | null, field: 'today' | 'week' | 'month') => {
      (data || []).forEach((row: any) => {
        const name = row.game_name || 'Unknown';
        if (!gameMap[name]) gameMap[name] = emptyStats();
        const g = gameMap[name];
        const bet = Number(row.total_bets);
        const win = Number(row.total_wins);
        if (field === 'today') { g.todayBets = bet; g.todayWins = win; }
        if (field === 'week') { g.weekBets = bet; g.weekWins = win; }
        if (field === 'month') { g.monthBets = bet; g.monthWins = win; }
      });
    };
    addFromRpc(Array.isArray(todayGameRes) ? todayGameRes : [], 'today');
    addFromRpc(Array.isArray(weekGameRes) ? weekGameRes : [], 'week');
    addFromRpc(Array.isArray(monthGameRes) ? monthGameRes : [], 'month');
    let allTimeGameData: unknown;
    try {
      allTimeGameData = await api.rpc('get_per_game_stats_by_range', { p_start: '2020-01-01T00:00:00Z' });
    } catch { allTimeGameData = []; }
    (Array.isArray(allTimeGameData) ? allTimeGameData : []).forEach((row: any) => {
      const name = row.game_name || 'Unknown';
      if (!gameMap[name]) gameMap[name] = emptyStats();
      gameMap[name].totalBets = Number(row.total_bets);
      gameMap[name].totalWins = Number(row.total_wins);
    });

    setPerGameStats(gameMap);
  }, []);

  const fetchProfitChart = useCallback(async () => {
    const now = new Date();
    let rangeStart: Date;
    if (profitPeriod === 'daily') {
      rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate() - 14);
    } else if (profitPeriod === 'weekly') {
      rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate() - 56);
    } else {
      rangeStart = new Date(now); rangeStart.setMonth(rangeStart.getMonth() - 6);
    }

    let chartData: unknown;
    try {
      chartData = await api.rpc('get_profit_chart_data', {
        p_start: rangeStart.toISOString(),
        p_period: profitPeriod,
      });
    } catch { setProfitChartData([]); return; }
    const rows = Array.isArray(chartData) ? chartData : [];
    if (rows.length === 0) { setProfitChartData([]); return; }
    setProfitChartData(rows.map((row: any) => ({
      label: row.bucket_label,
      bets: Math.round(Number(row.total_bets)),
      wins: Math.round(Number(row.total_wins)),
      profit: Math.round(Number(row.total_bets) - Number(row.total_wins)),
    })));
  }, [profitPeriod]);

  const fetchPoolsOnly = useCallback(async () => {
    const { data } = await supabase.from('reward_pools').select('game_id, pool_type, balance, total_contributed, total_paid_out');
    if (data) setPoolData(data as PoolData[]);
  }, []);

  useEffect(() => {
    fetchData();
    fetchProfitChart();
    fetchProfitStats();

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchProfitChart, fetchProfitStats]);

  // Refresh Reward Pool Balances every 10s so it updates when users play (e.g. Super Ace)
  useEffect(() => {
    if (poolData.length === 0) return;
    const poolInterval = setInterval(fetchPoolsOnly, 10000);
    return () => clearInterval(poolInterval);
  }, [fetchPoolsOnly, poolData.length]);

  const gameProfit = stats.totalBetAmount - stats.totalWinAmount;
  const netFlow = stats.approvedDeposits - stats.approvedWithdrawals;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5">
      <h1 className="font-heading font-bold text-lg md:text-2xl">📊 Dashboard</h1>

      {/* App Maintenance Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-3 md:p-5 gold-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Wrench size={18} className="text-amber-500" />
          <h2 className="font-heading font-bold text-sm md:text-base">🔧 App Maintenance</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Enable to show a site-wide "Under Maintenance" banner to all users.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={maintenanceMessage}
            onChange={e => setMaintenanceMessage(e.target.value)}
            placeholder="Maintenance message..."
            className="flex-1 px-4 py-2 rounded-xl bg-background border border-border text-sm"
          />
          <div className="flex gap-2">
            {appUnderMaintenance && (
              <button
                onClick={async () => {
                  setSavingMaintenance(true);
                  await setAppMaintenance(true, maintenanceMessage);
                  setSavingMaintenance(false);
                }}
                disabled={maintenanceLoading || savingMaintenance}
                className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-heading font-bold text-sm"
              >
                Save Message
              </button>
            )}
            <button
              onClick={handleToggleAppMaintenance}
              disabled={maintenanceLoading || savingMaintenance}
              className={`px-4 py-2 rounded-xl font-heading font-bold text-sm transition-colors ${
                appUnderMaintenance ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {appUnderMaintenance ? '🟡 Maintenance ON' : 'Maintenance OFF'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Profit Cards */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-primary/20 via-card to-card rounded-2xl p-3 md:p-5 gold-border relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={20} className="text-primary" />
          <h2 className="font-heading font-bold text-sm md:text-lg gold-text">Owner Profit (Real)</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {[
            { label: '📅 Today', bets: profitStats.todayBets, wins: profitStats.todayWins },
            { label: '📆 This Week', bets: profitStats.weekBets, wins: profitStats.weekWins },
            { label: '🗓️ This Month', bets: profitStats.monthBets, wins: profitStats.monthWins },
            { label: '💰 Total', bets: profitStats.totalBets, wins: profitStats.totalWins },
          ].map(({ label, bets, wins }) => {
            const profit = bets - wins;
            return (
              <div key={label} className={`bg-background/50 rounded-xl p-2.5 md:p-4 ${label.includes('Total') ? 'border border-primary/30' : ''}`}>
                <span className="text-[9px] md:text-xs text-muted-foreground block mb-1">{label}</span>
                <p className={`font-heading font-bold text-sm md:text-2xl ${profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
                  ৳{Math.round(profit).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] md:text-[10px] text-cyan-400">B: ৳{Math.round(bets).toLocaleString()}</span>
                  <span className="text-[8px] md:text-[10px] text-emerald-400">W: ৳{Math.round(wins).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:gap-3">
          <div className="bg-background/50 rounded-xl p-2.5 md:p-4">
            <span className="text-[9px] md:text-xs text-muted-foreground block mb-1">💸 Deposit - Withdraw</span>
            <p className={`font-heading font-bold text-sm md:text-2xl ${netFlow >= 0 ? 'text-green-400' : 'text-destructive'}`}>
              ৳{netFlow.toLocaleString()}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-2.5 md:p-4 border border-primary/30">
            <span className="text-[9px] md:text-xs text-muted-foreground block mb-1">🏆 Net Profit (Game + Flow)</span>
            <p className={`font-heading font-bold text-base md:text-3xl ${(gameProfit + netFlow) >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ৳{(gameProfit + netFlow).toLocaleString()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Active Players with Force Controls */}
      <ActivePlayersSection />

      {/* Reward Pool Balances — per game */}
      {poolData.length > 0 && (() => {
        const byGame = poolData.reduce<Record<string, PoolData[]>>((acc, p) => {
          const g = p.game_id ?? 'global';
          if (!acc[g]) acc[g] = [];
          acc[g].push(p);
          return acc;
        }, {});
        const gameIds = Object.keys(byGame).sort((a, b) => (a === 'global' ? -1 : a.localeCompare(b)));
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-3 md:p-5 gold-border"
          >
            <div className="flex items-center gap-2 mb-3">
              <Database size={18} className="text-primary" />
              <h2 className="font-heading font-bold text-sm md:text-base">🏦 Reward Pool Balances (per game)</h2>
            </div>
            <div className="space-y-4">
              {gameIds.map(gameId => {
                const pools = byGame[gameId];
                const labels: Record<string, { label: string; emoji: string; color: string }> = {
                  small_win: { label: 'Small', emoji: '🟢', color: 'text-green-400' },
                  medium_win: { label: 'Medium', emoji: '🟡', color: 'text-amber-400' },
                  big_win: { label: 'Big', emoji: '🟠', color: 'text-orange-400' },
                  jackpot: { label: 'Jackpot', emoji: '🔴', color: 'text-red-400' },
                };
                return (
                  <div key={gameId} className="bg-background/30 rounded-xl p-3 border border-primary/20">
                    <p className="text-xs font-heading font-bold text-primary mb-2 capitalize">{gameId.replace(/-/g, ' ')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['small_win', 'medium_win', 'big_win', 'jackpot'].map(type => {
                        const pool = pools.find(p => p.pool_type === type);
                        if (!pool) return <div key={type} className="text-[10px] text-muted-foreground">—</div>;
                        const info = labels[type];
                        return (
                          <div key={type} className="bg-background/50 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-xs">{info.emoji}</span>
                              <span className="text-[9px] text-muted-foreground">{info.label}</span>
                            </div>
                            <p className={`font-heading font-bold text-sm ${info.color}`}>৳{Math.round(pool.balance).toLocaleString()}</p>
                            <div className="text-[8px] text-muted-foreground">
                              In ৳{Math.round(pool.total_contributed).toLocaleString()} · Out ৳{Math.round(pool.total_paid_out).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}

      {/* Per-Game Profit Stats */}
      {Object.keys(perGameStats).length > 0 && (() => {
        const sorted = Object.entries(perGameStats).sort((a, b) => b[1].totalBets - a[1].totalBets);
        const displayed = showAllGames ? sorted : sorted.slice(0, 6);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm md:text-base flex items-center gap-2">
                  🎮 Per-Game Profit Stats
                  <span className="text-muted-foreground text-xs font-normal">({sorted.length} games)</span>
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">RTP & M = actual from plays (target: 78% RTP / 22% M)</p>
              </div>
              {sorted.length > 6 && (
                <button onClick={() => setShowAllGames(!showAllGames)} className="text-xs text-primary font-bold">
                  {showAllGames ? 'Show Less' : `Show All (${sorted.length})`}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
              {displayed.map(([gameName, gs]) => {
                const totalProfit = gs.totalBets - gs.totalWins;
                const margin = gs.totalBets > 0 ? ((totalProfit / gs.totalBets) * 100).toFixed(1) : '0.0';
                const rtp = gs.totalBets > 0 ? ((gs.totalWins / gs.totalBets) * 100).toFixed(1) : '0.0';
                const todayProfit = gs.todayBets - gs.todayWins;
                const weekProfit = gs.weekBets - gs.weekWins;
                const monthProfit = gs.monthBets - gs.monthWins;
                const isHealthy = Number(margin) >= 15;
                return (
                  <motion.div
                    key={gameName}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl p-3 gold-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-heading font-bold text-xs md:text-sm truncate max-w-[120px]">{gameName}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${Number(rtp) <= 85 ? 'bg-green-500/20 text-green-400' : Number(rtp) <= 95 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          RTP {rtp}%
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isHealthy ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          M {margin}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      {[
                        { label: 'Today', value: todayProfit },
                        { label: 'Week', value: weekProfit },
                        { label: 'Month', value: monthProfit },
                        { label: 'Total', value: totalProfit, highlight: true },
                      ].map(col => (
                        <div key={col.label} className={`bg-background/50 rounded-lg p-1.5 ${col.highlight ? 'border border-primary/20' : ''}`}>
                          <span className="text-[8px] text-muted-foreground block">{col.label}</span>
                          <p className={`font-bold text-[10px] ${col.value >= 0 ? 'text-green-400' : 'text-destructive'}`}>
                            ৳{Math.round(col.value).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[8px] text-muted-foreground">
                      <span>B: ৳{Math.round(gs.totalBets).toLocaleString()}</span>
                      <span>W: ৳{Math.round(gs.totalWins).toLocaleString()}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={15} className="text-blue-400" />
            <span className="text-[10px] md:text-xs text-muted-foreground">Total Users</span>
          </div>
          <p className="font-heading font-bold text-lg md:text-2xl">{stats.totalUsers}</p>
        </div>
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Wifi size={15} className="text-green-400 animate-pulse" />
            <span className="text-[10px] md:text-xs text-muted-foreground">Online Now</span>
          </div>
          <p className="font-heading font-bold text-lg md:text-2xl text-green-400">{stats.totalOnline}</p>
        </div>
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={15} className="text-cyan-400" />
            <span className="text-[10px] md:text-xs text-muted-foreground">Total Bets</span>
          </div>
          <p className="font-heading font-bold text-base md:text-xl">৳{stats.totalBetAmount.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={15} className="text-emerald-400" />
            <span className="text-[10px] md:text-xs text-muted-foreground">Total Wins</span>
          </div>
          <p className="font-heading font-bold text-base md:text-xl">৳{stats.totalWinAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Profit Trend Chart */}
      <div className="bg-card rounded-xl p-3 md:p-5 gold-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-sm md:text-base">📈 Profit Trend</h2>
          <Tabs value={profitPeriod} onValueChange={(v) => setProfitPeriod(v as any)}>
            <TabsList className="h-7 md:h-8 bg-background/60">
              <TabsTrigger value="daily" className="text-[10px] md:text-xs px-2 py-1">Daily</TabsTrigger>
              <TabsTrigger value="weekly" className="text-[10px] md:text-xs px-2 py-1">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="text-[10px] md:text-xs px-2 py-1">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {profitChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={profitChartData}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(43,96%,56%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(43,96%,56%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="betsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210,80%,60%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(210,80%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,40%,25%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(216,65%,18%)', border: '1px solid hsl(43,96%,56%,0.3)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [`৳${value.toLocaleString()}`, name === 'profit' ? 'Profit' : name === 'bets' ? 'Bets' : 'Wins']}
              />
              <Area type="monotone" dataKey="bets" stroke="hsl(210,80%,60%)" fill="url(#betsGrad)" strokeWidth={1.5} name="bets" />
              <Area type="monotone" dataKey="wins" stroke="hsl(142,76%,46%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" name="wins" />
              <Area type="monotone" dataKey="profit" stroke="hsl(43,96%,56%)" fill="url(#profitGrad)" strokeWidth={2} name="profit" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-xs text-center py-10">No game session data yet</p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;