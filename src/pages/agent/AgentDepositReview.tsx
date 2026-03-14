import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, LogOut, RefreshCw, Bell, Clock, Search, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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

const AgentDepositReview = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'agent_approved' | 'all'>('pending');
  const [newCount, setNewCount] = useState(0);
  const [searchTrx, setSearchTrx] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.rpc<boolean>('has_role', { _user_id: user.id, _role: 'payment_agent' }).catch(() => false),
      api.rpc<boolean>('has_role', { _user_id: user.id, _role: 'admin' }).catch(() => false),
    ]).then(([isAgent, isAdmin]) => {
      const authorized = isAgent || isAdmin;
      setIsAuthorized(authorized);
      setLoading(false);
      if (authorized) fetchDeposits();
    });
  }, [user]);

  const fetchDeposits = useCallback(async () => {
    const { data } = await supabase
      .from('deposits')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!data) return;

    // Fetch user profiles for each deposit
    const userIds = [...new Set(data.map(d => d.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, user_code')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const enriched: DepositRequest[] = data.map(d => ({
      ...d,
      username: profileMap.get(d.user_id)?.username || 'Unknown',
      user_code: profileMap.get(d.user_id)?.user_code || '—',
    }));

    setDeposits(enriched);
    setNewCount(enriched.filter(d => d.status === 'pending').length);
  }, []);

  // Realtime subscription for new deposits
  useEffect(() => {
    if (!isAuthorized) return;
    const channel = supabase
      .channel('agent-deposit-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deposits' }, () => {
        fetchDeposits();
        toast.info('🔔 New deposit request received!');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deposits' }, () => {
        fetchDeposits();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthorized, fetchDeposits]);

  const approveDeposit = async (deposit: DepositRequest) => {
    if (!user) return;
    const { error } = await supabase
      .from('deposits')
      .update({ 
        status: 'agent_approved', 
        reviewed_by_agent: user.id,
        agent_approved_at: new Date().toISOString(),
      })
      .eq('id', deposit.id)
      .eq('status', 'pending');

    if (error) {
      toast.error('Failed to approve');
      return;
    }
    api.notifyAdminDepositApproved(deposit.id, deposit.amount).catch(() => {});
    toast.success(`✅ ৳${deposit.amount.toLocaleString()} Approved! Sent to admin`);
    fetchDeposits();
  };

  const rejectDeposit = async (id: string) => {
    const { error } = await supabase
      .from('deposits')
      .update({ status: 'rejected' })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) {
      toast.error('Failed to reject');
      return;
    }
    toast.success('Deposit rejected');
    fetchDeposits();
  };

  if (loading) return (
    <div className="min-h-screen navy-gradient flex items-center justify-center">
      <p className="text-primary animate-pulse font-heading text-xl">Loading...</p>
    </div>
  );

  if (!isAuthorized) return (
    <div className="min-h-screen navy-gradient flex items-center justify-center flex-col gap-4">
      <p className="text-destructive font-heading text-xl">⛔ Access Denied</p>
      <p className="text-muted-foreground text-sm">Payment Agent access required</p>
      <button onClick={() => signOut()} className="px-4 py-2 rounded-lg bg-secondary text-sm font-heading">Logout</button>
    </div>
  );

  const filtered = deposits.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (searchTrx && !d.trx_id?.toLowerCase().includes(searchTrx.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen navy-gradient">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/agent-overview')} className="p-2 rounded-lg bg-secondary">
              <ArrowLeft size={16} className="text-muted-foreground" />
            </button>
            <h1 className="font-heading font-bold text-lg">📋 Deposit Review</h1>
            {newCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-bold"
              >
                {newCount}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchDeposits} className="p-2 rounded-lg bg-secondary">
              <RefreshCw size={16} className="text-muted-foreground" />
            </button>
            <button onClick={() => signOut()} className="p-2 text-destructive">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {newCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2"
        >
          <Bell size={16} className="text-primary" />
          <p className="text-xs font-heading font-bold text-primary">{newCount} new deposit requests pending</p>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div className="px-4 mt-3 flex gap-2">
        {(['pending', 'agent_approved', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold capitalize transition-colors ${
              filter === f ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border text-muted-foreground'
            }`}
          >
            {f === 'agent_approved' ? 'Approved' : f}
            {f === 'pending' && ` (${deposits.filter(d => d.status === 'pending').length})`}
          </button>
        ))}
      </div>

      {/* Search TrxID */}
      <div className="px-4 mt-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTrx}
            onChange={e => setSearchTrx(e.target.value)}
            placeholder="Search by Transaction ID..."
            className="w-full bg-card rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none gold-border focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Deposit List */}
      <div className="px-4 mt-3 pb-6 space-y-2">
        <AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-heading">No deposit requests</p>
            </div>
          )}
          {filtered.map(d => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className={`bg-card rounded-xl p-4 gold-border space-y-2 ${
                d.status === 'pending' ? 'border-l-4 border-l-yellow-500' : 
                d.status === 'agent_approved' ? 'border-l-4 border-l-blue-500' : ''
              }`}
            >
              {/* User Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-bold text-sm">{d.username || 'Unknown'}</p>
                  <p className="text-[10px] text-primary font-heading font-bold">{d.user_code}</p>
                </div>
                <div className="text-right">
                  <p className="font-heading font-bold text-lg text-green-400">৳{Number(d.amount).toLocaleString()}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    d.status === 'agent_approved' ? 'bg-blue-500/20 text-blue-400' :
                    d.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {d.status === 'agent_approved' ? 'Agent Approved' : d.status}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="bg-secondary rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-heading font-bold">{d.method}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">TrxID:</span>
                  <span className="font-heading font-bold text-primary">{d.trx_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-heading">{d.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Time:</span>
                  <span>{new Date(d.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Actions */}
              {d.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveDeposit(d)}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-green-500/20 text-green-400 font-heading font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    onClick={() => rejectDeposit(d.id)}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-red-500/20 text-red-400 font-heading font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AgentDepositReview;
