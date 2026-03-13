import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Wallet, TrendingUp, ArrowDownCircle, ArrowUpCircle, Users, RefreshCw, Send, CheckCircle, Clock, ChevronLeft, ChevronRight, CalendarIcon, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface AgentStats {
  balance: number;
  total_deposited: number;
  total_deposit_commission: number;
  total_withdraw_commission: number;
  deposit_pending: number;
  withdraw_pending: number;
  total_users_served: number;
  recent_deposits: { user_code: string; amount: number; commission: number; created_at: string }[];
  recent_withdrawals: { user_code: string; amount: number; commission: number; created_at: string }[];
}

interface Settlement {
  id: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
  approved_at: string | null;
  type?: string;
}

const AgentOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositCommSettings, setDepositCommSettings] = useState<{ per_amount: number; commission: number } | null>(null);
  const [withdrawCommSettings, setWithdrawCommSettings] = useState<{ per_amount: number; commission: number } | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);
  const [settPage, setSettPage] = useState(0);

  // Direct Deposit state
  const [depositUserCode, setDepositUserCode] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [settTotal, setSettTotal] = useState(0);
  const [settDatePreset, setSettDatePreset] = useState<number>(-1);
  const [settDateFrom, setSettDateFrom] = useState<Date | undefined>();
  const [settDateTo, setSettDateTo] = useState<Date | undefined>();
  const [settStatusFilter, setSettStatusFilter] = useState<string>('all');

  const SETT_PAGE_SIZE = 10;

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [walletRes, agentDepsRes, agentWithsRes, pendingDepsRes, pendingWithsRes, depCommRes, withCommRes] = await Promise.all([
      supabase.from('agent_wallets').select('balance, total_deposited, total_commission').eq('user_id', user.id).maybeSingle(),
      supabase.from('agent_deposits').select('*').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('agent_withdrawals').select('*').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('agent_commission_settings').select('per_amount, commission').limit(1).single(),
      supabase.from('agent_withdraw_commission_settings').select('per_amount, commission').limit(1).single(),
    ]);

    const [allDepsRes, allWithsRes] = await Promise.all([
      supabase.from('agent_deposits').select('user_code, commission').eq('agent_id', user.id),
      supabase.from('agent_withdrawals').select('user_code, commission').eq('agent_id', user.id),
    ]);

    const allDepUsers = (allDepsRes.data || []).map(d => d.user_code);
    const allWithUsers = (allWithsRes.data || []).map(w => w.user_code);
    const uniqueUsers = new Set([...allDepUsers, ...allWithUsers]);

    const totalDepositComm = (allDepsRes.data || []).reduce((s, d) => s + Number(d.commission), 0);
    const totalWithdrawComm = (allWithsRes.data || []).reduce((s, w) => s + Number(w.commission), 0);

    setStats({
      balance: walletRes.data?.balance || 0,
      total_deposited: walletRes.data?.total_deposited || 0,
      total_deposit_commission: totalDepositComm,
      total_withdraw_commission: totalWithdrawComm,
      deposit_pending: pendingDepsRes.count || 0,
      withdraw_pending: pendingWithsRes.count || 0,
      total_users_served: uniqueUsers.size,
      recent_deposits: (agentDepsRes.data || []).map(d => ({ user_code: d.user_code, amount: d.amount, commission: d.commission, created_at: d.created_at })),
      recent_withdrawals: (agentWithsRes.data || []).map(w => ({ user_code: w.user_code, amount: w.amount, commission: w.commission, created_at: w.created_at })),
    });

    if (depCommRes.data) setDepositCommSettings(depCommRes.data);
    if (withCommRes.data) setWithdrawCommSettings(withCommRes.data);

    setLoading(false);
  }, [user]);

  const fetchSettlements = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('agent_settlements')
      .select('*', { count: 'exact' })
      .eq('agent_id', user.id);

    if (settStatusFilter !== 'all') query = query.eq('status', settStatusFilter);

    if (settDatePreset >= 0) {
      query = query.gte('created_at', startOfDay(subDays(new Date(), settDatePreset)).toISOString());
    } else if (settDateFrom) {
      query = query.gte('created_at', startOfDay(settDateFrom).toISOString());
      if (settDateTo) query = query.lte('created_at', endOfDay(settDateTo).toISOString());
    }

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(settPage * SETT_PAGE_SIZE, (settPage + 1) * SETT_PAGE_SIZE - 1);

    setSettlements((data || []) as Settlement[]);
    setSettTotal(count || 0);
  }, [user, settPage, settStatusFilter, settDatePreset, settDateFrom, settDateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);
  useEffect(() => { setSettPage(0); }, [settStatusFilter, settDatePreset, settDateFrom, settDateTo]);

  const handleDirectDeposit = async () => {
    if (!user) return;
    const code = depositUserCode.trim().toUpperCase();
    const amt = Number(depositAmount);
    if (!code) { toast.error('Enter user code'); return; }
    if (amt < 100) { toast.error('Minimum deposit ৳100'); return; }
    if (stats && amt > stats.balance) { toast.error('Insufficient agent balance'); return; }

    setDepositLoading(true);
    let result: { success?: boolean; error?: string; commission?: number };
    try {
      result = await api.rpc<{ success?: boolean; error?: string; commission?: number }>('process_agent_deposit', {
        p_agent_id: user.id,
        p_user_code: code,
        p_amount: amt,
      });
    } catch (e: unknown) {
      setDepositLoading(false);
      toast.error('Error: ' + (e as Error)?.message);
      return;
    }
    setDepositLoading(false);
    if (!result?.success) { toast.error(result?.error || 'Deposit failed'); return; }

    toast.success(`✅ ৳${amt.toLocaleString()} deposited to ${code}! Commission: ৳${result?.commission ?? 0}`);
    setDepositUserCode('');
    setDepositAmount('');
    fetchStats();
  };

  const submitSettlement = async () => {
    if (!user) return;
    const amt = Number(settlementAmount);
    if (amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (stats && amt > stats.balance) { toast.error('Cannot settle more than your balance'); return; }
    setSubmittingSettlement(true);
    const { error } = await supabase.from('agent_settlements').insert({
      agent_id: user.id,
      amount: amt,
      note: settlementNote.trim() || null,
    });
    setSubmittingSettlement(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(`✅ ৳${amt.toLocaleString()} settlement request submitted!`);
    setSettlementAmount('');
    setSettlementNote('');
    fetchStats();
    fetchSettlements();
  };

  if (loading) return <div className="p-3 md:p-6 text-center text-muted-foreground">Loading...</div>;

  const totalCommission = (stats?.total_deposit_commission || 0) + (stats?.total_withdraw_commission || 0);

  const settlementStatusBadge = (status: string) => {
    if (status === 'approved') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold">✅ Approved</span>;
    if (status === 'rejected') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">❌ Rejected</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">⏳ Pending</span>;
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl">💰 Agent Dashboard</h1>
        <button onClick={fetchStats} className="p-2 rounded-lg bg-secondary"><RefreshCw size={16} /></button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <Wallet size={20} className="text-primary mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Owner Balance</p>
          <p className="font-heading font-bold text-lg text-primary">৳{(stats?.balance || 0).toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <TrendingUp size={20} className="text-green-400 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Total Commission</p>
          <p className="font-heading font-bold text-lg text-green-400">৳{totalCommission.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <ArrowDownCircle size={20} className="text-blue-400 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Pending Deposits</p>
          <p className="font-heading font-bold text-lg text-blue-400">{stats?.deposit_pending || 0}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <ArrowUpCircle size={20} className="text-orange-400 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Pending Withdrawals</p>
          <p className="font-heading font-bold text-lg text-orange-400">{stats?.withdraw_pending || 0}</p>
        </div>
      </div>

      {/* Direct Deposit to User */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-3">
        <h3 className="font-heading font-bold text-sm flex items-center gap-2">
          <UserPlus size={16} className="text-green-400" />
          Direct Deposit to User
        </h3>
        <p className="text-[10px] text-muted-foreground">Enter user code and amount to deposit directly from your balance. No admin approval needed.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={depositUserCode}
            onChange={e => setDepositUserCode(e.target.value.toUpperCase())}
            placeholder="User Code (e.g. LW250587)"
            className="flex-1 bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-center uppercase"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            placeholder="Amount (৳)"
            className="flex-1 bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-center"
          />
        </div>
        <div className="flex gap-2">
          {[500, 1000, 2000, 5000].map(v => (
            <button key={v} onClick={() => setDepositAmount(String(v))}
              className={`flex-1 py-2 text-xs font-heading font-bold rounded-lg transition-colors ${
                depositAmount === String(v) ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/20'
              }`}>
              ৳{v}
            </button>
          ))}
        </div>
        <button
          onClick={handleDirectDeposit}
          disabled={depositLoading || !depositUserCode.trim() || Number(depositAmount) < 100}
          className="w-full py-3 rounded-xl font-heading font-bold bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform disabled:opacity-50"
        >
          {depositLoading ? 'Processing...' : `Deposit ৳${Number(depositAmount || 0).toLocaleString()} to User`}
        </button>
        <p className="text-[10px] text-muted-foreground text-center">Your balance: ৳{(stats?.balance || 0).toLocaleString()}</p>
      </div>

      {/* Settlement: Pay Owner */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-3">
        <h3 className="font-heading font-bold text-sm flex items-center gap-2">
          <Send size={16} className="text-primary" />
          Pay Owner (Settlement)
        </h3>
        <p className="text-[10px] text-muted-foreground">You owe the owner ৳{(stats?.balance || 0).toLocaleString()}. Submit a settlement request after payment.</p>
        <div className="flex gap-2">
          <input
            type="number"
            value={settlementAmount}
            onChange={e => setSettlementAmount(e.target.value)}
            placeholder="Amount (৳)"
            className="flex-1 bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-center"
          />
        </div>
        <div className="flex gap-2">
          {[500, 1000, 2000, 5000].map(v => (
            <button key={v} onClick={() => setSettlementAmount(String(v))}
              className={`flex-1 py-2 text-xs font-heading font-bold rounded-lg transition-colors ${
                settlementAmount === String(v) ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/20'
              }`}>
              ৳{v}
            </button>
          ))}
          {stats && stats.balance > 0 && (
            <button onClick={() => setSettlementAmount(String(stats.balance))}
              className={`flex-1 py-2 text-xs font-heading font-bold rounded-lg transition-colors ${
                settlementAmount === String(stats.balance) ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/20'
              }`}>
              All
            </button>
          )}
        </div>
        <input
          value={settlementNote}
          onChange={e => setSettlementNote(e.target.value)}
          placeholder="Note (optional) - e.g. Sent via bKash 01XXXXXXXXX"
          className="w-full bg-secondary rounded-xl px-4 py-2.5 text-foreground text-sm outline-none gold-border focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={submitSettlement}
          disabled={submittingSettlement || Number(settlementAmount) <= 0}
          className="w-full py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
        >
          {submittingSettlement ? 'Submitting...' : `Submit Settlement ৳${Number(settlementAmount || 0).toLocaleString()}`}
        </button>
      </div>

      {/* Settlement History with Filters */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-3">
        <h3 className="font-heading font-bold text-sm flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          Settlement History
          <span className="text-[10px] text-muted-foreground ml-auto">{settTotal} results</span>
        </h3>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {['all', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setSettStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-heading font-bold transition-colors ${
                  settStatusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-card'
                }`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {[{ label: 'Today', days: 0 }, { label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: 'All', days: -1 }].map(p => (
              <button key={p.label} onClick={() => { setSettDatePreset(p.days); setSettDateFrom(undefined); setSettDateTo(undefined); }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-heading font-bold transition-colors ${
                  settDatePreset === p.days ? 'bg-primary text-primary-foreground' : 'hover:bg-card'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-heading font-bold transition-colors",
                settDatePreset === -2 ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-card'
              )}>
                <CalendarIcon size={10} />
                {settDatePreset === -2 && settDateFrom
                  ? `${format(settDateFrom, 'dd MMM')}${settDateTo ? ' - ' + format(settDateTo, 'dd MMM') : ''}`
                  : 'Custom'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 space-y-2">
                <p className="text-xs font-heading font-bold text-muted-foreground">From</p>
                <Calendar mode="single" selected={settDateFrom}
                  onSelect={(d) => { setSettDatePreset(-2); setSettDateFrom(d); }}
                  className={cn("p-3 pointer-events-auto")} />
                <p className="text-xs font-heading font-bold text-muted-foreground">To</p>
                <Calendar mode="single" selected={settDateTo}
                  onSelect={(d) => { setSettDatePreset(-2); setSettDateTo(d); }}
                  disabled={(d) => settDateFrom ? d < settDateFrom : false}
                  className={cn("p-3 pointer-events-auto")} />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Settlement List */}
        {settlements.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No settlements found</p>
        ) : (
          <div className="space-y-2">
            {settlements.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-heading font-bold text-sm">৳{s.amount.toLocaleString()}</p>
                    {s.type === 'commission_paid' 
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">💰 Commission</span>
                      : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold">🏦 Settlement</span>
                    }
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {s.note && <p className="text-[10px] text-muted-foreground mt-0.5">📝 {s.note}</p>}
                </div>
                <div className="text-right">
                  {settlementStatusBadge(s.status)}
                  {s.status === 'approved' && s.approved_at && (
                    <p className="text-[9px] text-green-400 mt-0.5">
                      {new Date(s.approved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {Math.ceil(settTotal / SETT_PAGE_SIZE) > 1 && (
          <div className="flex items-center justify-center gap-3 pt-1">
            <button onClick={() => setSettPage(p => Math.max(0, p - 1))} disabled={settPage === 0}
              className="p-1.5 rounded-lg bg-secondary disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-heading font-bold">{settPage + 1} / {Math.ceil(settTotal / SETT_PAGE_SIZE)}</span>
            <button onClick={() => setSettPage(p => Math.min(Math.ceil(settTotal / SETT_PAGE_SIZE) - 1, p + 1))}
              disabled={settPage >= Math.ceil(settTotal / SETT_PAGE_SIZE) - 1}
              className="p-1.5 rounded-lg bg-secondary disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Commission Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 gold-border">
          <h3 className="font-heading font-bold text-sm mb-2">💰 Deposit Commission</h3>
          <p className="font-heading font-bold text-xl text-primary">৳{(stats?.total_deposit_commission || 0).toLocaleString()}</p>
          {depositCommSettings && (
            <p className="text-[10px] text-muted-foreground mt-1">Rate: ৳{depositCommSettings.commission} per ৳{depositCommSettings.per_amount}</p>
          )}
        </div>
        <div className="bg-card rounded-xl p-4 gold-border">
          <h3 className="font-heading font-bold text-sm mb-2">💸 Withdraw Commission</h3>
          <p className="font-heading font-bold text-xl text-primary">৳{(stats?.total_withdraw_commission || 0).toLocaleString()}</p>
          {withdrawCommSettings && (
            <p className="text-[10px] text-muted-foreground mt-1">Rate: ৳{withdrawCommSettings.commission} per ৳{withdrawCommSettings.per_amount}</p>
          )}
        </div>
      </div>

      {/* More Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <Users size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Users Served</p>
          <p className="font-heading font-bold text-lg">{stats?.total_users_served || 0}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <ArrowDownCircle size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Total Deposited</p>
          <p className="font-heading font-bold text-lg">৳{(stats?.total_deposited || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-4 gold-border">
          <h3 className="font-heading font-bold text-sm mb-3">📋 Recent Deposits</h3>
          {(stats?.recent_deposits || []).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No deposits yet</p>
          ) : (
            <div className="space-y-2">
              {stats!.recent_deposits.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                  <div>
                    <p className="font-heading font-bold text-xs">{d.user_code}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-xs text-green-400">৳{d.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-primary">+৳{d.commission}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl p-4 gold-border">
          <h3 className="font-heading font-bold text-sm mb-3">📋 Recent Withdrawals</h3>
          {(stats?.recent_withdrawals || []).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No withdrawals yet</p>
          ) : (
            <div className="space-y-2">
              {stats!.recent_withdrawals.map((w, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                  <div>
                    <p className="font-heading font-bold text-xs">{w.user_code}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-xs text-orange-400">৳{w.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-primary">+৳{w.commission}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentOverview;
