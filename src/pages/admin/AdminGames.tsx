import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gamepad2, Upload, Users, TrendingUp, TrendingDown, Eye, ImageIcon, Rocket, Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface GameRow {
  id: string;
  game_id: string;
  game_type: string;
  name: string;
  emoji: string;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  popular: boolean;
  under_maintenance: boolean;
}

interface GameAnalytics {
  totalPlays: number;
  totalBets: number;
  totalWins: number;
  profit: number;
  uniquePlayers: Set<string>;
  activeLast10min: Set<string>;
  playerStats: Record<string, { bets: number; wins: number; plays: number; username?: string }>;
}

const AdminGames = () => {
  const [games, setGames] = useState<GameRow[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [analytics, setAnalytics] = useState<Record<string, GameAnalytics>>({});
  const [selectedGame, setSelectedGame] = useState<GameRow | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [tab, setTab] = useState<'slots' | 'crash' | 'ludo'>('slots');

  const fetchData = useCallback(async () => {
    const [gamesRes, sessionsRes, profilesRes] = await Promise.all([
      supabase.from('games').select('*').order('sort_order'),
      supabase.from('game_sessions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('profiles').select('user_id, username'),
    ]);

    if (gamesRes.data) setGames(gamesRes.data as GameRow[]);

    const profileMap: Record<string, string> = {};
    profilesRes.data?.forEach((p: any) => { profileMap[p.user_id] = p.username || p.user_id.slice(0, 8); });
    setProfiles(profileMap);

    if (sessionsRes.data) {
      setSessions(sessionsRes.data);
      buildAnalytics(sessionsRes.data, profileMap);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Subscribe to realtime game sessions
  useEffect(() => {
    const channel = supabase
      .channel('admin-games-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_sessions' }, (payload) => {
        setSessions(prev => {
          const updated = [payload.new, ...prev].slice(0, 1000);
          buildAnalytics(updated, profiles);
          return updated;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profiles]);

  const buildAnalytics = (data: any[], profileMap: Record<string, string>) => {
    const now = Date.now();
    const tenMinAgo = now - 10 * 60 * 1000;
    const result: Record<string, GameAnalytics> = {};

    data.forEach(s => {
      const key = s.game_id || s.game_name || s.game_type;
      if (!result[key]) {
        result[key] = { totalPlays: 0, totalBets: 0, totalWins: 0, profit: 0, uniquePlayers: new Set(), activeLast10min: new Set(), playerStats: {} };
      }
      const g = result[key];
      g.totalPlays++;
      g.totalBets += Number(s.bet_amount);
      g.totalWins += Number(s.win_amount);
      g.profit = g.totalBets - g.totalWins;
      g.uniquePlayers.add(s.user_id);

      if (new Date(s.created_at).getTime() > tenMinAgo) {
        g.activeLast10min.add(s.user_id);
      }

      if (!g.playerStats[s.user_id]) {
        g.playerStats[s.user_id] = { bets: 0, wins: 0, plays: 0, username: profileMap[s.user_id] || s.user_id.slice(0, 8) };
      }
      g.playerStats[s.user_id].bets += Number(s.bet_amount);
      g.playerStats[s.user_id].wins += Number(s.win_amount);
      g.playerStats[s.user_id].plays++;
    });

    setAnalytics(result);
  };

  const handleThumbnailUpload = async (game: GameRow, file: File) => {
    setUploading(game.game_id);
    try {
      const ext = file.name.split('.').pop();
      const path = `${game.game_id}/thumbnail.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('game-thumbnails')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('game-thumbnails').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('games')
        .update({ thumbnail_url: urlData.publicUrl + '?t=' + Date.now() })
        .eq('id', game.id);

      if (updateError) throw updateError;

      toast.success(`${game.name} thumbnail updated!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const toggleActive = async (game: GameRow) => {
    await supabase.from('games').update({ is_active: !game.is_active }).eq('id', game.id);
    toast.success(`${game.name} ${game.is_active ? 'disabled' : 'enabled'}`);
    fetchData();
  };

  const togglePopular = async (game: GameRow) => {
    await supabase.from('games').update({ popular: !game.popular }).eq('id', game.id);
    toast.success(`${game.name} ${game.popular ? 'removed from' : 'added to'} popular`);
    fetchData();
  };

  const toggleMaintenance = async (game: GameRow) => {
    await supabase.from('games').update({ under_maintenance: !(game.under_maintenance ?? false) }).eq('id', game.id);
    toast.success(`${game.name} ${game.under_maintenance ? 'back online' : 'under maintenance'}`);
    fetchData();
  };

  const filteredGames = games.filter(g => tab === 'slots' ? g.game_type === 'slot' : tab === 'crash' ? g.game_type === 'crash' : g.game_type === 'ludo');

  return (
    <div className="p-3 md:p-6 space-y-5">
      <h1 className="font-heading font-bold text-lg md:text-2xl">🎮 Game Management</h1>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setTab('slots'); setSelectedGame(null); }}
          className={`min-h-[44px] px-3 py-2 rounded-lg font-heading font-bold text-xs md:text-sm transition-colors ${tab === 'slots' ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          🎰 Slots ({games.filter(g => g.game_type === 'slot').length})
        </button>
        <button onClick={() => { setTab('crash'); setSelectedGame(null); }}
          className={`min-h-[44px] px-3 py-2 rounded-lg font-heading font-bold text-xs md:text-sm transition-colors ${tab === 'crash' ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          🚀 Crash ({games.filter(g => g.game_type === 'crash').length})
        </button>
        <button onClick={() => { setTab('ludo'); setSelectedGame(null); }}
          className={`min-h-[44px] px-3 py-2 rounded-lg font-heading font-bold text-xs md:text-sm transition-colors ${tab === 'ludo' ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          🎲 Ludo ({games.filter(g => g.game_type === 'ludo').length})
        </button>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGames.map(game => {
          const stats = analytics[game.game_id];
          const rtp = stats && stats.totalBets > 0 ? ((stats.totalWins / stats.totalBets) * 100).toFixed(1) : '0.0';
          const profit = stats ? stats.profit : 0;
          const liveCount = stats ? stats.activeLast10min.size : 0;

          return (
            <div key={game.id}
              className={`bg-card rounded-xl gold-border overflow-hidden transition-all cursor-pointer hover:ring-2 hover:ring-primary/50 ${selectedGame?.id === game.id ? 'ring-2 ring-primary' : ''} ${!game.is_active ? 'opacity-50' : ''}`}
              onClick={() => setSelectedGame(selectedGame?.id === game.id ? null : game)}
            >
              {/* Thumbnail */}
              <div className="relative h-32 bg-secondary flex items-center justify-center">
                {game.thumbnail_url ? (
                  <img src={game.thumbnail_url} alt={game.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={40} className="text-muted-foreground" />
                )}
                {/* Live badge */}
                {liveCount > 0 && (
                  <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-heading font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {liveCount} Live
                  </span>
                )}
                {/* Upload button */}
                <label className="absolute top-2 right-2 bg-card/80 backdrop-blur rounded-lg p-1.5 cursor-pointer hover:bg-card transition-colors"
                  onClick={e => e.stopPropagation()}>
                  <Upload size={14} className="text-primary" />
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleThumbnailUpload(game, e.target.files[0]); }}
                    disabled={uploading === game.game_id}
                  />
                </label>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-sm">{game.emoji} {game.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <button onClick={e => { e.stopPropagation(); toggleMaintenance(game); }}
                      className={`min-h-[32px] min-w-[32px] text-[10px] font-heading font-bold px-2 py-1 rounded ${(game.under_maintenance ?? false) ? 'bg-amber-500/20 text-amber-400' : 'bg-secondary text-muted-foreground'}`}
                      title={(game.under_maintenance ?? false) ? 'Under maintenance' : 'Mark under maintenance'}>
                      {(game.under_maintenance ?? false) ? '🔧 MNT' : '🔧'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); togglePopular(game); }}
                      className={`min-h-[32px] min-w-[32px] text-[10px] font-heading font-bold px-2 py-1 rounded ${game.popular ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'}`}>
                      {game.popular ? '⭐ POP' : '☆'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); toggleActive(game); }}
                      className={`min-h-[32px] min-w-[32px] text-[10px] font-heading font-bold px-2 py-1 rounded ${game.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {game.is_active ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="text-center">
                    <p className="text-muted-foreground">Players</p>
                    <p className="font-heading font-bold">{stats ? stats.uniquePlayers.size : 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">RTP</p>
                    <p className={`font-heading font-bold ${Number(rtp) > 96 ? 'text-red-400' : 'text-green-400'}`}>{rtp}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Profit</p>
                    <p className={`font-heading font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ৳{Math.abs(profit).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Game Detail Panel */}
      {selectedGame && (
        <div className="bg-card rounded-xl gold-border p-3 md:p-5 space-y-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading font-bold text-base md:text-xl">{selectedGame.emoji} {selectedGame.name} — Details</h2>
            <button onClick={() => setSelectedGame(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary">Close ✕</button>
          </div>

          {(() => {
            const stats = analytics[selectedGame.game_id] || analytics[selectedGame.name];
            if (!stats || stats.totalPlays === 0) return <p className="text-muted-foreground text-sm">No play data for this game yet.</p>;

            const playerEntries = Object.entries(stats.playerStats).sort((a, b) => b[1].bets - a[1].bets);

            return (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard icon={<Eye size={16} />} label="Total Plays" value={stats.totalPlays.toString()} />
                  <StatCard icon={<Users size={16} />} label="Unique Players" value={stats.uniquePlayers.size.toString()} />
                  <StatCard icon={<TrendingDown size={16} />} label="Total Bets" value={`৳${stats.totalBets.toLocaleString()}`} color="text-cyan-400" />
                  <StatCard icon={<TrendingUp size={16} />} label="Total Wins" value={`৳${stats.totalWins.toLocaleString()}`} color="text-green-400" />
                  <StatCard icon={<Gamepad2 size={16} />} label="System Profit" value={`৳${stats.profit.toLocaleString()}`}
                    color={stats.profit >= 0 ? 'text-green-400' : 'text-red-400'} />
                </div>

                {/* Per-Player Table */}
                <div>
                  <h3 className="font-heading font-bold text-sm mb-2">👥 Player-wise Breakdown</h3>
                  {/* Mobile: Card layout */}
                  <div className="md:hidden space-y-2">
                    {playerEntries.map(([userId, ps]) => {
                      const playerPL = ps.wins - ps.bets;
                      const systemEarn = ps.bets - ps.wins;
                      return (
                        <div key={userId} className="bg-secondary/50 rounded-xl p-3 space-y-2">
                          <p className="font-heading font-medium text-sm">{ps.username}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Plays:</span> {ps.plays}</div>
                            <div><span className="text-muted-foreground">Bet:</span> <span className="text-cyan-400">৳{ps.bets.toLocaleString()}</span></div>
                            <div><span className="text-muted-foreground">Win:</span> <span className="text-green-400">৳{ps.wins.toLocaleString()}</span></div>
                            <div><span className="text-muted-foreground">P/L:</span> <span className={playerPL >= 0 ? 'text-green-400' : 'text-red-400'}>{playerPL >= 0 ? '+' : ''}৳{playerPL.toLocaleString()}</span></div>
                            <div className="col-span-2"><span className="text-muted-foreground">System Earn:</span> <span className={systemEarn >= 0 ? 'text-green-400' : 'text-red-400'}>{systemEarn >= 0 ? '+' : ''}৳{systemEarn.toLocaleString()}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop: Table */}
                  <div className="hidden md:block bg-secondary/50 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="text-muted-foreground text-xs border-b border-border">
                          <th className="text-left p-3">Player</th>
                          <th className="text-left p-3">Plays</th>
                          <th className="text-left p-3">Total Bet</th>
                          <th className="text-left p-3">Total Win</th>
                          <th className="text-left p-3">Profit/Loss</th>
                          <th className="text-left p-3">System Earn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerEntries.map(([userId, ps]) => {
                          const playerPL = ps.wins - ps.bets;
                          const systemEarn = ps.bets - ps.wins;
                          return (
                            <tr key={userId} className="border-t border-border/50 hover:bg-secondary/80">
                              <td className="p-3 font-heading font-medium">{ps.username}</td>
                              <td className="p-3">{ps.plays}</td>
                              <td className="p-3 text-cyan-400">৳{ps.bets.toLocaleString()}</td>
                              <td className="p-3 text-green-400">৳{ps.wins.toLocaleString()}</td>
                              <td className={`p-3 font-bold ${playerPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {playerPL >= 0 ? '+' : ''}৳{playerPL.toLocaleString()}
                              </td>
                              <td className={`p-3 font-bold ${systemEarn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {systemEarn >= 0 ? '+' : ''}৳{systemEarn.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Sessions for this game */}
                <div>
                  <h3 className="font-heading font-bold text-sm mb-2">📋 Recent Sessions</h3>
                  {/* Mobile: Card layout */}
                  <div className="md:hidden space-y-2 max-h-[250px] overflow-y-auto">
                    {sessions
                      .filter(s => (s.game_id || s.game_name || s.game_type) === selectedGame.game_id)
                      .slice(0, 50)
                      .map(s => (
                        <div key={s.id} className="bg-secondary/50 rounded-xl p-3 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="font-heading">{profiles[s.user_id] || s.user_id.slice(0, 8)}</span>
                            <span className={`px-2 py-0.5 rounded ${s.result === 'win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{s.result}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <span>Bet: ৳{Number(s.bet_amount).toLocaleString()}</span>
                            <span>Win: ৳{Number(s.win_amount).toLocaleString()}</span>
                            <span>Multi: {s.multiplier ? `${s.multiplier}x` : '-'}</span>
                            <span>{new Date(s.created_at).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                  {/* Desktop: Table */}
                  <div className="hidden md:block bg-secondary/50 rounded-xl overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead className="sticky top-0 bg-secondary">
                        <tr className="text-muted-foreground text-xs border-b border-border">
                          <th className="text-left p-3">Player</th>
                          <th className="text-left p-3">Bet</th>
                          <th className="text-left p-3">Win</th>
                          <th className="text-left p-3">Multi</th>
                          <th className="text-left p-3">Result</th>
                          <th className="text-left p-3">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions
                          .filter(s => (s.game_id || s.game_name || s.game_type) === selectedGame.game_id)
                          .slice(0, 50)
                          .map(s => (
                            <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/80">
                              <td className="p-3 font-heading">{profiles[s.user_id] || s.user_id.slice(0, 8)}</td>
                              <td className="p-3 text-cyan-400">৳{Number(s.bet_amount).toLocaleString()}</td>
                              <td className="p-3 text-green-400">৳{Number(s.win_amount).toLocaleString()}</td>
                              <td className="p-3 text-primary">{s.multiplier ? `${s.multiplier}x` : '-'}</td>
                              <td className="p-3">
                                <span className={`text-xs px-2 py-0.5 rounded ${s.result === 'win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {s.result}
                                </span>
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) => (
  <div className="bg-secondary/50 rounded-xl p-3 text-center">
    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{icon}<span className="text-[10px]">{label}</span></div>
    <p className={`font-heading font-bold text-lg ${color || 'text-foreground'}`}>{value}</p>
  </div>
);

export default AdminGames;
