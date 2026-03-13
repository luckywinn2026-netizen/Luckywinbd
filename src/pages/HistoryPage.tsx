import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  description: string;
  timestamp: number;
  status: string;
  reject_reason?: string | null;
  withdrawal_code?: string | null;
}

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'pending' | 'approved';

const STATUS_FILTERS: { value: StatusFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'pending', label: 'Pending', icon: '⏳' },
  { value: 'approved', label: 'Successful', icon: '✅' },
];

const HistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchPage = useCallback(async (p: number, sf: StatusFilter) => {
    if (!user) return;
    setLoading(true);
    const from = p * PAGE_SIZE;

    let depQuery = supabase.from('deposits').select('*').eq('user_id', user.id);
    let withQuery = supabase.from('withdrawals').select('*').eq('user_id', user.id);
    let depCountQ = supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    let withCountQ = supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    if (sf !== 'all') {
      depQuery = depQuery.eq('status', sf);
      withQuery = withQuery.eq('status', sf);
      depCountQ = depCountQ.eq('status', sf);
      withCountQ = withCountQ.eq('status', sf);
    }

    const [deps, withs, depCount, withCount] = await Promise.all([
      depQuery.order('created_at', { ascending: false }),
      withQuery.order('created_at', { ascending: false }),
      depCountQ,
      withCountQ,
    ]);

    const txs: Transaction[] = [];
    (deps.data || []).forEach(d => txs.push({
      id: d.id, type: 'deposit', amount: Number(d.amount),
      description: `${d.method} - TrxID: ${d.trx_id || 'N/A'}`,
      timestamp: new Date(d.created_at).getTime(),
      status: d.status,
      reject_reason: (d as any).reject_reason,
    }));
    (withs.data || []).forEach((w: any) => txs.push({
      id: w.id, type: 'withdraw', amount: Number(w.amount),
      description: w.withdrawal_code ? `${w.method} - ${w.withdrawal_code}` : `${w.method} - ${w.phone || 'N/A'}`,
      timestamp: new Date(w.created_at).getTime(),
      status: w.status,
      withdrawal_code: w.withdrawal_code,
    }));

    txs.sort((a, b) => b.timestamp - a.timestamp);
    const total = (depCount.count || 0) + (withCount.count || 0);
    setTotalCount(total);
    setTransactions(txs.slice(from, from + PAGE_SIZE));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPage(page, statusFilter); }, [page, statusFilter, fetchPage]);

  const typeColors: Record<string, string> = {
    deposit: 'text-success',
    withdraw: 'text-primary',
  };

  const typeIcons: Record<string, string> = {
    deposit: '💰',
    withdraw: '💸',
  };

  return (
    <div className="min-h-screen navy-gradient">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/account')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">📋 Transaction History</h1>
      </div>

      {/* Status filter */}
      <div className="px-4 flex gap-2 mb-3">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
              statusFilter === f.value
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
        ) : transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 font-heading">No transactions yet</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
              <span className="text-xl">{typeIcons[tx.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-heading font-bold text-sm capitalize">{tx.type}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    tx.status === 'approved' ? 'bg-success/20 text-success' :
                    tx.status === 'rejected' ? 'bg-destructive/20 text-destructive' :
                    'bg-primary/20 text-primary'
                  }`}>
                    {tx.status === 'approved' ? '✓' : tx.status === 'rejected' ? '✗' : '⏳'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                {tx.status === 'rejected' && tx.reject_reason && (
                  <p className="text-[10px] text-destructive mt-0.5">❌ {tx.reject_reason}</p>
                )}
              </div>
              <div className="text-right">
                <p className={`font-heading font-bold text-sm ${typeColors[tx.type]}`}>
                  {tx.type === 'withdraw' ? '-' : '+'}৳{tx.amount.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-4 px-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg bg-card gold-border disabled:opacity-30"
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <span className="font-heading font-bold text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg bg-card gold-border disabled:opacity-30"
          >
            <ChevronRight size={18} className="text-foreground" />
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
