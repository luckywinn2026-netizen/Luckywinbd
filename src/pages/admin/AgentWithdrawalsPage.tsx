import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, RefreshCw, Bell, Search, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  phone: string | null;
  status: string;
  created_at: string;
  withdrawal_code?: string | null;
  username?: string;
  user_code?: string;
}

type Filter = 'all' | 'pending' | 'agent_approved' | 'approved' | 'rejected';

const AgentWithdrawalsPage = () => {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const data = await api.getWithdrawals();
      const list = (data || []) as WithdrawalRequest[];
      setWithdrawals(list);
      setPendingCount(list.filter(w => w.status === 'pending').length);
    } catch {
      setWithdrawals([]);
      setPendingCount(0);
    }
  }, []);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const approveWithdrawal = async (w: WithdrawalRequest) => {
    if (!user) return;
    // Use server-side RPC for atomic withdrawal approval (no commission, logs automatically)
    let result: { success?: boolean; error?: string; commission?: number };
    try {
      result = await api.rpc<{ success?: boolean; error?: string; commission?: number }>('process_agent_withdrawal_approval', {
        p_agent_id: user.id,
        p_withdrawal_id: w.id,
      });
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Approve failed');
      return;
    }
    if (!result?.success) {
      toast.error(result?.error || 'Approve failed');
      return;
    }

    toast.success(`✅ ৳${w.amount.toLocaleString()} Withdrawal Approved! Commission: ৳${Number(result.commission || 0).toLocaleString()}`);
    fetchWithdrawals();
  };

  const rejectWithdrawal = async (id: string) => {
    try {
      await api.rejectWithdrawal(id);
      toast.success('Withdrawal rejected');
      fetchWithdrawals();
    } catch {
      toast.error('Reject failed');
    }
  };

  const filtered = withdrawals.filter(w => {
    if (filter !== 'all' && w.status !== filter) return false;
    if (search && !w.username?.toLowerCase().includes(search.toLowerCase()) && !w.phone?.includes(search)) return false;
    return true;
  });

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading font-bold text-lg md:text-2xl">💸 Withdrawal Management</h1>
        {pendingCount > 0 && (
          <span className="bg-orange-500/20 text-orange-400 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
            <Bell size={12} /> {pendingCount} Pending
          </span>
        )}
        <button onClick={fetchWithdrawals} className="ml-auto p-2 rounded-lg bg-card gold-border"><RefreshCw size={16} className="text-muted-foreground" /></button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username or phone..."
          className="w-full bg-card rounded-lg pl-9 pr-3 py-2.5 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'agent_approved', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold capitalize transition-colors ${
              filter === f ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border text-muted-foreground'
            }`}>
            {f === 'agent_approved' ? 'Approved by Me' : f}
            {f === 'pending' && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3">
        {filtered.map(w => (
          <div key={w.id} className={`bg-card rounded-xl gold-border p-4 space-y-3 ${w.status === 'pending' ? 'ring-2 ring-orange-500/50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold text-sm">{w.username}</p>
                <p className="text-xs text-primary">{w.user_code}</p>
              </div>
              <div className="text-right">
                <p className="font-heading font-bold text-orange-400">৳{Number(w.amount).toLocaleString()}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  w.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                  w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>{w.status === 'agent_approved' ? 'Agent ✓' : w.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-primary">{w.withdrawal_code || w.id.slice(0, 8)}</span></div>
              <div><span className="text-muted-foreground">Method:</span> <span className="font-bold">{w.method}</span></div>
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="flex items-center gap-1">
                  {w.phone || 'N/A'}
                  {w.phone && (
                    <button onClick={() => { navigator.clipboard.writeText(w.phone!); toast.success('Copied!'); }} className="p-1.5 text-primary rounded"><Copy size={14} /></button>
                  )}
                </span>
              </div>
              <div className="col-span-2"><span className="text-muted-foreground">Date:</span> {new Date(w.created_at).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            {w.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => approveWithdrawal(w)} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-xs font-heading font-bold">
                  <CheckCircle size={14} /> Approve
                </button>
                <button onClick={() => rejectWithdrawal(w.id)} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-xs font-heading font-bold">
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No withdrawals found</p>}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-card rounded-xl gold-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-muted-foreground text-xs border-b border-border">
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Wallet (Copy)</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id} className={`border-t border-border hover:bg-secondary/50 ${w.status === 'pending' ? 'bg-orange-500/5' : ''}`}>
                <td className="p-3"><span className="text-primary font-mono text-xs">{w.withdrawal_code || w.id.slice(0, 8)}</span></td>
                <td className="p-3">
                  <p className="font-heading font-bold text-xs">{w.username}</p>
                  <p className="text-[10px] text-primary">{w.user_code}</p>
                </td>
                <td className="p-3 font-heading font-bold">{w.method}</td>
                <td className="p-3 font-heading font-bold text-orange-400">৳{Number(w.amount).toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">{w.phone || 'N/A'}</span>
                    {w.phone && (
                      <button onClick={() => { navigator.clipboard.writeText(w.phone!); toast.success('Copied!'); }} className="p-2 min-w-[36px] text-primary hover:bg-primary/20 rounded"><Copy size={14} /></button>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    w.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                    w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{w.status === 'agent_approved' ? 'Agent ✓' : w.status}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</td>
                <td className="p-3">
                  {w.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => approveWithdrawal(w)} className="p-2 min-w-[36px] text-green-400 hover:bg-green-500/20 rounded"><CheckCircle size={16} /></button>
                      <button onClick={() => rejectWithdrawal(w.id)} className="p-2 min-w-[36px] text-red-400 hover:bg-red-500/20 rounded"><XCircle size={16} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No withdrawals found</p>}
      </div>
    </div>
  );
};

export default AgentWithdrawalsPage;