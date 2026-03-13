import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Bell, RefreshCw, User, Volume2, Coins, Edit3 } from 'lucide-react';

interface DepositRow {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  trx_id: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  reviewed_by_agent: string | null;
  agent_approved_at: string | null;
  reject_reason: string | null;
  username?: string;
  user_code?: string;
  agent_name?: string;
}

const AdminDeposits = () => {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'agent_approved' | 'approved' | 'rejected'>('agent_approved');
  const [agentApprovedCount, setAgentApprovedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; username: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState<DepositRow | null>(null);
  const [editedAmount, setEditedAmount] = useState('');
  const [isAmountEdited, setIsAmountEdited] = useState(false);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.3);
      });
    } catch {}
  }, [soundEnabled]);

  const fetchDeposits = useCallback(async () => {
    const { data } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
    if (!data) return;

    const allUserIds = [...new Set([
      ...data.map(d => d.user_id),
      ...data.filter(d => d.reviewed_by_agent).map(d => d.reviewed_by_agent!),
    ])];
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, user_code')
      .in('user_id', allUserIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const enriched: DepositRow[] = data.map(d => ({
      ...d,
      username: profileMap.get(d.user_id)?.username || 'Unknown',
      user_code: profileMap.get(d.user_id)?.user_code || '—',
      agent_name: d.reviewed_by_agent ? profileMap.get(d.reviewed_by_agent)?.username || 'Agent' : undefined,
    }));

    setDeposits(enriched);
    setAgentApprovedCount(enriched.filter(d => d.status === 'agent_approved').length);
    setPendingCount(enriched.filter(d => d.status === 'pending').length);
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-deposit-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deposits' }, (payload) => {
        if (payload.new && (payload.new as any).status === 'agent_approved') {
          playNotificationSound();
          toast.info('🔔 An Agent has approved a deposit!', { duration: 5000 });
        }
        fetchDeposits();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deposits' }, () => {
        fetchDeposits();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDeposits, playNotificationSound]);

  const handleFinalApprove = async (deposit: DepositRow, amount?: number) => {
    const finalAmount = amount || deposit.amount;
    
    // If amount was edited, update the deposit amount first
    if (amount && amount !== deposit.amount) {
      const { error: updateError } = await supabase
        .from('deposits')
        .update({ amount: finalAmount, status: 'approved' })
        .eq('id', deposit.id);
      if (updateError) { toast.error('Failed to approve'); return; }
    } else {
      const { error } = await supabase
        .from('deposits')
        .update({ status: 'approved' })
        .eq('id', deposit.id);
      if (error) { toast.error('Failed to approve'); return; }
    }
    
    toast.success(`✅ ৳${finalAmount.toLocaleString()} deposit Final Approved! Added to user wallet.`);
    setApproveModal(null);
    fetchDeposits();
  };

  const handleReject = (id: string, username: string) => {
    setRejectReason('');
    setRejectModal({ id, username });
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    const updateData: any = { status: 'rejected' };
    if (rejectReason.trim()) updateData.reject_reason = rejectReason.trim();
    const { error } = await supabase.from('deposits').update(updateData).eq('id', rejectModal.id);
    if (error) { toast.error('Failed to reject'); return; }
    toast.success('Deposit rejected');
    setRejectModal(null);
    fetchDeposits();
  };

  const openApproveModal = (deposit: DepositRow) => {
    setEditedAmount(String(deposit.amount));
    setIsAmountEdited(false);
    setApproveModal(deposit);
  };

  const filtered = filter === 'all' ? deposits : deposits.filter(d => d.status === filter);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-heading font-bold text-lg md:text-2xl">💰 Deposit Management</h1>
        {agentApprovedCount > 0 && (
          <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
            <Bell size={12} /> {agentApprovedCount} Agent Approved — Give Final Approval
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className={`p-2 rounded-lg gold-border transition-colors ${soundEnabled ? 'bg-primary/10 text-primary' : 'bg-card text-muted-foreground'}`}
            title={soundEnabled ? 'Sound ON' : 'Sound OFF'}
          >
            <Volume2 size={16} className={soundEnabled ? '' : 'opacity-40'} />
          </button>
          <button onClick={fetchDeposits} className="p-2 rounded-lg bg-card gold-border">
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400">
        <p className="font-heading font-bold mb-1">📋 Approval Flow:</p>
        <p>User → Deposit Request → <strong>Payment Agent Verify</strong> → <strong className="text-primary">Admin Final Approve (Add Coin)</strong> → User Wallet Credit</p>
        <p className="mt-1 text-muted-foreground">⚠️ Only Admin Final Approve updates user balance. Agent approval alone does not add balance.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'agent_approved', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-colors ${
              filter === f ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border text-muted-foreground'
            }`}
          >
            {f === 'agent_approved' ? `🔵 Agent Approved (${agentApprovedCount})` :
             f === 'pending' ? `⏳ Pending (${pendingCount})` :
             f === 'approved' ? '✅ Approved' :
             f === 'rejected' ? '❌ Rejected' : '📋 All'}
          </button>
        ))}
      </div>

      {/* Mobile: Card layout | Desktop: Table */}
      <div className="md:hidden space-y-3">
        {filtered.map(d => (
          <div key={d.id} className={`bg-card rounded-xl gold-border p-4 space-y-3 ${
            d.status === 'agent_approved' ? 'ring-2 ring-blue-400/50' : ''
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold text-sm">{d.username}</p>
                <p className="text-xs text-primary">{d.user_code}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-heading font-bold shrink-0 ${
                d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                d.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                d.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {d.status === 'agent_approved' ? '🔵 Agent ✓' : d.status === 'approved' ? '✅ Done' : d.status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Method:</span> <span className="font-bold">{d.method}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-green-400">৳{Number(d.amount).toLocaleString()}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">TrxID:</span> <span className="font-mono">{d.trx_id || 'N/A'}</span></div>
              <div><span className="text-muted-foreground">Phone:</span> {d.phone || 'N/A'}</div>
              <div><span className="text-muted-foreground">Date:</span> {new Date(d.created_at).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              {d.agent_name && <div className="col-span-2 flex items-center gap-1"><User size={10} className="text-blue-400" /><span className="text-blue-400 font-bold">{d.agent_name}</span></div>}
            </div>
            {d.status === 'agent_approved' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => openApproveModal(d)} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500/20 text-green-400 active:bg-green-500/30 rounded-xl text-xs font-heading font-bold">
                  <Coins size={14} /> Add Coin
                </button>
                <button onClick={() => handleReject(d.id, d.username || 'User')} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/20 text-red-400 active:bg-red-500/30 rounded-xl text-xs font-heading font-bold">
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
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-muted-foreground text-xs border-b border-border">
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">TrxID</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Agent Info</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className={`border-t border-border hover:bg-secondary/50 transition-colors ${
                d.status === 'agent_approved' ? 'bg-blue-500/5 border-l-2 border-l-blue-400' : ''
              }`}>
                <td className="p-3">
                  <div>
                    <p className="font-heading font-bold text-xs">{d.username}</p>
                    <p className="text-[10px] text-primary">{d.user_code}</p>
                  </div>
                </td>
                <td className="p-3 font-heading font-bold text-xs">{d.method}</td>
                <td className="p-3 font-heading font-bold text-green-400">৳{Number(d.amount).toLocaleString()}</td>
                <td className="p-3 text-muted-foreground text-xs">{d.trx_id || 'N/A'}</td>
                <td className="p-3 text-muted-foreground text-xs">{d.phone || 'N/A'}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-heading font-bold ${
                    d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    d.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                    d.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {d.status === 'agent_approved' ? '🔵 Agent ✓' : 
                     d.status === 'approved' ? '✅ Final ✓' :
                     d.status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
                  </span>
                </td>
                <td className="p-3">
                  {d.agent_name ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <User size={11} className="text-blue-400" />
                        <span className="text-[10px] text-blue-400 font-heading font-bold">{d.agent_name}</span>
                      </div>
                      {d.agent_approved_at && (
                        <span className="text-[9px] text-muted-foreground block">
                          {new Date(d.agent_approved_at).toLocaleString('en-BD', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                <td className="p-3">
                  {d.status === 'agent_approved' && (
                    <div className="flex gap-1">
                      <button onClick={() => openApproveModal(d)} className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-[10px] font-heading font-bold transition-colors">
                        <Coins size={12} /> Add Coin
                      </button>
                      <button onClick={() => handleReject(d.id, d.username || 'User')} className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-[10px] font-heading font-bold transition-colors">
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                  {d.status === 'pending' && <span className="text-[10px] text-muted-foreground italic">Needs agent approval</span>}
                  {d.status === 'approved' && <span className="text-[10px] text-green-400">✅ Done</span>}
                  {d.status === 'rejected' && d.reject_reason && <span className="text-[10px] text-red-400" title={d.reject_reason}>❌ {d.reject_reason.slice(0, 30)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No deposits found</p>}
      </div>

      {/* Final Approve Modal with Add Coin */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" onClick={() => setApproveModal(null)}>
          <div className="bg-card rounded-2xl gold-border p-4 md:p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-base flex items-center gap-2">
              <Coins size={20} className="text-primary" /> Final Approve — Add Coin
            </h3>
            
            <div className="bg-background/50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">User:</span>
                <span className="font-heading font-bold">{approveModal.username} <span className="text-primary">({approveModal.user_code})</span></span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Method:</span>
                <span className="font-heading font-bold">{approveModal.method}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">TrxID:</span>
                <span className="font-heading font-bold">{approveModal.trx_id || 'N/A'}</span>
              </div>
              {approveModal.agent_name && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Agent Approved:</span>
                  <span className="text-blue-400 font-heading font-bold">{approveModal.agent_name}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Original Amount:</span>
                <span className="text-green-400 font-heading font-bold">৳{Number(approveModal.amount).toLocaleString()}</span>
              </div>
            </div>

            {/* Editable Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground">Approve Amount (৳)</label>
                <button 
                  onClick={() => { setIsAmountEdited(!isAmountEdited); setEditedAmount(String(approveModal.amount)); }}
                  className="text-[10px] text-primary flex items-center gap-1 hover:underline"
                >
                  <Edit3 size={10} /> {isAmountEdited ? 'Reset' : 'Edit Amount'}
                </button>
              </div>
              <input
                type="number"
                value={editedAmount}
                onChange={e => { setEditedAmount(e.target.value); setIsAmountEdited(true); }}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-lg font-heading font-bold text-foreground outline-none gold-border focus:ring-2 focus:ring-primary text-center"
                min={1}
              />
              {isAmountEdited && Number(editedAmount) !== approveModal.amount && (
                <p className="text-[10px] text-amber-400 mt-1">
                  ⚠️ Amount changed: ৳{approveModal.amount} → ৳{Number(editedAmount).toLocaleString()}
                </p>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[10px] text-amber-400">
              ⚠️ Final Approve will add ৳{Number(editedAmount).toLocaleString()} to user wallet (+ 2.5% bonus).
            </div>

            <div className="flex gap-2">
              <button onClick={() => setApproveModal(null)} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground font-heading font-bold text-sm">
                Cancel
              </button>
              <button 
                onClick={() => handleFinalApprove(approveModal, isAmountEdited ? Number(editedAmount) : undefined)}
                disabled={!editedAmount || Number(editedAmount) <= 0}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-green-500/20 text-green-400 font-heading font-bold text-sm hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={16} /> Final Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" onClick={() => setRejectModal(null)}>
          <div className="bg-card rounded-2xl gold-border p-4 md:p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-base">❌ Reject Deposit</h3>
            <p className="text-xs text-muted-foreground">User: <span className="text-foreground font-bold">{rejectModal.username}</span></p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rejection Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Invalid TrxID, Amount mismatch..."
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground outline-none gold-border focus:ring-2 focus:ring-primary resize-none h-20"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-secondary text-muted-foreground font-heading font-bold text-sm">
                Cancel
              </button>
              <button onClick={confirmReject} className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-red-500/20 text-red-400 font-heading font-bold text-sm hover:bg-red-500/30 transition-colors">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeposits;
