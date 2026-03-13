import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, RefreshCw, Bell, Search } from 'lucide-react';
import { toast } from 'sonner';

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  trx_id: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  username?: string;
  user_code?: string;
}

type Filter = 'all' | 'pending' | 'agent_approved' | 'approved' | 'rejected';

const AgentDepositsPage = () => {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [searchTrx, setSearchTrx] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchDeposits = useCallback(async () => {
    const { data } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
    if (!data) return;

    const userIds = [...new Set(data.map(d => d.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, username, user_code').in('user_id', userIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const enriched: DepositRequest[] = data.map(d => {
      const p = profileMap.get(d.user_id);
      return {
        ...d,
        username: p?.username || null,
        user_code: p?.user_code || null,
      };
    });

    setDeposits(enriched);
    setPendingCount(enriched.filter(d => d.status === 'pending').length);
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('agent-page-deposits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, () => {
        fetchDeposits();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDeposits]);

  const approveDeposit = async (deposit: DepositRequest) => {
    if (!user) return;
    let result: { success?: boolean; error?: string; commission?: number };
    try {
      result = await api.rpc<{ success?: boolean; error?: string; commission?: number }>('process_agent_assigned_deposit_approval', {
        p_agent_id: user.id,
        p_deposit_id: deposit.id,
      });
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Approve failed');
      return;
    }

    if (!result?.success) {
      toast.error(result?.error || 'Approve failed');
      return;
    }

    toast.success(`✅ ৳${deposit.amount.toLocaleString()} Approved! Commission: ৳${Number(result.commission || 0).toLocaleString()}`);
    fetchDeposits();
  };

  const rejectDeposit = async (id: string) => {
    const { error } = await supabase.from('deposits').update({ status: 'rejected' }).eq('id', id).eq('status', 'pending');
    if (error) { toast.error('Reject failed'); return; }
    toast.success('Deposit rejected');
    fetchDeposits();
  };

  const filtered = deposits.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (searchTrx && !d.trx_id?.toLowerCase().includes(searchTrx.toLowerCase()) && !d.username?.toLowerCase().includes(searchTrx.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading font-bold text-lg md:text-2xl">💰 Deposit Management</h1>
        {pendingCount > 0 && (
          <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
            <Bell size={12} /> {pendingCount} Pending
          </span>
        )}
        <button onClick={fetchDeposits} className="ml-auto p-2 rounded-lg bg-card gold-border"><RefreshCw size={16} className="text-muted-foreground" /></button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={searchTrx} onChange={e => setSearchTrx(e.target.value)} placeholder="Search by TrxID or username..."
          className="w-full bg-card rounded-lg pl-9 pr-3 py-2.5 min-h-[44px] text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary" />
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
        {filtered.map(d => (
          <div key={d.id} className={`bg-card rounded-xl gold-border p-4 space-y-3 ${d.status === 'pending' ? 'ring-2 ring-yellow-500/50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold text-sm text-primary">{displayUser(d)}</p>
                {(d.user_code && d.username) && <p className="text-xs text-muted-foreground">{d.username}</p>}
              </div>
              <div className="text-right">
                <p className="font-heading font-bold text-green-400">৳{Number(d.amount).toLocaleString()}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  d.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                  d.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>{d.status === 'agent_approved' ? 'Agent ✓' : d.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Method:</span> <span className="font-bold">{d.method}</span></div>
              <div><span className="text-muted-foreground">TrxID:</span> <span className="font-mono truncate block">{d.trx_id || 'N/A'}</span></div>
              <div><span className="text-muted-foreground">Phone:</span> {d.phone || 'N/A'}</div>
              <div><span className="text-muted-foreground">Date:</span> {new Date(d.created_at).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            {d.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => approveDeposit(d)} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-xs font-heading font-bold">
                  <CheckCircle size={14} /> Approve
                </button>
                <button onClick={() => rejectDeposit(d.id)} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-xs font-heading font-bold">
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No deposits found</p>}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-card rounded-xl gold-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-muted-foreground text-xs border-b border-border">
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">TrxID</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className={`border-t border-border hover:bg-secondary/50 ${d.status === 'pending' ? 'bg-yellow-500/5' : ''}`}>
                <td className="p-3">
                  <p className="font-heading font-bold text-xs text-primary">{displayUser(d)}</p>
                  {(d.user_code && d.username) && <p className="text-[10px] text-muted-foreground">{d.username}</p>}
                </td>
                <td className="p-3 font-heading font-bold">{d.method}</td>
                <td className="p-3 font-heading font-bold text-green-400">৳{Number(d.amount).toLocaleString()}</td>
                <td className="p-3 text-muted-foreground text-xs">{d.trx_id || 'N/A'}</td>
                <td className="p-3 text-muted-foreground text-xs">{d.phone || 'N/A'}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    d.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                    d.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{d.status === 'agent_approved' ? 'Agent ✓' : d.status}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                <td className="p-3">
                  {d.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => approveDeposit(d)} className="p-2 min-w-[36px] text-green-400 hover:bg-green-500/20 rounded"><CheckCircle size={16} /></button>
                      <button onClick={() => rejectDeposit(d.id)} className="p-2 min-w-[36px] text-red-400 hover:bg-red-500/20 rounded"><XCircle size={16} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No deposits found</p>}
      </div>
    </div>
  );
};

export default AgentDepositsPage;