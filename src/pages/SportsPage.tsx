import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Clock, Loader2, TrendingUp, Zap, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { MatchMarkets } from '@/components/sports/MatchMarkets';

type Sport = 'cyber_football' | 'cyber_cricket';
type MatchFilter = 'live' | 'upcoming' | 'finished';

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
  home_score: number;
  away_score: number;
  home_wickets: number;
  away_wickets: number;
  home_overs: string;
  away_overs: string;
};

const BET_AMOUNTS = [50, 100, 200, 500, 1000];

const SportsPage = () => {
  const { user, openAuth } = useAuth();
  const { balance, placeBet } = useWallet();
  const qc = useQueryClient();
  const [sport, setSport] = useState<Sport>('cyber_football');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('live');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [selectedPick, setSelectedPick] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(100);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['cyber-matches', sport, matchFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cyber_matches')
        .select('*')
        .eq('sport', sport)
        .eq('status', matchFilter)
        .order('match_time', { ascending: matchFilter !== 'finished' })
        .limit(matchFilter === 'finished' ? 20 : 100);
      if (error) throw error;
      return (data || []) as CyberMatch[];
    },
    refetchInterval: 10000,
  });

  // Realtime subscription for live odds updates
  useEffect(() => {
    const channel = supabase
      .channel('cyber-matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cyber_matches' }, () => {
        qc.invalidateQueries({ queryKey: ['cyber-matches'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const placeCyberBet = useMutation({
    mutationFn: async ({ matchId, pick, amount, odds }: { matchId: string; pick: string; amount: number; odds: number }) => {
      if (!user) throw new Error('Login required');
      // Deduct balance
      const ok = placeBet(amount, 'Cyber Sports', 'sports');
      if (!ok) throw new Error('Insufficient balance');
      
      const { error } = await supabase.from('cyber_bets').insert({
        user_id: user.id,
        match_id: matchId,
        pick,
        amount,
        odds_at_bet: odds,
        potential_win: Math.round(amount * odds * 100) / 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bet placed! 🎯');
      setSelectedMatch(null);
      setSelectedPick(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getOdds = (m: CyberMatch, pick: string) => {
    if (pick === 'home') return Number(m.odds_home);
    if (pick === 'draw') return Number(m.odds_draw);
    return Number(m.odds_away);
  };

  const handleBet = (matchId: string, pick: string, odds: number) => {
    if (!user) return openAuth('login');
    placeCyberBet.mutate({ matchId, pick, amount: betAmount, odds });
  };

  return (
    <div className="px-3 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="text-primary" size={22} />
        <h1 className="font-heading font-bold text-lg text-foreground">Cyber Sports</h1>
      </div>

      {/* Sport Tabs */}
      <Tabs value={sport} onValueChange={(v) => setSport(v as Sport)}>
        <TabsList className="w-full bg-secondary">
          <TabsTrigger value="cyber_football" className="flex-1 font-heading font-semibold text-sm">
            ⚽ Cyber Football
          </TabsTrigger>
          <TabsTrigger value="cyber_cricket" className="flex-1 font-heading font-semibold text-sm">
            🏏 Cyber Cricket
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Live / Upcoming */}
      <div className="flex gap-2">
        <button
          onClick={() => setMatchFilter('live')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-heading font-semibold text-xs transition-all ${
            matchFilter === 'live'
              ? 'bg-destructive/20 text-destructive border border-destructive/30'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${matchFilter === 'live' ? 'bg-destructive animate-pulse' : 'bg-muted-foreground'}`} />
          Live
        </button>
        <button
          onClick={() => setMatchFilter('upcoming')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-heading font-semibold text-xs transition-all ${
            matchFilter === 'upcoming'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Clock size={12} />
          Upcoming
        </button>
        <button
          onClick={() => setMatchFilter('finished')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-heading font-semibold text-xs transition-all ${
            matchFilter === 'finished'
              ? 'bg-muted text-foreground border border-border'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Trophy size={12} />
          Finished
        </button>
      </div>

      {/* Matches */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {matchFilter} matches right now</p>
          <p className="text-xs mt-1">Check back soon!</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${sport}-${matchFilter}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {matches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                isLive={matchFilter === 'live'}
                isSelected={selectedMatch === m.id}
                selectedPick={selectedMatch === m.id ? selectedPick : null}
                betAmount={betAmount}
                onSelectPick={(pick) => {
                  if (!user) return openAuth('login');
                  setSelectedMatch(m.id);
                  setSelectedPick(pick);
                }}
                onBet={(pick) => handleBet(m.id, pick, getOdds(m, pick))}
                onChangeBetAmount={setBetAmount}
                isPending={placeCyberBet.isPending}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bet History */}
      {user && <CyberBetHistory userId={user.id} />}
    </div>
  );
};

/* ─── Match Card ─── */
const MatchCard = ({
  match, isLive, isSelected, selectedPick, betAmount,
  onSelectPick, onBet, onChangeBetAmount, isPending,
}: {
  match: CyberMatch;
  isLive: boolean;
  isSelected: boolean;
  selectedPick: string | null;
  betAmount: number;
  onSelectPick: (pick: string) => void;
  onBet: (pick: string) => void;
  onChangeBetAmount: (a: number) => void;
  isPending: boolean;
}) => {
  const matchDate = new Date(match.match_time);
  const timeStr = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = matchDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!isLive) return;
    const endTime = new Date(matchDate.getTime() + match.duration_minutes * 60000);
    const interval = setInterval(() => {
      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Ending...');
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, matchDate, match.duration_minutes]);

  const oddsArr = [
    { key: 'home', label: match.home_team, value: Number(match.odds_home) },
    { key: 'draw', label: 'Draw', value: Number(match.odds_draw) },
    { key: 'away', label: match.away_team, value: Number(match.odds_away) },
  ];

  return (
    <motion.div layout className="bg-card rounded-xl p-3 gold-border space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-heading">
          {match.sport === 'cyber_cricket' ? '🏏 Cyber Cricket' : '⚽ Cyber Football'}
        </span>
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-[10px] font-heading font-bold text-destructive">LIVE</span>
            {timeLeft && <span className="text-[10px] font-heading text-muted-foreground ml-1">{timeLeft}</span>}
          </div>
        ) : match.status === 'finished' ? (
          <span className="text-[10px] font-heading font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">FT</span>
        ) : (
          <span className="text-[10px] font-heading text-muted-foreground">{dateStr} • {timeStr}</span>
        )}
      </div>

      {/* Teams & Score */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-heading font-semibold text-foreground truncate block">{match.home_team}</span>
        </div>
        {isLive ? (
          match.sport === 'cyber_cricket' ? (
            <div className="flex flex-col items-center mx-2 gap-0.5">
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1">
                <div className="text-center">
                  <span className="font-heading font-bold text-lg text-foreground">{match.home_score}/{match.home_wickets}</span>
                  <p className="text-[9px] text-muted-foreground">({match.home_overs || '0.0'} ov)</p>
                </div>
                <span className="text-xs text-muted-foreground">vs</span>
                <div className="text-center">
                  <span className="font-heading font-bold text-lg text-foreground">{match.away_score}/{match.away_wickets}</span>
                  <p className="text-[9px] text-muted-foreground">({match.away_overs || '0.0'} ov)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mx-3 bg-secondary rounded-lg px-3 py-1">
              <span className="font-heading font-bold text-lg text-foreground">{match.home_score}</span>
              <span className="text-xs text-muted-foreground">-</span>
              <span className="font-heading font-bold text-lg text-foreground">{match.away_score}</span>
            </div>
          )
        ) : match.status === 'finished' ? (
          match.sport === 'cyber_cricket' ? (
            <div className="flex flex-col items-center mx-2 gap-0.5">
              <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-1 border border-primary/20">
                <div className="text-center">
                  <span className="font-heading font-bold text-lg text-primary">{match.home_score}/{match.home_wickets}</span>
                  <p className="text-[9px] text-muted-foreground">({match.home_overs || '0.0'} ov)</p>
                </div>
                <span className="text-xs text-muted-foreground">vs</span>
                <div className="text-center">
                  <span className="font-heading font-bold text-lg text-primary">{match.away_score}/{match.away_wickets}</span>
                  <p className="text-[9px] text-muted-foreground">({match.away_overs || '0.0'} ov)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mx-3 bg-primary/10 rounded-lg px-3 py-1 border border-primary/20">
              <span className="font-heading font-bold text-lg text-primary">{match.home_score}</span>
              <span className="text-xs text-muted-foreground">-</span>
              <span className="font-heading font-bold text-lg text-primary">{match.away_score}</span>
            </div>
          )
        ) : (
          <span className="text-xs text-muted-foreground mx-2">vs</span>
        )}
        <div className="flex-1 min-w-0 text-right">
          <span className="text-sm font-heading font-semibold text-foreground truncate block">{match.away_team}</span>
        </div>
      </div>

      {/* Result Banner (finished) */}
      {match.status === 'finished' && match.result && (
        <div className="bg-primary/10 rounded-lg px-3 py-2 text-center border border-primary/20">
          <span className="text-xs font-heading font-bold text-primary">
            🏆 Winner: {match.result === 'home' ? match.home_team : match.result === 'away' ? match.away_team : 'Draw'}
          </span>
        </div>
      )}

      {/* Live Event Feed */}
      {(isLive || match.status === 'finished') && <LiveEventFeed matchId={match.id} />}

      {/* Extra Markets */}
      {match.status !== 'finished' && <MatchMarkets matchId={match.id} />}

      {/* Odds Buttons (hide for finished) */}
      {match.status !== 'finished' && <div className="flex gap-2">
        {oddsArr.map(o => (
          <button
            key={o.key}
            onClick={() => onSelectPick(o.key)}
            className={`flex-1 rounded-lg p-2 text-center transition-all ${
              selectedPick === o.key
                ? 'bg-primary/20 border border-primary/50 ring-1 ring-primary/30'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            <p className="text-[10px] text-muted-foreground font-heading truncate">{o.label}</p>
            <p className="text-sm font-heading font-bold text-primary">{o.value.toFixed(2)}</p>
          </button>
        ))}
      </div>}

      {/* Bet Panel */}
      <AnimatePresence>
        {isSelected && selectedPick && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {BET_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => onChangeBetAmount(a)}
                    className={`px-3 py-1 rounded-lg text-xs font-heading font-bold transition-colors ${
                      betAmount === a ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    ৳{a}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Potential Win:</span>
                <span className="font-heading font-bold text-primary">
                  ৳{(betAmount * oddsArr.find(o => o.key === selectedPick)!.value).toFixed(0)}
                </span>
              </div>
              <button
                onClick={() => onBet(selectedPick)}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl gold-gradient font-heading font-bold text-sm text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
              >
                {isPending ? 'Placing...' : `Bet ৳${betAmount} on ${oddsArr.find(o => o.key === selectedPick)?.label}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─── Cyber Bet History ─── */
const CyberBetHistory = ({ userId }: { userId: string }) => {
  const { data: bets = [], isLoading } = useQuery({
    queryKey: ['cyber-bet-history', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cyber_bets')
        .select('*, cyber_matches(home_team, away_team, sport, result)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || bets.length === 0) return null;

  const pickLabel = (bet: any) => {
    const m = bet.cyber_matches;
    if (!m) return bet.pick;
    if (bet.pick === 'home') return m.home_team;
    if (bet.pick === 'away') return m.away_team;
    return 'Draw';
  };

  const statusConfig: Record<string, { icon: string; color: string }> = {
    won: { icon: '🏆', color: 'text-green-400' },
    lost: { icon: '❌', color: 'text-destructive' },
    pending: { icon: '⏳', color: 'text-primary' },
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-2">
        <History size={16} className="text-primary" />
        <h2 className="font-heading font-bold text-sm text-foreground">My Bets</h2>
      </div>
      <div className="space-y-2">
        {bets.map((bet: any) => {
          const m = bet.cyber_matches;
          const cfg = statusConfig[bet.status] || statusConfig.pending;
          const dateStr = new Date(bet.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          const timeStr = new Date(bet.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={bet.id} className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
              <span className="text-lg">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-xs text-foreground truncate">
                  {m ? `${m.home_team} vs ${m.away_team}` : 'Match'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Pick: <span className="text-primary font-bold">{pickLabel(bet)}</span> • Odds: {Number(bet.odds_at_bet).toFixed(2)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-heading font-bold text-sm ${cfg.color}`}>
                  {bet.status === 'won' ? '+' : '-'}৳{bet.status === 'won' ? Number(bet.potential_win).toLocaleString() : Number(bet.amount).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{dateStr} {timeStr}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


/* ─── Live Event Feed (User Side) ─── */
const EVENT_EMOJIS: Record<string, string> = {
  goal: '⚽', wicket: '🏏', card_yellow: '🟨', card_red: '🟥',
  penalty: '🎯', six: '6️⃣', four: '4️⃣', info: '📢',
};

const LiveEventFeed = ({ matchId }: { matchId: string }) => {
  const [events, setEvents] = useState<any[]>([]);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('cyber_match_events').select('*').eq('match_id', matchId).order('created_at', { ascending: false }).limit(10);
    setEvents(data || []);
  }, [matchId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const ch = supabase.channel(`user-events-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cyber_match_events', filter: `match_id=eq.${matchId}` }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, fetchEvents]);

  if (events.length === 0) return null;

  return (
    <div className="bg-secondary/50 rounded-lg px-3 py-2 space-y-1">
      <p className="text-[10px] font-heading font-semibold text-muted-foreground">📋 Commentary</p>
      <div className="max-h-24 overflow-y-auto space-y-0.5">
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-1.5 text-[10px]">
            <span>{EVENT_EMOJIS[ev.event_type] || '📢'}</span>
            {ev.minute != null && <span className="text-primary font-heading font-bold shrink-0">{ev.minute}'</span>}
            <span className="text-muted-foreground">{ev.event_text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SportsPage;
