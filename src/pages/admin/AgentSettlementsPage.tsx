import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, RefreshCw, Clock, ChevronLeft, ChevronRight, CalendarIcon, DollarSign } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Settlement {
  id: string;
  agent_id: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
  approved_at: string | null;
  type?: string;
  agent_username?: string;
  agent_balance?: number;
  agent_commission?: number;
}

interface AgentInfo {
  user_id: string;
  username: string;
  total_commission: number;
}

const PAGE_SIZE = 15;
const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'All', days: -1 },
];

const AgentSettlementsPage = () => {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<number>(-1);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [payingAgent, setPayingAgent] = useState<string | null>(null);

  // Fetch agents with pending commission
  const fetchAgents = useCallback(async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'payment_agent');
    if (!roles || roles.length === 0) { setAgents([]); return; }
    const agentIds = roles.map(r => r.user_id);
    const [profilesRes, walletsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, username').in('user_id', agentIds),
      supabase.from('agent_wallets').select('user_id, total_commission').in('user_id', agentIds),
    ]);
    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.username]));
    const walletMap = new Map((walletsRes.data || []).map(w => [w.user_id, w.total_commission]));
    setAgents(agentIds.map(id => ({
      user_id: id,
      username: profileMap.get(id) || 'Agent',
      total_commission: Number(walletMap.get(id) || 0),
    })).filter(a => a.total_commission > 0));
  }, []);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('agent_settlements')
      .select('*', { count: 'exact' });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);

    if (datePreset >= 0) {
      const start = startOfDay(subDays(new Date(), datePreset));
      query = query.gte('created_at', start.toISOString());
    } else if (dateFrom) {
      query = query.gte('created_at', startOfDay(dateFrom).toISOString());
      if (dateTo) query = query.lte('created_at', endOfDay(dateTo).toISOString());
    }

    query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    setTotalCount(count || 0);

    if (data && data.length > 0) {
      const agentIds = [...new Set(data.map(s => s.agent_id))];
      const [profilesRes, walletsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, username').in('user_id', agentIds),
        supabase.from('agent_wallets').select('user_id, balance, total_commission').in('user_id', agentIds),
      ]);
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.username]));
      const walletMap = new Map((walletsRes.data || []).map(w => [w.user_id, { balance: w.balance, commission: w.total_commission }]));

      setSettlements(data.map(s => ({
        ...s,
        agent_username: profileMap.get(s.agent_id) || 'Agent',
        agent_balance: walletMap.get(s.agent_id)?.balance || 0,
        agent_commission: walletMap.get(s.agent_id)?.commission || 0,
      })));
    } else {
      setSettlements([]);
    }
    setLoading(false);
  }, [page, statusFilter, typeFilter, datePreset, dateFrom, dateTo]);

  useEffect(() => { fetchSettlements(); fetchAgents(); }, [fetchSettlements, fetchAgents]);
  useEffect(() => { setPage(0); }, [statusFilter, typeFilter, datePreset, dateFrom, dateTo]);

  const handleApprove = async (settlement: Settlement) => {
    if (!user) return;
    try {
      await api.rpc('approve_agent_settlement', {
        p_settlement_id: settlement.id,
        p_admin_id: user.id,
      });
      toast.success(`✅ ৳${settlement.amount.toLocaleString()} settlement approved!`);
      fetchSettlements();
      fetchAgents();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleReject = async (settlement: Settlement) => {
    const { error } = await supabase
      .from('agent_settlements')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', settlement.id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('❌ Settlement rejected');
    fetchSettlements();
  };

  const handlePayCommission = async (agentId: string) => {
    if (!user) return;
    setPayingAgent(agentId);
    try {
      const result = await api.rpc<{ success?: boolean; error?: string; amount?: number }>('pay_agent_commission', {
        p_admin_id: user.id,
        p_agent_id: agentId,
      });
      if (!result?.success) { toast.error(result?.error); return; }
      toast.success(`✅ ৳${Number(result?.amount ?? 0).toLocaleString()} commission paid!`);
      fetchSettlements();
      fetchAgents();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setPayingAgent(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold">Approved</span>;
    if (status === 'rejected') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">Rejected</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">Pending</span>;
  };

  const typeBadge = (type?: string) => {
    if (type === 'commission_paid') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">💰 Commission</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold">🏦 Settlement</span>;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePreset = (days: number) => { setDatePreset(days); setDateFrom(undefined); setDateTo(undefined); };
  const handleCustomDate = (from?: Date, to?: Date) => { setDatePreset(-2); setDateFrom(from); setDateTo(to); };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-xl">💳 Agent Settlements</h1>
        <button onClick={() => { fetchSettlements(); fetchAgents(); }} className="p-2 rounded-lg bg-secondary"><RefreshCw size={16} /></button>
      </div>

      {/* Commission Pay Section */}
      {agents.length > 0 && (
        <div className="bg-card rounded-xl gold-border p-4 space-y-3">
          <h2 className="font-heading font-bold text-sm flex items-center gap-2">
            <DollarSign size={16} className="text-primary" /> Pay Agent Commission
          </h2>
          <div className="grid gap-2">
            {agents.map(agent => (
              <div key={agent.user_id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                <div>
                  <p className="font-heading font-bold text-sm">{agent.username}</p>
                  <p className="text-xs text-muted-foreground">Pending Commission: <span className="text-primary font-bold">৳{agent.total_commission.toLocaleString()}</span></p>
                </div>
                <button
                  onClick={() => handlePayCommission(agent.user_id)}
                  disabled={payingAgent === agent.user_id}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-heading font-bold text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  {payingAgent === agent.user_id ? 'Paying...' : 'Pay Commission'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        <strong>Settlement:</strong> Agent pays the app owner.
        <strong className="ml-2">Commission Paid:</strong> Admin pays agent's earned commission.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Type Filter */}
        <div className="flex gap-1 bg-card rounded-lg p-1 gold-border">
          {[
            { key: 'all', label: 'All' },
            { key: 'settlement', label: '🏦 Settlement' },
            { key: 'commission_paid', label: '💰 Commission' },
          ].map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-heading font-bold transition-colors ${
                typeFilter === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 bg-card rounded-lg p-1 gold-border">
          {['all', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-heading font-bold transition-colors ${
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
              }`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Date Presets */}
        <div className="flex gap-1 bg-card rounded-lg p-1 gold-border">
          {DATE_PRESETS.map(p => (
            <button key={p.label} onClick={() => handlePreset(p.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-heading font-bold transition-colors ${
                datePreset === p.days ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold gold-border transition-colors",
              datePreset === -2 ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary'
            )}>
              <CalendarIcon size={12} />
              {datePreset === -2 && dateFrom
                ? `${format(dateFrom, 'dd MMM')}${dateTo ? ' - ' + format(dateTo, 'dd MMM') : ''}`
                : 'Custom'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-2">
              <p className="text-xs font-heading font-bold text-muted-foreground">From</p>
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => handleCustomDate(d, dateTo)} className={cn("p-3 pointer-events-auto")} />
              <p className="text-xs font-heading font-bold text-muted-foreground">To</p>
              <Calendar mode="single" selected={dateTo} onSelect={(d) => handleCustomDate(dateFrom, d)} disabled={(d) => dateFrom ? d < dateFrom : false} className={cn("p-3 pointer-events-auto")} />
            </div>
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground ml-auto">{totalCount} results</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : settlements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No settlements found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {settlements.map(s => (
            <div key={s.id} className="bg-card rounded-xl p-4 gold-border space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-bold text-sm">{s.agent_username}</p>
                    {typeBadge(s.type)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-heading font-bold text-lg ${s.type === 'commission_paid' ? 'text-blue-400' : 'text-primary'}`}>
                    ৳{s.amount.toLocaleString()}
                  </p>
                  {statusBadge(s.status)}
                </div>
              </div>

              {s.note && (
                <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">📝 {s.note}</p>
              )}

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Agent Balance: ৳{(s.agent_balance || 0).toLocaleString()}</span>
              </div>

              {s.status === 'pending' && s.type !== 'commission_paid' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => handleApprove(s)}
                    className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 font-heading font-bold text-sm flex items-center justify-center gap-1 hover:bg-green-500/20 transition-colors">
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button onClick={() => handleReject(s)}
                    className="flex-1 py-2 rounded-lg bg-destructive/10 text-destructive font-heading font-bold text-sm flex items-center justify-center gap-1 hover:bg-destructive/20 transition-colors">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              )}

              {s.status === 'approved' && s.approved_at && (
                <p className="text-[10px] text-green-400">
                  ✅ {s.type === 'commission_paid' ? 'Paid' : 'Approved'}: {new Date(s.approved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-2 rounded-lg bg-secondary disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-heading font-bold">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="p-2 rounded-lg bg-secondary disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentSettlementsPage;
