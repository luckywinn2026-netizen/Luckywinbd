import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface BetRecord {
  id: string;
  type: 'bet' | 'win';
  amount: number;
  description: string;
  timestamp: number;
  multiplier: number | null;
}

const PAGE_SIZE = 20;

type FilterType = 'all' | 'slot' | 'crash';

const FILTERS: { value: FilterType; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'slot', label: 'Slots', icon: '🎰' },
  { value: 'crash', label: 'Crash', icon: '📈' },
];

const BetHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [records, setRecords] = useState<BetRecord[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'win' | 'loss'>('all');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchPage = useCallback(async (p: number, f: FilterType, rf: 'all' | 'win' | 'loss') => {
    if (!user) return;
    setLoading(true);
    const from = p * PAGE_SIZE;

    let query = supabase.from('game_sessions').select('*').eq('user_id', user.id);
    let countQuery = supabase.from('game_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    if (f !== 'all') {
      query = query.eq('game_type', f);
      countQuery = countQuery.eq('game_type', f);
    }
    if (rf !== 'all') {
      query = query.eq('result', rf);
      countQuery = countQuery.eq('result', rf);
    }

    const [gamesRes, countRes] = await Promise.all([
      query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
      countQuery,
    ]);

    setTotalCount(countRes.count || 0);
    setRecords((gamesRes.data || []).map(g => ({
      id: g.id,
      type: g.result === 'win' ? 'win' : 'bet',
      amount: g.result === 'win' ? Number(g.win_amount) : Number(g.bet_amount),
      description: g.game_name || g.game_type,
      timestamp: new Date(g.created_at).getTime(),
      multiplier: g.multiplier,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPage(page, filter, resultFilter); }, [page, filter, resultFilter, fetchPage]);

  return (
    <div className="min-h-screen navy-gradient">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/account')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">🎲 Bet History</h1>
      </div>

      {/* Filter tabs */}
      <div className="px-4 flex gap-2 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
              filter === f.value
                ? 'gold-gradient text-primary-foreground'
                : 'bg-card gold-border text-muted-foreground'
            }`}
          >
            <span>{f.icon}</span> {f.label}
          </button>
        ))}
      </div>

      {/* Result filter */}
      <div className="px-4 flex gap-2 mb-3">
        {([
          { value: 'all' as const, label: 'All Results', icon: '📋' },
          { value: 'win' as const, label: 'Wins', icon: '🏆' },
          { value: 'loss' as const, label: 'Losses', icon: '💔' },
        ]).map(f => (
          <button
            key={f.value}
            onClick={() => { setResultFilter(f.value); setPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
              resultFilter === f.value
                ? 'gold-gradient text-primary-foreground'
                : 'bg-card gold-border text-muted-foreground'
            }`}
          >
            <span>{f.icon}</span> {f.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-12 font-heading">Loading...</p>
        ) : records.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 font-heading">No bets yet</p>
        ) : (
          records.map(r => (
            <div key={r.id} className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
              <span className="text-xl">{r.type === 'win' ? '🏆' : '🎲'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm capitalize">{r.type === 'win' ? 'Win' : 'Bet'}</p>
                <p className="text-xs text-muted-foreground truncate">{r.description}</p>
              </div>
              <div className="text-right">
                <p className={`font-heading font-bold text-sm ${r.type === 'win' ? 'text-success' : 'text-destructive'}`}>
                  {r.type === 'bet' ? '-' : '+'}৳{r.amount.toLocaleString()}
                </p>
                {r.multiplier && (
                  <p className="text-[10px] text-primary font-bold">{r.multiplier}x</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                  {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-4 px-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-2 rounded-lg bg-card gold-border disabled:opacity-30">
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <span className="font-heading font-bold text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="p-2 rounded-lg bg-card gold-border disabled:opacity-30">
            <ChevronRight size={18} className="text-foreground" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BetHistoryPage;
