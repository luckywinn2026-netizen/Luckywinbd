import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Plus, Check, X, Loader2, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketManager } from '@/components/admin/MarketManager';

type CyberMatch = {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  status: string;
  result: string | null;
  match_time: string;
  duration_minutes: number;
  created_at: string;
  home_score: number;
  away_score: number;
};

const SPORTS = [
  { value: 'cyber_football', label: '⚽ Cyber Football' },
  { value: 'cyber_cricket', label: '🏏 Cyber Cricket' },
];

const AdminCyberMatches = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // Form state
  const [sport, setSport] = useState('cyber_football');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [oddsHome, setOddsHome] = useState('2.00');
  const [oddsDraw, setOddsDraw] = useState('3.00');
  const [oddsAway, setOddsAway] = useState('2.50');
  const [duration, setDuration] = useState('5');
  const [matchTime, setMatchTime] = useState('');

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['admin-cyber-matches', filter],
    queryFn: async () => {
      let q = supabase.from('cyber_matches').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q.limit(50);
      if (error) throw error;

      // Fetch bet summaries for live/upcoming matches
      const matchIds = (data || []).filter(m => m.status === 'live' || m.status === 'upcoming').map(m => m.id);
      let betSummaries: Record<string, { home: number; draw: number; away: number; home_payout: number; draw_payout: number; away_payout: number }> = {};
      if (matchIds.length > 0) {
        const { data: bets } = await supabase
          .from('cyber_bets')
          .select('match_id, pick, amount, potential_win')
          .in('match_id', matchIds)
          .eq('status', 'pending');
        if (bets) {
          for (const b of bets) {
            if (!betSummaries[b.match_id]) betSummaries[b.match_id] = { home: 0, draw: 0, away: 0, home_payout: 0, draw_payout: 0, away_payout: 0 };
            const s = betSummaries[b.match_id];
            s[b.pick as 'home' | 'draw' | 'away'] += Number(b.amount);
            (s as any)[`${b.pick}_payout`] += Number(b.potential_win);
          }
        }
      }

      return (data || []).map(m => ({ ...m, betSummary: betSummaries[m.id] || null })) as (CyberMatch & { betSummary: any })[];
    },
  });

  const createMatch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cyber_matches').insert({
        sport,
        home_team: homeTeam,
        away_team: awayTeam,
        odds_home: parseFloat(oddsHome),
        odds_draw: parseFloat(oddsDraw),
        odds_away: parseFloat(oddsAway),
        duration_minutes: parseInt(duration),
        match_time: matchTime || new Date(Date.now() + 5 * 60000).toISOString(),
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Match created!');
      qc.invalidateQueries({ queryKey: ['admin-cyber-matches'] });
      setShowCreate(false);
      setHomeTeam('');
      setAwayTeam('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('cyber_matches').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['admin-cyber-matches'] });
    },
  });

  const settleMatch = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: string }) => {
      const data = await api.rpc('settle_cyber_match', { p_match_id: id, p_result: result });
      return data as any;
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`Settled! Winners: ${data.winners}, Losers: ${data.losers}, Paid: ৳${data.total_paid}`);
      } else {
        toast.error(data?.error || 'Failed');
      }
      qc.invalidateQueries({ queryKey: ['admin-cyber-matches'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const autoSettleMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const data = await api.rpc('auto_settle_cyber_match', { p_match_id: matchId });
      return data as any;
    },
    onSuccess: (data) => {
      if (data?.success) {
        const breakdown = data.breakdown || {};
        toast.success(
          `✅ Auto-Settled! Result: ${data.result?.toUpperCase()}\n` +
          `Total Bets: ৳${data.total_bets} | Payout: ৳${data.total_payout} | Profit: ৳${data.profit}`,
          { duration: 6000 }
        );
      } else {
        toast.error(data?.error || 'Auto-settle failed');
      }
      qc.invalidateQueries({ queryKey: ['admin-cyber-matches'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColors: Record<string, string> = {
    upcoming: 'bg-primary/20 text-primary',
    live: 'bg-destructive/20 text-destructive',
    finished: 'bg-muted text-muted-foreground',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-primary" />
          <h1 className="font-heading font-bold text-lg">Cyber Matches</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg gold-gradient font-heading font-bold text-xs text-primary-foreground"
        >
          <Plus size={14} />
          New Match
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-xl p-4 gold-border space-y-3">
              <p className="font-heading font-bold text-sm">Create Match</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Sport</label>
                  <select value={sport} onChange={e => setSport(e.target.value)} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading">
                    {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duration (min)</label>
                  <input value={duration} onChange={e => setDuration(e.target.value)} type="number" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Home Team</label>
                  <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Team A" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Away Team</label>
                  <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Team B" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Odds Home</label>
                  <input value={oddsHome} onChange={e => setOddsHome(e.target.value)} type="number" step="0.01" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Odds Draw</label>
                  <input value={oddsDraw} onChange={e => setOddsDraw(e.target.value)} type="number" step="0.01" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Odds Away</label>
                  <input value={oddsAway} onChange={e => setOddsAway(e.target.value)} type="number" step="0.01" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Match Time</label>
                  <input value={matchTime} onChange={e => setMatchTime(e.target.value)} type="datetime-local" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm font-heading" />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!homeTeam || !awayTeam) return toast.error('Enter both team names');
                  createMatch.mutate();
                }}
                disabled={createMatch.isPending}
                className="w-full py-2.5 rounded-xl gold-gradient font-heading font-bold text-sm text-primary-foreground disabled:opacity-50"
              >
                {createMatch.isPending ? 'Creating...' : 'Create Match'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'upcoming', 'live', 'finished'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-semibold capitalize transition-colors ${
              filter === f ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Matches */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>
      ) : matches.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No matches found</p>
      ) : (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="bg-card rounded-xl p-4 gold-border space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading text-muted-foreground">
                  {m.sport === 'cyber_cricket' ? '🏏 Cyber Cricket' : '⚽ Cyber Football'}
                </span>
                <span className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded-full ${statusColors[m.status]}`}>
                  {m.status.toUpperCase()}
                </span>
              </div>

              {/* Teams & Odds */}
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-foreground flex-1 truncate">{m.home_team}</span>
                <span className="text-xs text-muted-foreground mx-2">vs</span>
                <span className="font-heading font-bold text-sm text-foreground flex-1 truncate text-right">{m.away_team}</span>
              </div>
              <div className="flex gap-2 text-center">
                <div className="flex-1 bg-secondary rounded-lg py-1.5">
                  <p className="text-[10px] text-muted-foreground">Home</p>
                  <p className="text-sm font-heading font-bold text-primary">{Number(m.odds_home).toFixed(2)}</p>
                </div>
                <div className="flex-1 bg-secondary rounded-lg py-1.5">
                  <p className="text-[10px] text-muted-foreground">Draw</p>
                  <p className="text-sm font-heading font-bold text-primary">{Number(m.odds_draw).toFixed(2)}</p>
                </div>
                <div className="flex-1 bg-secondary rounded-lg py-1.5">
                  <p className="text-[10px] text-muted-foreground">Away</p>
                  <p className="text-sm font-heading font-bold text-primary">{Number(m.odds_away).toFixed(2)}</p>
                </div>
              </div>

              {/* Time info */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock size={10} />
                <span>{new Date(m.match_time).toLocaleString()} • {m.duration_minutes} min</span>
              </div>

              {/* Actions */}
              {m.status === 'upcoming' && (
                <div className="space-y-3">
                  <BetBreakdown match={m} />
                  <button
                    onClick={() => updateStatus.mutate({ id: m.id, status: 'live' })}
                    className="w-full py-2 rounded-lg bg-destructive/20 text-destructive font-heading font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Zap size={12} /> Go LIVE
                  </button>
                </div>
              )}
              {m.status === 'live' && (
                <div className="space-y-3">
                  {/* Live Score Controls */}
                  <ScoreControl match={m} qc={qc} />
                  {/* Event Log */}
                  <EventLog matchId={m.id} sport={m.sport} />
                   {/* Extra Markets */}
                   <MarketManager matchId={m.id} sport={m.sport} />
                   {/* Bet Breakdown */}
                   <BetBreakdown match={m} />

                  <p className="text-xs font-heading font-semibold text-foreground">Set Result:</p>
                  
                  {/* Auto Settle Button */}
                  <button
                    onClick={() => {
                      if (confirm('Auto-settle this match for maximum profit?')) {
                        autoSettleMatch.mutate(m.id);
                      }
                    }}
                    disabled={autoSettleMatch.isPending}
                    className="w-full py-2.5 rounded-lg bg-success/20 text-success font-heading font-bold text-xs flex items-center justify-center gap-1.5 border border-success/30 hover:bg-success/30 transition-colors"
                  >
                    {autoSettleMatch.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {autoSettleMatch.isPending ? 'Auto Settling...' : '⚡ Auto Settle (Max Profit)'}
                  </button>

                  <p className="text-[10px] text-muted-foreground text-center">or manually pick result:</p>
                  <div className="flex gap-2">
                    {['home', 'draw', 'away'].map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          if (confirm(`Settle as "${r.toUpperCase()}" winner? This will pay out all bets.`)) {
                            settleMatch.mutate({ id: m.id, result: r });
                          }
                        }}
                        disabled={settleMatch.isPending}
                        className="flex-1 py-2 rounded-lg bg-primary/20 text-primary font-heading font-bold text-xs capitalize hover:bg-primary/30 transition-colors"
                      >
                        {r === 'home' ? m.home_team : r === 'away' ? m.away_team : 'Draw'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {m.status === 'finished' && m.result && (
                <div className="flex items-center gap-1.5 text-xs text-success font-heading">
                  <Check size={12} />
                  <span>
                    Result: {m.result === 'home' ? m.home_team : m.result === 'away' ? m.away_team : 'Draw'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Score Control Component ─── */
const ScoreControl = ({ match, qc }: { match: CyberMatch; qc: any }) => {
  const updateField = async (field: string, value: number | string) => {
    const { error } = await supabase.from('cyber_matches').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', match.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['admin-cyber-matches'] });
  };

  const isCricket = match.sport === 'cyber_cricket';

  // Helper to increment overs properly (0.0 -> 0.1 -> ... -> 0.5 -> 1.0)
  const incrementOver = (current: string) => {
    const [o, b] = current.split('.').map(Number);
    if (b >= 5) return `${o + 1}.0`;
    return `${o}.${b + 1}`;
  };
  const decrementOver = (current: string) => {
    const [o, b] = current.split('.').map(Number);
    if (b <= 0) return o > 0 ? `${o - 1}.5` : '0.0';
    return `${o}.${b - 1}`;
  };

  if (isCricket) {
    return (
      <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
        <p className="text-xs font-heading font-semibold text-foreground">🏏 Live Score</p>
        {/* Home Team */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-heading font-semibold">{match.home_team}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Runs</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateField('home_score', Math.max(0, match.home_score - 1))} className="w-6 h-6 rounded bg-destructive/20 text-destructive font-bold text-xs">−</button>
                <span className="font-heading font-bold text-base text-foreground min-w-[28px] text-center">{match.home_score}</span>
                <button onClick={() => updateField('home_score', match.home_score + 1)} className="w-6 h-6 rounded bg-green-500/20 text-green-400 font-bold text-xs">+</button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Wickets</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateField('home_wickets', Math.max(0, (match as any).home_wickets - 1))} className="w-6 h-6 rounded bg-destructive/20 text-destructive font-bold text-xs">−</button>
                <span className="font-heading font-bold text-base text-foreground min-w-[28px] text-center">{(match as any).home_wickets}</span>
                <button onClick={() => updateField('home_wickets', Math.min(10, (match as any).home_wickets + 1))} className="w-6 h-6 rounded bg-green-500/20 text-green-400 font-bold text-xs">+</button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Overs</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateField('home_overs', decrementOver((match as any).home_overs || '0.0'))} className="w-6 h-6 rounded bg-destructive/20 text-destructive font-bold text-xs">−</button>
                <span className="font-heading font-bold text-base text-foreground min-w-[28px] text-center">{(match as any).home_overs || '0.0'}</span>
                <button onClick={() => updateField('home_overs', incrementOver((match as any).home_overs || '0.0'))} className="w-6 h-6 rounded bg-green-500/20 text-green-400 font-bold text-xs">+</button>
              </div>
            </div>
          </div>
          <p className="text-[10px] font-heading font-bold text-primary text-center">
            {match.home_score}/{(match as any).home_wickets} ({(match as any).home_overs || '0.0'} ov)
          </p>
        </div>
        {/* Divider */}
        <div className="text-center text-muted-foreground font-heading font-bold text-xs">vs</div>
        {/* Away Team */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-heading font-semibold">{match.away_team}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Runs</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateField('away_score', Math.max(0, match.away_score - 1))} className="w-6 h-6 rounded bg-destructive/20 text-destructive font-bold text-xs">−</button>
                <span className="font-heading font-bold text-base text-foreground min-w-[28px] text-center">{match.away_score}</span>
                <button onClick={() => updateField('away_score', match.away_score + 1)} className="w-6 h-6 rounded bg-green-500/20 text-green-400 font-bold text-xs">+</button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Wickets</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateField('away_wickets', Math.max(0, (match as any).away_wickets - 1))} className="w-6 h-6 rounded bg-destructive/20 text-destructive font-bold text-xs">−</button>
                <span className="font-heading font-bold text-base text-foreground min-w-[28px] text-center">{(match as any).away_wickets}</span>
                <button onClick={() => updateField('away_wickets', Math.min(10, (match as any).away_wickets + 1))} className="w-6 h-6 rounded bg-green-500/20 text-green-400 font-bold text-xs">+</button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Overs</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateField('away_overs', decrementOver((match as any).away_overs || '0.0'))} className="w-6 h-6 rounded bg-destructive/20 text-destructive font-bold text-xs">−</button>
                <span className="font-heading font-bold text-base text-foreground min-w-[28px] text-center">{(match as any).away_overs || '0.0'}</span>
                <button onClick={() => updateField('away_overs', incrementOver((match as any).away_overs || '0.0'))} className="w-6 h-6 rounded bg-green-500/20 text-green-400 font-bold text-xs">+</button>
              </div>
            </div>
          </div>
          <p className="text-[10px] font-heading font-bold text-primary text-center">
            {match.away_score}/{(match as any).away_wickets} ({(match as any).away_overs || '0.0'} ov)
          </p>
        </div>
      </div>
    );
  }

  // Football score control (unchanged logic)
  return (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
      <p className="text-xs font-heading font-semibold text-foreground">⚽ Live Score (Goals)</p>
      <div className="flex items-center gap-4">
        <div className="flex-1 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground truncate">{match.home_team}</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => updateField('home_score', Math.max(0, match.home_score - 1))} className="w-7 h-7 rounded-lg bg-destructive/20 text-destructive font-bold text-sm">−</button>
            <span className="font-heading font-bold text-lg text-foreground min-w-[24px]">{match.home_score}</span>
            <button onClick={() => updateField('home_score', match.home_score + 1)} className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 font-bold text-sm">+</button>
          </div>
        </div>
        <span className="text-muted-foreground font-heading font-bold">vs</span>
        <div className="flex-1 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground truncate">{match.away_team}</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => updateField('away_score', Math.max(0, match.away_score - 1))} className="w-7 h-7 rounded-lg bg-destructive/20 text-destructive font-bold text-sm">−</button>
            <span className="font-heading font-bold text-lg text-foreground min-w-[24px]">{match.away_score}</span>
            <button onClick={() => updateField('away_score', match.away_score + 1)} className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 font-bold text-sm">+</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Bet Breakdown Component ─── */
const BetBreakdown = ({ match }: { match: CyberMatch & { betSummary: any } }) => {
  const s = match.betSummary;
  if (!s) return (
    <p className="text-[10px] text-muted-foreground text-center py-1">No bets yet</p>
  );

  const totalBets = s.home + s.draw + s.away;
  const picks = [
    { key: 'home', label: match.home_team, bets: s.home, payout: s.home_payout },
    { key: 'draw', label: 'Draw', bets: s.draw, payout: s.draw_payout },
    { key: 'away', label: match.away_team, bets: s.away, payout: s.away_payout },
  ];

  return (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-heading font-semibold text-foreground">💰 Bet Breakdown</p>
        <p className="text-[10px] font-heading text-muted-foreground">Total: ৳{totalBets.toLocaleString()}</p>
      </div>
      <div className="space-y-1.5">
        {picks.map(p => {
          const pct = totalBets > 0 ? (p.bets / totalBets * 100) : 0;
          const profit = totalBets - p.payout; // if this pick wins
          return (
            <div key={p.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-heading font-semibold text-foreground truncate max-w-[100px]">{p.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">৳{p.bets.toLocaleString()} ({pct.toFixed(0)}%)</span>
                  <span className={`font-heading font-bold ${profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
                    {profit >= 0 ? '+' : ''}৳{profit.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Profit/Loss = Total Bets − Payout if that pick wins
      </p>
    </div>
  );
};

/* ─── Event Log Component ─── */
const EVENT_TYPES: Record<string, { emoji: string; label: string }> = {
  goal: { emoji: '⚽', label: 'Goal' },
  wicket: { emoji: '🏏', label: 'Wicket' },
  card_yellow: { emoji: '🟨', label: 'Yellow Card' },
  card_red: { emoji: '🟥', label: 'Red Card' },
  penalty: { emoji: '🎯', label: 'Penalty' },
  six: { emoji: '6️⃣', label: 'Six' },
  four: { emoji: '4️⃣', label: 'Four' },
  info: { emoji: '📢', label: 'Info' },
};

const EventLog = ({ matchId, sport }: { matchId: string; sport: string }) => {
  const [eventType, setEventType] = useState('info');
  const [eventText, setEventText] = useState('');
  const [minute, setMinute] = useState('');
  const [posting, setPosting] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const fetchEvents = async () => {
    const { data } = await supabase.from('cyber_match_events').select('*').eq('match_id', matchId).order('created_at', { ascending: false }).limit(20);
    setEvents(data || []);
  };

  useEffect(() => { fetchEvents(); }, [matchId]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`events-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cyber_match_events', filter: `match_id=eq.${matchId}` }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId]);

  const quickTypes = sport === 'cyber_cricket'
    ? ['wicket', 'six', 'four', 'info']
    : ['goal', 'card_yellow', 'card_red', 'penalty', 'info'];

  const addEvent = async () => {
    if (!eventText.trim()) return toast.error('Enter event text');
    setPosting(true);
    const { error } = await supabase.from('cyber_match_events').insert({
      match_id: matchId,
      event_type: eventType,
      event_text: eventText.trim(),
      minute: minute ? parseInt(minute) : null,
    });
    if (error) toast.error(error.message);
    else { setEventText(''); setMinute(''); }
    setPosting(false);
  };

  return (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
      <p className="text-xs font-heading font-semibold text-foreground">📋 Live Commentary</p>
      
      {/* Quick type buttons */}
      <div className="flex gap-1 flex-wrap">
        {quickTypes.map(t => {
          const cfg = EVENT_TYPES[t];
          return (
            <button
              key={t}
              onClick={() => setEventType(t)}
              className={`px-2 py-1 rounded text-[10px] font-heading font-bold transition-colors ${
                eventType === t ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'
              }`}
            >
              {cfg.emoji} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={minute}
          onChange={e => setMinute(e.target.value)}
          placeholder="Min"
          type="number"
          className="w-14 bg-muted rounded-lg px-2 py-1.5 text-xs font-heading"
        />
        <input
          value={eventText}
          onChange={e => setEventText(e.target.value)}
          placeholder="Event description..."
          className="flex-1 bg-muted rounded-lg px-3 py-1.5 text-xs font-heading"
          onKeyDown={e => e.key === 'Enter' && addEvent()}
        />
        <button
          onClick={addEvent}
          disabled={posting}
          className="px-3 py-1.5 rounded-lg gold-gradient font-heading font-bold text-[10px] text-primary-foreground disabled:opacity-50"
        >
          Post
        </button>
      </div>

      {/* Recent events */}
      {events.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {events.map(ev => (
            <div key={ev.id} className="flex items-start gap-2 text-[10px]">
              <span>{EVENT_TYPES[ev.event_type]?.emoji || '📢'}</span>
              {ev.minute != null && <span className="text-primary font-heading font-bold">{ev.minute}'</span>}
              <span className="text-muted-foreground flex-1">{ev.event_text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCyberMatches;
