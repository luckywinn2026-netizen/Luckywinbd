import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Radio, TrendingUp, Users, Gamepad2, RefreshCw } from 'lucide-react';

type ActivePlayer = {
  id: string;
  user_id: string;
  game_name: string;
  game_display_name: string | null;
  game_type: string;
  bet_amount: number;
  last_active_at: string;
  started_at: string;
  username?: string;
};

type LiveSession = {
  id: string;
  user_id: string;
  game_name: string | null;
  game_type: string;
  bet_amount: number;
  win_amount: number;
  multiplier: number | null;
  result: string;
  created_at: string;
  username?: string;
};

const AdminLiveMonitor = () => {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [stats, setStats] = useState({ totalBets: 0, totalWins: 0, activePlayers: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchRecent(), fetchActivePlayers()]);
    setRefreshing(false);
  };

  const enrichWithUsername = async (session: any): Promise<LiveSession> => {
    const { data } = await supabase.from('profiles').select('username').eq('user_id', session.user_id).single();
    return { ...session, username: data?.username || session.user_id.slice(0, 8) };
  };

  const fetchActivePlayers = async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('active_players')
      .select('*')
      .gte('last_active_at', twoMinutesAgo)
      .order('last_active_at', { ascending: false });
    if (!data) return;

    // Enrich with usernames
    const enriched = await Promise.all(data.map(async (p) => {
      const { data: profile } = await supabase.from('profiles').select('username').eq('user_id', p.user_id).single();
      return { ...p, username: profile?.username || p.user_id.slice(0, 8) };
    }));
    setActivePlayers(enriched);
  };

  const fetchRecent = async () => {
    const { data } = await supabase
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!data) return;
    const enriched = await Promise.all(data.map(enrichWithUsername));
    setSessions(enriched);
    updateStats(enriched);
  };

  const updateStats = (list: LiveSession[]) => {
    const now = new Date();
    const last10min = list.filter(s => (now.getTime() - new Date(s.created_at).getTime()) < 600000);
    const players = new Set(last10min.map(s => s.user_id));
    setStats({
      totalBets: last10min.reduce((sum, s) => sum + Number(s.bet_amount), 0),
      totalWins: last10min.reduce((sum, s) => sum + Number(s.win_amount), 0),
      activePlayers: players.size,
    });
  };

  useEffect(() => {
    fetchRecent();
    fetchActivePlayers();

    const pollInterval = setInterval(fetchActivePlayers, 8000);

    const sessionChannel = supabase
      .channel('live-game-sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_sessions' }, async (payload) => {
        const enriched = await enrichWithUsername(payload.new);
        setSessions(prev => {
          const updated = [enriched, ...prev.slice(0, 49)];
          updateStats(updated);
          return updated;
        });
      })
      .subscribe();

    const activeChannel = supabase
      .channel('live-active-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_players' }, () => {
        fetchActivePlayers();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(activeChannel);
    };
  }, []);

  const profit = stats.totalBets - stats.totalWins;

  // Group active players by game type
  const gameGroups = activePlayers.reduce((acc, p) => {
    const key = p.game_display_name || p.game_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, ActivePlayer[]>);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Radio size={24} className="text-destructive animate-pulse" />
        <h1 className="font-heading font-bold text-lg md:text-2xl">Live Game Monitor</h1>
        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-heading font-bold animate-pulse">● LIVE</span>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="ml-auto min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-heading font-bold transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl gold-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users size={12} /> Online (last 2m)</p>
          <p className="text-2xl font-heading font-bold text-green-400">{activePlayers.length}</p>
        </div>
        <div className="bg-card rounded-xl gold-border p-4">
          <p className="text-xs text-muted-foreground">Active Players (10m)</p>
          <p className="text-2xl font-heading font-bold text-primary">{stats.activePlayers}</p>
        </div>
        <div className="bg-card rounded-xl gold-border p-4">
          <p className="text-xs text-muted-foreground">Total Bets (10m)</p>
          <p className="text-2xl font-heading font-bold text-cyan-400">৳{stats.totalBets.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl gold-border p-4">
          <p className="text-xs text-muted-foreground">Total Wins (10m)</p>
          <p className="text-2xl font-heading font-bold text-green-400">৳{stats.totalWins.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl gold-border p-4">
          <p className="text-xs text-muted-foreground">Profit (10m)</p>
          <p className={`text-2xl font-heading font-bold ${profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
            ৳{profit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Active Players by Game */}
      {activePlayers.length > 0 && (
        <div className="bg-card rounded-xl gold-border overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Gamepad2 size={16} className="text-green-400" />
            <h3 className="font-heading font-bold">🟢 Online Players ({activePlayers.length})</h3>
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(gameGroups).map(([game, players]) => (
              <div key={game} className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-heading font-bold text-sm">{game}</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-heading font-bold">
                    {players.length} playing
                  </span>
                </div>
                <div className="space-y-1">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{p.username}</span>
                      <span className="text-cyan-400 font-heading font-bold">৳{Number(p.bet_amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Feed */}
      <div className="bg-card rounded-xl gold-border overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-heading font-bold text-sm md:text-base">Live Feed — Recent 50 Sessions</h3>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Mobile: Card layout */}
          <div className="md:hidden p-3 space-y-2">
            {sessions.map((s, i) => (
              <div key={s.id} className={`bg-secondary/50 rounded-lg p-3 space-y-2 ${i === 0 ? 'ring-2 ring-primary/50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-heading font-medium text-sm">{s.username}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-heading font-bold ${
                    s.result === 'win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>{s.result === 'win' ? '✅ WIN' : '💥 LOSS'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Game:</span> {s.game_name || s.game_type}</div>
                  <div><span className="text-muted-foreground">Bet:</span> <span className="text-cyan-400 font-bold">৳{Number(s.bet_amount).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Win:</span> {Number(s.win_amount) > 0 ? <span className="text-green-400 font-bold">৳{Number(s.win_amount).toLocaleString()}</span> : '৳0'}</div>
                  <div><span className="text-muted-foreground">Multi:</span> {s.multiplier ? `${s.multiplier}x` : '-'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Time:</span> {new Date(s.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-center text-muted-foreground py-12 text-sm">No game sessions yet — waiting for players...</p>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left p-3">Player</th>
                  <th className="text-left p-3">Game</th>
                  <th className="text-left p-3">Bet</th>
                  <th className="text-left p-3">Win</th>
                  <th className="text-left p-3">Multi</th>
                  <th className="text-left p-3">Result</th>
                  <th className="text-left p-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} className={`border-t border-border hover:bg-secondary/50 transition-colors ${i === 0 ? 'bg-primary/5' : ''}`}>
                    <td className="p-3 font-heading font-medium">{s.username}</td>
                    <td className="p-3 text-muted-foreground">{s.game_name || s.game_type}</td>
                    <td className="p-3 text-cyan-400 font-heading font-bold">৳{Number(s.bet_amount).toLocaleString()}</td>
                    <td className="p-3 font-heading font-bold">
                      {Number(s.win_amount) > 0 ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <TrendingUp size={14} /> ৳{Number(s.win_amount).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">৳0</span>
                      )}
                    </td>
                    <td className="p-3 text-primary font-heading font-bold">{s.multiplier ? `${s.multiplier}x` : '-'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-heading font-bold ${
                        s.result === 'win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {s.result === 'win' ? '✅ WIN' : '💥 LOSS'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && (
              <p className="text-center text-muted-foreground py-12 text-sm">No game sessions yet — waiting for players...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLiveMonitor;
