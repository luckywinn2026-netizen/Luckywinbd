import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { XCircle, RefreshCw, User } from 'lucide-react';

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  phone: string | null;
  status: string;
  created_at: string;
  reviewed_by_agent: string | null;
  agent_approved_at: string | null;
  username?: string;
  user_code?: string;
  agent_name?: string;
}

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetchWithdrawals = useCallback(async () => {
    const { data } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
    if (!data) return;

    const allUserIds = [...new Set([
      ...data.map(d => d.user_id),
      ...data.filter(d => d.reviewed_by_agent).map(d => d.reviewed_by_agent!),
    ])];
    const { data: profiles } = await supabase.from('profiles').select('user_id, username, user_code').in('user_id', allUserIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const enriched: WithdrawalRow[] = data.map(w => ({
      ...w,
      username: profileMap.get(w.user_id)?.username || 'Unknown',
      user_code: profileMap.get(w.user_id)?.user_code || '—',
      agent_name: w.reviewed_by_agent ? profileMap.get(w.reviewed_by_agent)?.username || 'Agent' : undefined,
    }));
    setWithdrawals(enriched);
  }, []);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-withdrawal-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetchWithdrawals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchWithdrawals]);

  const rejectWithdrawal = async (id: string) => {
    // Rejecting refunds user balance via trigger
    const { error } = await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', id);
    if (error) { toast.error('Failed to reject'); return; }
    toast.success('Withdrawal rejected & balance refunded');
    fetchWithdrawals();
  };

  const filtered = filter === 'all' ? withdrawals : withdrawals.filter(w => w.status === filter);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-heading font-bold text-lg md:text-2xl">💸 Withdrawal Management</h1>
        <button onClick={fetchWithdrawals} className="ml-auto p-2 rounded-lg bg-card gold-border">
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400">
        <p className="font-heading font-bold mb-1">📋 Withdrawal Flow:</p>
        <p>User Request → <strong>Balance Instantly Deducted</strong> → <strong className="text-primary">Agent Final Approve</strong> → Done</p>
        <p className="mt-1 text-muted-foreground">⚠️ Balance is deducted instantly when user requests withdrawal. Agent approve is final. Reject refunds the balance.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold capitalize transition-colors ${
              filter === f ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border text-muted-foreground'
            }`}>
            {f === 'pending' ? `⏳ Pending (${withdrawals.filter(w => w.status === 'pending').length})` :
             f === 'approved' ? '✅ Approved' :
             f === 'rejected' ? '❌ Rejected' : '📋 All'}
          </button>
        ))}
      </div>

      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3">
        {filtered.map(w => (
          <div key={w.id} className="bg-card rounded-xl gold-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold text-sm">{w.username}</p>
                <p className="text-xs text-primary">{w.user_code}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-heading font-bold shrink-0 ${
                w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {w.status === 'approved' ? '✅ Approved' : w.status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Method:</span> <span className="font-bold">{w.method}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-red-400">৳{Number(w.amount).toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Phone:</span> {w.phone || 'N/A'}</div>
              <div><span className="text-muted-foreground">Date:</span> {new Date(w.created_at).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              {w.agent_name && <div className="col-span-2 flex items-center gap-1"><User size={10} className="text-blue-400" /><span className="text-blue-400 font-bold">{w.agent_name}</span></div>}
            </div>
            {w.status === 'pending' && (
              <button onClick={() => rejectWithdrawal(w.id)} className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/20 text-red-400 active:bg-red-500/30 rounded-xl text-xs font-heading font-bold">
                <XCircle size={14} /> Reject & Refund
              </button>
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
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id} className="border-t border-border hover:bg-secondary/50">
                <td className="p-3">
                  <p className="font-heading font-bold text-xs">{w.username}</p>
                  <p className="text-[10px] text-primary">{w.user_code}</p>
                </td>
                <td className="p-3 font-heading font-bold text-xs">{w.method}</td>
                <td className="p-3 font-heading font-bold text-red-400">৳{Number(w.amount).toLocaleString()}</td>
                <td className="p-3 text-muted-foreground text-xs">{w.phone || 'N/A'}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-heading font-bold ${
                    w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {w.status === 'approved' ? '✅ Approved' : w.status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
                  </span>
                </td>
                <td className="p-3">
                  {w.agent_name ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <User size={11} className="text-blue-400" />
                        <span className="text-[10px] text-blue-400 font-heading font-bold">{w.agent_name}</span>
                      </div>
                      {w.agent_approved_at && (
                        <span className="text-[9px] text-muted-foreground block">
                          {new Date(w.agent_approved_at).toLocaleString('en-BD', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString()}</td>
                <td className="p-3">
                  {w.status === 'pending' && (
                    <button onClick={() => rejectWithdrawal(w.id)} className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-[10px] font-heading font-bold">
                      <XCircle size={12} /> Reject & Refund
                    </button>
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

export default AdminWithdrawals;
