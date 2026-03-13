import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { UserPlus, Check, X, Phone, MapPin, MessageCircle, Eye, EyeOff, Lock, Copy, Share2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApprovedCredentials {
  name: string;
  phone: string;
  whatsapp: string;
  password: string;
}

interface Application {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  location: string;
  message: string | null;
  nid_number: string | null;
  nid_front_url: string | null;
  nid_back_url: string | null;
  live_photo_url: string | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const AdminAgentApplications = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'revoked'>('pending');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvedCreds, setApprovedCreds] = useState<ApprovedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    let query = supabase
      .from('agent_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load data');
    } else {
      setApps(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, [filter]);

  // Realtime notification for new applications
  useEffect(() => {
    const channel = supabase
      .channel('agent-apps-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_applications' },
        (payload) => {
          const newApp = payload.new as Application;
          toast.info(`🆕 New agent application: ${newApp.name}`, { duration: 5000 });
          // Play notification sound
          try {
            const ctx = new AudioContext();
            [880, 1100].forEach((freq, i) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
              gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
              osc.start(ctx.currentTime + i * 0.15);
              osc.stop(ctx.currentTime + i * 0.15 + 0.3);
            });
          } catch {}
          // Refresh list if on pending filter
          if (filter === 'pending' || filter === 'all') {
            fetchApps();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const handleApprove = async (app: Application) => {
    if (!agentPassword || agentPassword.length < 6) {
      toast.error('Please set a password with at least 6 characters');
      return;
    }
    setActionLoading(true);
    try {
      const result = await api.adminApproveAgent({ application_id: app.id, password: agentPassword });
      if (result.success) {
        toast.success(`✅ ${app.name} approved!`);
        setApprovedCreds({ name: app.name, phone: app.phone, whatsapp: app.whatsapp || app.phone, password: agentPassword });
        setSelectedApp(null);
        setAgentPassword('');
        fetchApps();
      } else {
        toast.error(result.message || 'Failed to approve');
      }
    } catch {
      toast.error('Server error');
    }
    setActionLoading(false);
  };

  const getCredentialText = (creds: ApprovedCredentials) => {
    const loginUrl = `${window.location.origin}/agent-login`;
    return `🎉 Lucky Win BD Agent Account\n\n👤 Name: ${creds.name}\n📱 Phone: ${creds.phone}\n🔑 Password: ${creds.password}\n🔗 Login: ${loginUrl}\n\nLogin from the Agent Portal!`;
  };

  const handleCopyCredentials = async () => {
    if (!approvedCreds) return;
    try {
      await navigator.clipboard.writeText(getCredentialText(approvedCreds));
      setCopied(true);
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleWhatsAppShare = () => {
    if (!approvedCreds) return;
    const text = encodeURIComponent(getCredentialText(approvedCreds));
    const waNum = approvedCreds.whatsapp.replace(/[^0-9]/g, '');
    const bdPhone = waNum.startsWith('0') ? `88${waNum}` : waNum;
    window.open(`https://wa.me/${bdPhone}?text=${text}`, '_blank');
  };

  const handleReject = async (app: Application) => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    setActionLoading(true);
    const { error } = await supabase
      .from('agent_applications')
      .update({ status: 'rejected', reject_reason: rejectReason, reviewed_at: new Date().toISOString() })
      .eq('id', app.id);

    if (error) {
      toast.error('Failed to reject');
    } else {
      toast.success(`${app.name} rejected`);
      setSelectedApp(null);
      setRejectReason('');
      fetchApps();
    }
    setActionLoading(false);
  };

  const handleRevoke = async (app: Application) => {
    if (!confirm(`⚠️ Revoke "${app.name}" as Payment Agent? This will remove their role, wallet, and all payment numbers.`)) return;
    setActionLoading(true);
    try {
      let digits = app.phone.replace(/\D/g, '');
      if (digits.startsWith('880')) digits = '0' + digits.slice(3);
      if (!digits.startsWith('0')) digits = '0' + digits;
      let { data: profile } = await supabase.from('profiles').select('user_id').eq('phone', digits).single();
      if (!profile) {
        const altPhone = digits.startsWith('0') ? '880' + digits.slice(1) : digits;
        const { data: p2 } = await supabase.from('profiles').select('user_id').eq('phone', altPhone).single();
        profile = p2;
      }
      if (!profile) {
        toast.error('Agent profile not found. Remove manually from Payment Agents page.');
        setActionLoading(false);
        return;
      }
      const agentId = profile.user_id;
      await Promise.all([
        supabase.from('user_roles').delete().eq('user_id', agentId).eq('role', 'payment_agent' as any),
        supabase.from('agent_wallets').delete().eq('user_id', agentId),
        supabase.from('agent_payment_numbers').delete().eq('agent_id', agentId),
      ]);
      await supabase.from('agent_applications').update({ status: 'revoked', reject_reason: 'Revoked by admin', reviewed_at: new Date().toISOString() }).eq('id', app.id);
      toast.success(`${app.name} revoked – agent removed from system`);
      setSelectedApp(null);
      fetchApps();
    } catch {
      toast.error('Failed to revoke');
    }
    setActionLoading(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">⏳ Pending</span>;
      case 'approved': return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold">✅ Approved</span>;
      case 'rejected': return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold">❌ Rejected</span>;
      case 'revoked': return <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold">🚫 Revoked</span>;
      default: return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus size={22} className="text-primary" />
          <h1 className="font-heading font-bold text-xl gold-text">Agent Applications</h1>
        </div>
        <span className="text-xs text-muted-foreground">{apps.length} applications</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 bg-secondary rounded-lg p-1">
        {(['pending', 'approved', 'rejected', 'revoked', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 min-w-[60px] py-2 rounded-md text-xs font-heading font-bold transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'pending' ? '⏳ Pending' : f === 'approved' ? '✅ Approved' : f === 'rejected' ? '❌ Rejected' : f === 'revoked' ? '🚫 Revoked' : '📋 All'}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : apps.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No applications found</div>
      ) : (
        <div className="space-y-2">
          {apps.map(app => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl p-4 gold-border cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => setSelectedApp(app)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-heading font-bold text-sm">{app.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone size={10} /> {app.phone}</span>
                    <span className="flex items-center gap-1"><MapPin size={10} /> {app.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  {statusBadge(app.status)}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => { setSelectedApp(null); setRejectReason(''); setAgentPassword(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-50 bg-card rounded-2xl gold-border p-5 w-[calc(100%-2rem)] max-w-md max-h-[80vh] overflow-y-auto top-8 left-1/2 -translate-x-1/2 mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg gold-text">Application Details</h2>
                <button onClick={() => { setSelectedApp(null); setRejectReason(''); setAgentPassword(''); }} className="p-1 hover:bg-secondary rounded">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-secondary rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Name:</span>
                    <span className="font-heading font-bold text-sm">{selectedApp.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Phone:</span>
                    <span className="font-heading text-sm">{selectedApp.phone}</span>
                  </div>
                  {selectedApp.whatsapp && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">WhatsApp:</span>
                      <span className="font-heading text-sm">{selectedApp.whatsapp}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Location:</span>
                    <span className="font-heading text-sm">{selectedApp.location}</span>
                  </div>
                  {selectedApp.nid_number && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">NID:</span>
                      <span className="font-heading text-sm">{selectedApp.nid_number}</span>
                    </div>
                  )}
                  {/* NID & Live Photo */}
                  {(selectedApp.nid_front_url || selectedApp.nid_back_url || selectedApp.live_photo_url) && (
                    <div className="space-y-2 pt-1">
                      {selectedApp.live_photo_url && (
                        <div>
                          <span className="text-xs text-muted-foreground">📸 Live Photo:</span>
                          <img src={selectedApp.live_photo_url} alt="Live" className="w-full h-32 object-cover rounded-lg mt-1 border border-border" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {selectedApp.nid_front_url && (
                          <div>
                            <span className="text-[10px] text-muted-foreground">NID Front</span>
                            <img src={selectedApp.nid_front_url} alt="NID Front" className="w-full h-24 object-cover rounded-lg mt-0.5 border border-border cursor-pointer" onClick={() => window.open(selectedApp.nid_front_url!, '_blank')} />
                          </div>
                        )}
                        {selectedApp.nid_back_url && (
                          <div>
                            <span className="text-[10px] text-muted-foreground">NID Back</span>
                            <img src={selectedApp.nid_back_url} alt="NID Back" className="w-full h-24 object-cover rounded-lg mt-0.5 border border-border cursor-pointer" onClick={() => window.open(selectedApp.nid_back_url!, '_blank')} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedApp.message && (
                    <div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><MessageCircle size={10} /> Message:</span>
                      <p className="text-sm bg-background rounded p-2">{selectedApp.message}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Status:</span>
                    {statusBadge(selectedApp.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Date:</span>
                    <span className="text-xs">{new Date(selectedApp.created_at).toLocaleString('en-GB')}</span>
                  </div>
                  {selectedApp.reject_reason && (
                    <div>
                      <span className="text-xs text-red-400">Rejection Reason:</span>
                      <p className="text-xs text-red-300 mt-0.5">{selectedApp.reject_reason}</p>
                    </div>
                  )}
                </div>

                {selectedApp.status === 'approved' && (
                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground mb-2">This agent is active. To remove them completely (role, wallet, payment numbers):</p>
                    <button
                      onClick={() => handleRevoke(selectedApp)}
                      disabled={actionLoading}
                      className="w-full py-2.5 rounded-xl font-heading font-bold bg-orange-600 text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform text-sm"
                    >
                      🚫 Revoke Agent
                    </button>
                  </div>
                )}

                {selectedApp.status === 'pending' && (
                  <div className="space-y-3">
                    {/* Approve with password */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-heading font-bold text-green-400 flex items-center gap-1">
                        <Lock size={12} /> Set Agent Login Password
                      </p>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={agentPassword}
                          onChange={e => setAgentPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none border border-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        The agent will use this password to login at /agent-login
                      </p>
                      <button
                        onClick={() => handleApprove(selectedApp)}
                        disabled={actionLoading || agentPassword.length < 6}
                        className="w-full py-2.5 rounded-xl font-heading font-bold bg-green-600 text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform text-sm"
                      >
                        <Check size={16} /> Approve & Create Account
                      </button>
                    </div>

                    {/* Reject */}
                    <div className="space-y-2">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Enter rejection reason..."
                        rows={2}
                        className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none gold-border focus:ring-2 focus:ring-destructive resize-none"
                      />
                      <button
                        onClick={() => handleReject(selectedApp)}
                        disabled={actionLoading}
                        className="w-full py-2 rounded-xl font-heading font-bold bg-destructive text-destructive-foreground flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
                      >
                        <X size={16} /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Approved Credentials Card */}
      <AnimatePresence>
        {approvedCreds && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70"
              onClick={() => { setApprovedCreds(null); setCopied(false); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="fixed z-[60] bg-card rounded-2xl gold-border p-5 w-[calc(100%-2rem)] max-w-sm max-h-[80vh] overflow-y-auto top-8 left-1/2 -translate-x-1/2 mb-8"
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={28} className="text-green-500" />
                </div>
                <h2 className="font-heading font-bold text-lg gold-text">Agent Account Created!</h2>
                <p className="text-[11px] text-muted-foreground mt-1">Copy the details below and send to the agent</p>
              </div>

              {/* Credentials Display */}
              <div className="bg-secondary rounded-xl p-4 space-y-2.5 font-mono text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">👤 Name</span>
                  <span className="font-heading font-bold">{approvedCreds.name}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">📱 Phone</span>
                  <span className="font-heading font-bold">{approvedCreds.phone}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">🔑 Password</span>
                  <span className="font-heading font-bold">{approvedCreds.password}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">🔗 Login</span>
                  <span className="font-heading font-bold text-primary text-[11px]">/agent-login</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={handleCopyCredentials}
                  className="py-2.5 rounded-xl font-heading font-bold bg-secondary border border-border text-foreground flex items-center justify-center gap-2 active:scale-95 transition-transform text-xs"
                >
                  {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  className="py-2.5 rounded-xl font-heading font-bold bg-green-600 text-white flex items-center justify-center gap-2 active:scale-95 transition-transform text-xs"
                >
                  <Share2 size={14} />
                  WhatsApp
                </button>
              </div>

              <button
                onClick={() => { setApprovedCreds(null); setCopied(false); }}
                className="w-full mt-3 py-2 rounded-xl font-heading text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAgentApplications;
