import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface LeaderboardEntry {
  rank: number;
  name: string;
  winnings: number;
  games: number;
  topGame: string;
}

const rankIcons = ['', '🥇', '🥈', '🥉'];

type Tab = 'weekly' | 'alltime';

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('weekly');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStats, setMyStats] = useState<{ rank: number; winnings: number; games: number } | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      let rows: unknown;
      try {
        rows = await api.rpc('get_leaderboard', { time_range: tab });
      } catch { rows = null; }
      if (rows && Array.isArray(rows)) {
        const entries: LeaderboardEntry[] = rows.map((r: any, i: number) => ({
          rank: i + 1,
          name: r.username || 'Player',
          winnings: Number(r.total_winnings),
          games: Number(r.total_games),
          topGame: r.top_game || '-',
        }));
        setData(entries);

        // Find current user's rank
        if (user) {
          const idx = rows.findIndex((r: any) => r.user_id === user.id);
          if (idx >= 0) {
            setMyStats({ rank: idx + 1, winnings: Number(rows[idx].total_winnings), games: Number(rows[idx].total_games) });
          } else {
            setMyStats({ rank: 0, winnings: 0, games: 0 });
          }
        }
      } else {
        setData([]);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, [tab, user]);

  return (
    <div className="min-h-screen navy-gradient pb-8">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg gold-text">🏆 Leaderboard</h1>
      </div>

      <div className="flex gap-2 mx-4 mb-4">
        {(['weekly', 'alltime'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl font-heading font-bold text-sm capitalize transition-colors ${
              tab === t ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {t === 'weekly' ? '📅 This Week' : '🌟 All Time'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground font-heading">Loading...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground font-heading">No data yet. Start playing! 🎮</div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {data.length >= 3 && (
            <div className="flex items-end justify-center gap-2 mx-4 mb-6 h-44">
              {[1, 0, 2].map((idx) => {
                const entry = data[idx];
                if (!entry) return null;
                const isFirst = idx === 0;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div className={`${isFirst ? 'w-14 h-14' : 'w-12 h-12'} rounded-full ${isFirst ? 'gold-gradient animate-pulse-glow' : 'bg-secondary'} flex items-center justify-center text-xl mb-1`}>
                      {rankIcons[entry.rank]}
                    </div>
                    <p className="text-xs font-heading font-bold truncate max-w-full">{entry.name}</p>
                    <div className={`w-full ${isFirst ? 'bg-gradient-to-b from-primary to-gold-dark h-28' : entry.rank === 2 ? 'bg-gradient-to-b from-[hsl(210,15%,50%)] to-[hsl(210,15%,35%)] h-20' : 'bg-gradient-to-b from-[hsl(25,60%,45%)] to-[hsl(30,50%,30%)] h-16'} rounded-t-xl mt-1 flex items-center justify-center`}>
                      <div className="text-center">
                        <p className={`font-heading font-bold ${isFirst ? 'text-lg text-primary-foreground' : 'text-sm text-foreground'}`}>৳{(entry.winnings / 1000).toFixed(1)}K</p>
                        <p className={`text-[10px] ${isFirst ? 'text-primary-foreground/70' : 'text-foreground/60'}`}>#{entry.rank}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full List */}
          <div className="mx-4 space-y-2">
            {data.slice(3).map((entry, i) => {
              const isUser = user && myStats && myStats.rank === entry.rank;
              return (
                <motion.div
                  key={entry.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`flex items-center gap-3 rounded-xl p-3 ${isUser ? 'gold-border bg-primary/10' : 'bg-card gold-border'}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-heading font-bold text-sm ${isUser ? 'gold-gradient text-primary-foreground' : 'bg-secondary'}`}>
                    {entry.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm truncate">
                      {entry.name}
                      {isUser && <span className="text-primary ml-1">(You)</span>}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{entry.games} games</span>
                      <span>•</span>
                      <span>{entry.topGame}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-sm text-success">৳{entry.winnings.toLocaleString()}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Your Stats */}
      {myStats && (
        <div className="mx-4 mt-6">
          <div className="bg-card rounded-xl p-4 gold-border card-glow">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-primary" />
              <p className="font-heading font-bold text-sm">Your Ranking</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-secondary rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Rank</p>
                <p className="font-heading font-bold text-lg text-primary">{myStats.rank > 0 ? `#${myStats.rank}` : '—'}</p>
              </div>
              <div className="bg-secondary rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Winnings</p>
                <p className="font-heading font-bold text-lg">৳{myStats.winnings.toLocaleString()}</p>
              </div>
              <div className="bg-secondary rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Games</p>
                <p className="font-heading font-bold text-lg">{myStats.games}</p>
              </div>
            </div>
            {myStats.rank === 0 && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Place bets to climb the leaderboard! 🚀</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
