import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, TrendingUp, Users, CalendarIcon, Eye, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';

interface AgentPerf {
  user_id: string;
  username: string;
  phone: string | null;
  user_code: string | null;
  deposit_count: number;
  deposit_total: number;
  deposit_commission: number;
  withdraw_count: number;
  withdraw_total: number;
  withdraw_commission: number;
  total_commission: number;
  wallet_balance: number;
}

interface AgentTxn {
  id: string;
  type: 'deposit' | 'withdrawal';
  user_code: string;
  amount: number;
  commission: number;
  created_at: string;
}

const RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom', value: 'custom' },
] as const;

const AdminAgentPerformance = () => {
  const [agents, setAgents] = useState<AgentPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Modal state
  const [modalAgent, setModalAgent] = useState<AgentPerf | null>(null);
  const [modalTxns, setModalTxns] = useState<AgentTxn[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalFilter, setModalFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [modalPage, setModalPage] = useState(1);
  const MODAL_PER_PAGE = 20;

  const getDateRange = useCallback((): { from: string | null; to: string | null } => {
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { from: start, to: null };
    }
    if (range === '7d') return { from: new Date(Date.now() - 7 * 86400000).toISOString(), to: null };
    if (range === '30d') return { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: null };
    if (range === 'custom' && customFrom) {
      const to = customTo ? new Date(customTo + 'T23:59:59').toISOString() : null;
      return { from: new Date(customFrom).toISOString(), to };
    }
    return { from: null, to: null };
  }, [range, customFrom, customTo]);

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();

    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'payment_agent' as any);
    if (!roles || roles.length === 0) { setAgents([]); setLoading(false); return; }

    const userIds = roles.map(r => r.user_id);

    let depsQuery = supabase.from('agent_deposits').select('agent_id, amount, commission').in('agent_id', userIds);
    let withsQuery = supabase.from('agent_withdrawals').select('agent_id, amount, commission').in('agent_id', userIds);
    if (from) { depsQuery = depsQuery.gte('created_at', from); withsQuery = withsQuery.gte('created_at', from); }
    if (to) { depsQuery = depsQuery.lte('created_at', to); withsQuery = withsQuery.lte('created_at', to); }

    const [profilesRes, walletsRes, depsRes, withsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, username, phone, user_code').in('user_id', userIds),
      supabase.from('agent_wallets').select('user_id, balance').in('user_id', userIds),
      depsQuery,
      withsQuery,
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const walletMap = new Map((walletsRes.data || []).map(w => [w.user_id, w]));

    const depStats: Record<string, { count: number; total: number; commission: number }> = {};
    (depsRes.data || []).forEach(d => {
      if (!depStats[d.agent_id]) depStats[d.agent_id] = { count: 0, total: 0, commission: 0 };
      depStats[d.agent_id].count++;
      depStats[d.agent_id].total += Number(d.amount);
      depStats[d.agent_id].commission += Number(d.commission);
    });

    const withStats: Record<string, { count: number; total: number; commission: number }> = {};
    (withsRes.data || []).forEach(w => {
      if (!withStats[w.agent_id]) withStats[w.agent_id] = { count: 0, total: 0, commission: 0 };
      withStats[w.agent_id].count++;
      withStats[w.agent_id].total += Number(w.amount);
      withStats[w.agent_id].commission += Number(w.commission);
    });

    const perfList: AgentPerf[] = userIds.map(uid => {
      const p = profileMap.get(uid);
      const ds = depStats[uid] || { count: 0, total: 0, commission: 0 };
      const ws = withStats[uid] || { count: 0, total: 0, commission: 0 };
      return {
        user_id: uid,
        username: p?.username || 'Agent',
        phone: p?.phone || null,
        user_code: p?.user_code || null,
        deposit_count: ds.count,
        deposit_total: ds.total,
        deposit_commission: ds.commission,
        withdraw_count: ws.count,
        withdraw_total: ws.total,
        withdraw_commission: ws.commission,
        total_commission: ds.commission + ws.commission,
        wallet_balance: walletMap.get(uid)?.balance || 0,
      };
    });

    perfList.sort((a, b) => b.total_commission - a.total_commission);
    setAgents(perfList);
    setLoading(false);
  }, [getDateRange]);

  useEffect(() => { if (range !== 'custom') fetchPerformance(); }, [fetchPerformance, range]);

  const openAgentModal = async (agent: AgentPerf) => {
    setModalAgent(agent);
    setModalFilter('all');
    setModalPage(1);
    setModalLoading(true);
    setModalTxns([]);

    const [depsRes, withsRes] = await Promise.all([
      supabase.from('agent_deposits').select('id, user_code, amount, commission, created_at').eq('agent_id', agent.user_id).order('created_at', { ascending: false }).limit(200),
      supabase.from('agent_withdrawals').select('id, user_code, amount, commission, created_at').eq('agent_id', agent.user_id).order('created_at', { ascending: false }).limit(200),
    ]);

    const txns: AgentTxn[] = [
      ...(depsRes.data || []).map(d => ({ ...d, type: 'deposit' as const })),
      ...(withsRes.data || []).map(w => ({ ...w, type: 'withdrawal' as const })),
    ];
    txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setModalTxns(txns);
    setModalLoading(false);
  };

  const filteredTxns = modalFilter === 'all' ? modalTxns : modalTxns.filter(t => t.type === modalFilter);
  const totalPages = Math.max(1, Math.ceil(filteredTxns.length / MODAL_PER_PAGE));
  const paginatedTxns = filteredTxns.slice((modalPage - 1) * MODAL_PER_PAGE, modalPage * MODAL_PER_PAGE);

  // Grand totals
  const grandDepTotal = agents.reduce((s, a) => s + a.deposit_total, 0);
  const grandWithTotal = agents.reduce((s, a) => s + a.withdraw_total, 0);
  const grandDepComm = agents.reduce((s, a) => s + a.deposit_commission, 0);
  const grandWithComm = agents.reduce((s, a) => s + a.withdraw_commission, 0);
  const grandTotalComm = grandDepComm + grandWithComm;

  const exportCSV = () => {
    if (agents.length === 0) return;
    const headers = ['Agent Name', 'Phone', 'User Code', 'Balance', 'Dep Count', 'Dep Total', 'Dep Commission', 'With Count', 'With Total', 'With Commission', 'Total Commission'];
    const rows = agents.map(a => [
      a.username, a.phone || '', a.user_code || '', a.wallet_balance, a.deposit_count, a.deposit_total, a.deposit_commission, a.withdraw_count, a.withdraw_total, a.withdraw_commission, a.total_commission
    ]);
    rows.push(['TOTAL', '', '', '', '', grandDepTotal, grandDepComm, '', grandWithTotal, grandWithComm, grandTotalComm]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-performance-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-lg md:text-2xl">📊 Agent Performance</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={agents.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40">
            <Download size={14} /> CSV Export
          </button>
          <button onClick={fetchPerformance} className="p-2 rounded-lg bg-card gold-border">
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-card rounded-xl gold-border p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-muted-foreground" />
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
            </div>
            <span className="text-muted-foreground text-xs">→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
            <button onClick={fetchPerformance} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold">ফিল্টার</button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-3 gold-border text-center">
          <Users size={18} className="text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Total Agents</p>
          <p className="font-heading font-bold text-lg">{agents.length}</p>
        </div>
        <div className="bg-card rounded-xl p-3 gold-border text-center">
          <ArrowDownCircle size={18} className="text-green-400 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Total Deposits</p>
          <p className="font-heading font-bold text-sm text-green-400">৳{grandDepTotal.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl p-3 gold-border text-center">
          <ArrowUpCircle size={18} className="text-orange-400 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Total Withdrawals</p>
          <p className="font-heading font-bold text-sm text-orange-400">৳{grandWithTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Commission Summary */}
      <div className="bg-card rounded-xl gold-border p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Dep Commission</p>
            <p className="font-heading font-bold text-sm text-primary">৳{grandDepComm.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">With Commission</p>
            <p className="font-heading font-bold text-sm text-primary">৳{grandWithComm.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">= Total Commission</p>
            <p className="font-heading font-bold text-lg text-primary">৳{grandTotalComm.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Agent List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="md:hidden space-y-3">
            {agents.map(a => (
              <div key={a.user_id} className="bg-card rounded-xl gold-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading font-bold">{a.username}</p>
                    <p className="text-xs text-muted-foreground">📞 {a.phone || 'N/A'} • <span className="text-primary">{a.user_code || '-'}</span></p>
                  </div>
                  <p className="font-heading font-bold text-primary text-sm">৳{a.wallet_balance.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Dep:</span> <span className="font-bold text-green-400">৳{a.deposit_total.toLocaleString()}</span> ({a.deposit_count})</div>
                  <div><span className="text-muted-foreground">With:</span> <span className="font-bold text-orange-400">৳{a.withdraw_total.toLocaleString()}</span> ({a.withdraw_count})</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Commission:</span> <span className="font-bold text-primary">৳{a.total_commission.toLocaleString()}</span></div>
                </div>
                <button onClick={() => openAgentModal(a)} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/20 text-primary rounded-xl text-sm font-heading font-bold">
                  <Eye size={14} /> Transaction Details
                </button>
              </div>
            ))}
            {agents.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No agents found</p>}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block bg-card rounded-xl gold-border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left p-3">Agent</th>
                  <th className="text-left p-3">Balance</th>
                  <th className="text-center p-3">Dep Count</th>
                  <th className="text-center p-3">Dep Total</th>
                  <th className="text-center p-3">With Count</th>
                  <th className="text-center p-3">With Total</th>
                  <th className="text-center p-3">Commission</th>
                  <th className="text-center p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.user_id} className="border-t border-border hover:bg-secondary/50">
                    <td className="p-3">
                      <p className="font-heading font-bold text-xs">{a.username}</p>
                      <p className="text-[10px] text-muted-foreground">📞 {a.phone} • <span className="text-primary">{a.user_code}</span></p>
                    </td>
                    <td className="p-3 font-heading font-bold text-xs text-primary">৳{a.wallet_balance.toLocaleString()}</td>
                    <td className="p-3 text-center font-heading font-bold text-xs">{a.deposit_count}</td>
                    <td className="p-3 text-center font-heading font-bold text-xs text-green-400">৳{a.deposit_total.toLocaleString()}</td>
                    <td className="p-3 text-center font-heading font-bold text-xs">{a.withdraw_count}</td>
                    <td className="p-3 text-center font-heading font-bold text-xs text-orange-400">৳{a.withdraw_total.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <p className="font-heading font-bold text-sm text-primary">৳{a.total_commission.toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">D:৳{a.deposit_commission.toLocaleString()} + W:৳{a.withdraw_commission.toLocaleString()}</p>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => openAgentModal(a)} className="p-2 min-w-[36px] rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors" title="Transaction Details">
                        <Eye size={14} className="text-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agents.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No agents found</p>}
          </div>
        </>
      )}

      {/* Transaction Detail Modal */}
      {modalAgent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" onClick={() => setModalAgent(null)}>
          <div className="bg-card rounded-2xl gold-border w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-heading font-bold text-base">{modalAgent.username} — Transaction History</h2>
                <p className="text-[10px] text-muted-foreground">📞 {modalAgent.phone} • <span className="text-primary">{modalAgent.user_code}</span></p>
              </div>
              <button onClick={() => setModalAgent(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-secondary">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-border">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Deposits</p>
                <p className="font-heading font-bold text-xs text-green-400">৳{modalAgent.deposit_total.toLocaleString()} ({modalAgent.deposit_count})</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Withdrawals</p>
                <p className="font-heading font-bold text-xs text-orange-400">৳{modalAgent.withdraw_total.toLocaleString()} ({modalAgent.withdraw_count})</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Total Commission</p>
                <p className="font-heading font-bold text-xs text-primary">৳{modalAgent.total_commission.toLocaleString()}</p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 p-3 border-b border-border">
              {(['all', 'deposit', 'withdrawal'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setModalFilter(f); setModalPage(1); }}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    modalFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'deposit' ? '⬇ Deposit' : '⬆ Withdraw'}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground self-center">{filteredTxns.length} items</span>
            </div>

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {modalLoading ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Loading...</p>
              ) : filteredTxns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No transactions found</p>
              ) : (
                paginatedTxns.map(txn => (
                  <div key={txn.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${txn.type === 'deposit' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {txn.type === 'deposit' ? '⬇ DEP' : '⬆ WTH'}
                      </span>
                      <div>
                        <p className="text-xs font-heading font-bold">User: <span className="text-primary">{txn.user_code}</span></p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(txn.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-heading font-bold text-xs">৳{Number(txn.amount).toLocaleString()}</p>
                      <p className="text-[10px] text-primary">Comm: ৳{Number(txn.commission).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
                <button
                  onClick={() => setModalPage(p => Math.max(1, p - 1))}
                  disabled={modalPage <= 1}
                  className="min-h-[44px] flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-secondary text-muted-foreground disabled:opacity-30"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {modalPage} / {totalPages}
                </span>
                <button
                  onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                  disabled={modalPage >= totalPages}
                  className="min-h-[44px] flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-secondary text-muted-foreground disabled:opacity-30"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgentPerformance;