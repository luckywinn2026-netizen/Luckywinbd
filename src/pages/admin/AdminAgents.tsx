import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Wallet, TrendingUp, RefreshCw, Search, Key, Trash2, Phone, PlusCircle, X, MessageCircle, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentInfo {
  user_id: string;
  username: string | null;
  phone: string | null;
  user_code: string | null;
  telegram_link: string | null;
  balance: number;
  total_deposited: number;
  total_commission: number;
}

interface CommissionSettings {
  id: string;
  per_amount: number;
  commission: number;
}

interface AgentPaymentNumber {
  id: string;
  agent_id: string;
  payment_method: string;
  number: string;
  is_active: boolean;
  rotation_hours: number;
  sort_order: number;
}

const AdminAgents = () => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [commSettings, setCommSettings] = useState<CommissionSettings | null>(null);
  const [withdrawCommSettings, setWithdrawCommSettings] = useState<CommissionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Add agent
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAgentNameInput, setAddAgentNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [addPasswordInput, setAddPasswordInput] = useState('');
  const [adding, setAdding] = useState(false);

  // Load balance
  const [loadAgentId, setLoadAgentId] = useState<string | null>(null);
  const [loadAmount, setLoadAmount] = useState('');
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Password set
  const [passwordAgentId, setPasswordAgentId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  // Commission edit
  const [commPerAmount, setCommPerAmount] = useState('');
  const [commAmount, setCommAmount] = useState('');
  const [wCommPerAmount, setWCommPerAmount] = useState('');
  const [wCommAmount, setWCommAmount] = useState('');
  const [savingComm, setSavingComm] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  // Agent payment numbers
  const [agentNumbers, setAgentNumbers] = useState<AgentPaymentNumber[]>([]);
  const [showNumberForm, setShowNumberForm] = useState<string | null>(null);
  const [numMethod, setNumMethod] = useState('');
  const [numNumber, setNumNumber] = useState('');
  const [numRotationHours, setNumRotationHours] = useState('2');
  const [numSortOrder, setNumSortOrder] = useState('0');
  const [savingNumber, setSavingNumber] = useState(false);
  const [editingTelegramId, setEditingTelegramId] = useState<string | null>(null);
  const [telegramInput, setTelegramInput] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);

  // Bulk add
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: number; failed: string[] } | null>(null);

  const MAX_BULK = 200;

  useEffect(() => { fetchData(); fetchAgentNumbers(); }, []);

  const parsePhoneList = (text: string): string[] => {
    const lines = text.split(/[\n,\t;]/).map(s => s.trim()).filter(Boolean);
    const phones: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      let digits = line.replace(/\D/g, '');
      if (digits.startsWith('880')) digits = '0' + digits.slice(3);
      if (!digits.startsWith('0')) digits = '0' + digits;
      const phone = /^01[3-9]\d{8}$/.test(digits) ? digits : null;
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        phones.push(phone);
      }
    }
    return phones.slice(0, MAX_BULK);
  };

  const fetchData = async () => {
    setLoading(true);
    // Get all payment_agent roles
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'payment_agent' as any);
    if (!roles || roles.length === 0) { setAgents([]); setLoading(false); fetchCommission(); return; }

    const userIds = roles.map(r => r.user_id);
    const [profilesRes, walletsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, username, phone, user_code, telegram_link').in('user_id', userIds),
      supabase.from('agent_wallets').select('*').in('user_id', userIds),
    ]);

    const walletMap = Object.fromEntries((walletsRes.data || []).map((w: any) => [w.user_id, w]));
    const agentList: AgentInfo[] = (profilesRes.data || []).map((p: any) => ({
      user_id: p.user_id,
      username: p.username,
      phone: p.phone,
      user_code: p.user_code,
      telegram_link: p.telegram_link || null,
      balance: walletMap[p.user_id]?.balance || 0,
      total_deposited: walletMap[p.user_id]?.total_deposited || 0,
      total_commission: walletMap[p.user_id]?.total_commission || 0,
    }));
    setAgents(agentList);
    setLoading(false);
    fetchCommission();
  };

  const fetchCommission = async () => {
    const [depRes, withRes] = await Promise.all([
      supabase.from('agent_commission_settings').select('*').limit(1).single(),
      supabase.from('agent_withdraw_commission_settings').select('*').limit(1).single(),
    ]);
    if (depRes.data) {
      setCommSettings(depRes.data as CommissionSettings);
      setCommPerAmount(String(depRes.data.per_amount));
      setCommAmount(String(depRes.data.commission));
    }
    if (withRes.data) {
      setWithdrawCommSettings(withRes.data as CommissionSettings);
      setWCommPerAmount(String(withRes.data.per_amount));
      setWCommAmount(String(withRes.data.commission));
    }
  };

  const fetchAgentNumbers = async () => {
    const { data } = await supabase.from('agent_payment_numbers').select('*').order('payment_method').order('sort_order').order('created_at');
    if (data) setAgentNumbers(data as AgentPaymentNumber[]);
  };

  const saveTelegramLink = async (userId: string) => {
    setSavingTelegram(true);
    const { error } = await supabase.from('profiles').update({ telegram_link: telegramInput.trim() || null }).eq('user_id', userId);
    setSavingTelegram(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Telegram link saved');
    setEditingTelegramId(null);
    setTelegramInput('');
    fetchData();
  };

  const addAgentNumber = async (agentId: string) => {
    const rotationHours = Number(numRotationHours);
    const sortOrder = Number(numSortOrder);
    if (!numMethod.trim() || !numNumber.trim()) { toast.error('Enter Method and Number'); return; }
    if (rotationHours <= 0) { toast.error('Rotation hour must be at least 1'); return; }
    setSavingNumber(true);
    const { error } = await supabase.from('agent_payment_numbers').insert({
      agent_id: agentId,
      payment_method: numMethod.trim(),
      number: numNumber.trim(),
      rotation_hours: rotationHours,
      sort_order: sortOrder,
    });
    setSavingNumber(false);
    if (error) { toast.error('Failed to add number'); return; }
    toast.success('Number added!');
    setNumMethod(''); setNumNumber(''); setNumRotationHours('2'); setNumSortOrder('0'); setShowNumberForm(null);
    fetchAgentNumbers();
  };

  const setAgentNumberField = (id: string, field: keyof AgentPaymentNumber, value: string | number | boolean) => {
    setAgentNumbers(current => current.map((entry) => (
      entry.id === id ? { ...entry, [field]: value } : entry
    )));
  };

  const saveAgentNumber = async (entry: AgentPaymentNumber) => {
    const rotationHours = Number(entry.rotation_hours);
    const sortOrder = Number(entry.sort_order);
    if (!entry.payment_method.trim() || !entry.number.trim()) {
      toast.error('Method and number are required');
      return;
    }
    if (rotationHours <= 0) {
      toast.error('Rotation hour must be at least 1');
      return;
    }

    setSavingNumber(true);
    const { error } = await supabase
      .from('agent_payment_numbers')
      .update({
        payment_method: entry.payment_method.trim(),
        number: entry.number.trim(),
        rotation_hours: rotationHours,
        sort_order: sortOrder,
        is_active: entry.is_active,
      })
      .eq('id', entry.id);
    setSavingNumber(false);

    if (error) {
      toast.error('Failed to update number');
      return;
    }

    toast.success('Rotation updated');
    fetchAgentNumbers();
  };

  const deleteAgentNumber = async (id: string) => {
    await supabase.from('agent_payment_numbers').delete().eq('id', id);
    toast.success('Number deleted');
    fetchAgentNumbers();
  };

  const addAgent = async () => {
    const phone = phoneInput.trim();
    if (!phone || phone.length < 11) { toast.error('Enter a valid phone number'); return; }
    const pwd = addPasswordInput.trim();

    // Normalize phone for lookup
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('880')) digits = '0' + digits.slice(3);
    if (!digits.startsWith('0')) digits = '0' + digits;

    setAdding(true);

    let { data: profile } = await supabase.from('profiles').select('user_id, username').eq('phone', digits).maybeSingle();
    if (!profile && digits.startsWith('0')) {
      const { data: p2 } = await supabase.from('profiles').select('user_id, username').eq('phone', '880' + digits.slice(1)).maybeSingle();
      profile = p2;
    }

    if (!profile) {
      // No existing user – create new agent with phone + password (agent logs in with these)
      if (pwd.length < 6) {
        toast.error('Password required (min 6 chars). Agent will login with this number and password.');
        setAdding(false);
        return;
      }
      try {
        await api.adminAddAgentDirect({ phone: digits, password: pwd, name: addAgentNameInput.trim() || undefined });
        toast.success('Agent created! They can login at /agent-login with this number and password.');
        setShowAddModal(false); setAddAgentNameInput(''); setPhoneInput(''); setAddPasswordInput('');
        fetchData();
      } catch (e: unknown) {
        toast.error((e as Error)?.message || 'Failed to create agent');
      }
      setAdding(false);
      return;
    }

    // Existing user – add role and wallet
    const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', profile.user_id).eq('role', 'payment_agent' as any).single();
    if (existing) { toast.error('Already a payment agent!'); setAdding(false); return; }

    const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: profile.user_id, role: 'payment_agent' as any });
    if (roleErr) { toast.error('Role assign failed'); setAdding(false); return; }

    await supabase.from('agent_wallets').insert({ user_id: profile.user_id, balance: 0 });

    const agentName = addAgentNameInput.trim();
    if (agentName) {
      await supabase.from('profiles').update({ username: agentName }).eq('user_id', profile.user_id);
    }

    if (pwd.length >= 6) {
      try {
        await api.adminSetPassword({ user_id: profile.user_id, password: pwd });
        toast.success(`✅ ${profile.username || phone} Agent + Password set!`);
      } catch (e: unknown) {
        toast.warning(`Agent added but password failed: ${(e as Error)?.message}`);
      }
    } else {
      toast.success(`${profile.username || phone} is now a Payment Agent!`);
    }

    setAdding(false); setShowAddModal(false); setAddAgentNameInput(''); setPhoneInput(''); setAddPasswordInput('');
    fetchData();
  };

  const bulkAddAgents = async () => {
    const phones = parsePhoneList(bulkInput);
    if (phones.length === 0) {
      toast.error('Enter valid phone numbers (01XXXXXXXXX, one per line or comma-separated). Max 200.');
      return;
    }
    setBulkAdding(true);
    setBulkResult(null);
    let added = 0;
    const failed: string[] = [];
    for (const phone of phones) {
      const { data: profile } = await supabase.from('profiles').select('user_id, username').eq('phone', phone).single();
      if (!profile) {
        failed.push(phone + ' (not found)');
        continue;
      }
      const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', profile.user_id).eq('role', 'payment_agent' as any).single();
      if (existing) {
        failed.push(phone + ' (already agent)');
        continue;
      }
      const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: profile.user_id, role: 'payment_agent' as any });
      if (roleErr) {
        failed.push(phone + ' (role failed)');
        continue;
      }
      await supabase.from('agent_wallets').insert({ user_id: profile.user_id, balance: 0 });
      added++;
    }
    setBulkResult({ added, skipped: failed.length, failed });
    setBulkAdding(false);
    if (added > 0) fetchData();
    toast.success(`Bulk add done: ${added} added, ${failed.length} skipped/failed`);
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBulkInput(String(reader.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadBalance = async () => {
    if (!loadAgentId) return;
    const amt = Number(loadAmount);
    if (amt <= 0) { toast.error('Enter a valid amount'); return; }
    setLoadingBalance(true);
    try {
      const data = await api.rpc<number>('load_agent_balance', {
        p_agent_user_id: loadAgentId,
        p_amount: amt,
      });
      toast.success(`৳${amt.toLocaleString()} loaded! New balance: ৳${Number(data).toLocaleString()}`);
      setLoadAgentId(null); setLoadAmount('');
      fetchData();
    } catch (e: unknown) {
      toast.error('Failed: ' + (e as Error)?.message);
    } finally {
      setLoadingBalance(false);
    }
  };

  const setAgentPassword = async () => {
    if (!passwordAgentId || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSettingPassword(true);
    try {
      await api.adminSetPassword({ user_id: passwordAgentId, password: newPassword });
      toast.success('✅ Password set!');
      setPasswordAgentId(null);
      setNewPassword('');
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const saveCommission = async () => {
    const perAmt = Number(commPerAmount);
    const comm = Number(commAmount);
    const wPerAmt = Number(wCommPerAmount);
    const wComm = Number(wCommAmount);
    if (perAmt <= 0 || comm < 0 || wPerAmt <= 0 || wComm < 0) { toast.error('Enter valid values'); return; }
    setSavingComm(true);
    await Promise.all([
      commSettings ? supabase.from('agent_commission_settings').update({ per_amount: perAmt, commission: comm }).eq('id', commSettings.id) : null,
      withdrawCommSettings ? supabase.from('agent_withdraw_commission_settings').update({ per_amount: wPerAmt, commission: wComm }).eq('id', withdrawCommSettings.id) : null,
    ]);
    setSavingComm(false);
    toast.success('Commission updated!');
    fetchCommission();
  };

  const removeAgent = async (agentId: string, name: string) => {
    if (!confirm(`⚠️ Remove "${name}" from Payment Agent? This will also remove all their payment numbers.`)) return;
    setDeletingAgentId(agentId);
    await Promise.all([
      supabase.from('user_roles').delete().eq('user_id', agentId).eq('role', 'payment_agent' as any),
      supabase.from('agent_wallets').delete().eq('user_id', agentId),
      supabase.from('agent_payment_numbers').delete().eq('agent_id', agentId),
    ]);
    toast.success(`${name} removed!`);
    setDeletingAgentId(null);
    fetchData();
    fetchAgentNumbers();
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="font-heading font-bold text-lg md:text-2xl">👤 Payment Agents</h1>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 rounded-lg bg-secondary"><RefreshCw size={16} /></button>
          <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground font-heading font-bold text-xs">
            <Upload size={14} /> Bulk Add
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs">
            <Plus size={14} /> Add Agent
          </button>
        </div>
      </div>

      {/* Commission Settings */}
      <div className="bg-card rounded-xl p-3 md:p-4 gold-border space-y-3">
        <h3 className="font-heading font-bold text-sm">💰 Commission Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs text-primary font-heading font-bold">Deposit Commission</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Per Amount (৳)</label>
                <input value={commPerAmount} onChange={e => setCommPerAmount(e.target.value)} type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Commission (৳)</label>
                <input value={commAmount} onChange={e => setCommAmount(e.target.value)} type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Per ৳{commPerAmount || '1000'} deposit = ৳{commAmount || '4'} commission</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-orange-400 font-heading font-bold">Withdraw Commission</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Per Amount (৳)</label>
                <input value={wCommPerAmount} onChange={e => setWCommPerAmount(e.target.value)} type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Commission (৳)</label>
                <input value={wCommAmount} onChange={e => setWCommAmount(e.target.value)} type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Per ৳{wCommPerAmount || '1000'} withdraw = ৳{wCommAmount || '4'} commission</p>
          </div>
        </div>
        <button onClick={saveCommission} disabled={savingComm}
          className="px-6 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs disabled:opacity-50">
          {savingComm ? '...' : 'Save All'}
        </button>
      </div>

      {/* Agents List */}
      <div className="bg-card rounded-xl p-3 md:p-4 gold-border space-y-3">
        <h3 className="font-heading font-bold text-sm">📋 Agent List ({agents.length})</h3>
        {loading && <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>}
        {!loading && agents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No payment agents yet</p>}
        <div className="space-y-2">
          {agents.map(a => (
            <div key={a.user_id} className="bg-secondary rounded-xl p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-heading font-bold text-sm">{a.username || 'Agent'}</p>
                  <p className="text-[10px] text-muted-foreground">📞 {a.phone} • ID: <span className="text-primary font-bold">{a.user_code}</span></p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => { setPasswordAgentId(passwordAgentId === a.user_id ? null : a.user_id); setNewPassword(''); }}
                    className="px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent-foreground font-heading font-bold text-xs flex items-center gap-1">
                    <Key size={12} /> Password
                  </button>
                  <button onClick={() => setLoadAgentId(loadAgentId === a.user_id ? null : a.user_id)}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-heading font-bold text-xs">
                    {loadAgentId === a.user_id ? 'Cancel' : '+ Load'}
                  </button>
                  <button onClick={() => removeAgent(a.user_id, a.username || 'Agent')} disabled={deletingAgentId === a.user_id}
                    className="px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive font-heading font-bold text-xs flex items-center gap-1 disabled:opacity-50">
                    <Trash2 size={12} /> {deletingAgentId === a.user_id ? '...' : 'Remove'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-center">
                <div className="bg-background/50 rounded-lg px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Balance</p>
                  <p className="font-heading font-bold text-xs text-primary">৳{a.balance.toLocaleString()}</p>
                </div>
                <div className="bg-background/50 rounded-lg px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Deposited</p>
                  <p className="font-heading font-bold text-xs">৳{a.total_deposited.toLocaleString()}</p>
                </div>
                <div className="bg-background/50 rounded-lg px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Commission</p>
                  <p className="font-heading font-bold text-xs text-success">৳{a.total_commission.toLocaleString()}</p>
                </div>
              </div>

              {/* Telegram Link - for Lucky Agent deposit */}
              <div className="pt-1">
                <p className="text-[10px] text-muted-foreground font-heading font-bold flex items-center gap-1 mb-1"><MessageCircle size={10} /> Telegram (Lucky Agent)</p>
                {editingTelegramId === a.user_id ? (
                  <div className="flex gap-1.5">
                    <input value={telegramInput} onChange={e => setTelegramInput(e.target.value)} placeholder="t.me/username or https://t.me/..."
                      className="flex-1 bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border" />
                    <button onClick={() => saveTelegramLink(a.user_id)} disabled={savingTelegram} className="px-2.5 py-1 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-[10px]">Save</button>
                    <button onClick={() => { setEditingTelegramId(null); setTelegramInput(''); }} className="px-2 py-1 text-muted-foreground text-[10px]">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-foreground truncate">{a.telegram_link || 'Not set'}</span>
                    <button onClick={() => { setEditingTelegramId(a.user_id); setTelegramInput(a.telegram_link || ''); }} className="text-[10px] text-primary font-heading font-bold">Edit</button>
                  </div>
                )}
              </div>

              {/* Load Balance Form */}
              {loadAgentId === a.user_id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex gap-2 pt-1">
                  <input value={loadAmount} onChange={e => setLoadAmount(e.target.value)} type="number" placeholder="Amount ৳"
                    className="flex-1 bg-background rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
                  <button onClick={loadBalance} disabled={loadingBalance}
                    className="px-4 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs disabled:opacity-50">
                    {loadingBalance ? '...' : 'Load ৳'}
                  </button>
                </motion.div>
               )}

              {/* Set Password Form */}
              {passwordAgentId === a.user_id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex gap-2 pt-1">
                  <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="text" placeholder="New password (min 6)"
                    className="flex-1 bg-background rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
                  <button onClick={setAgentPassword} disabled={settingPassword}
                    className="px-4 py-2 rounded-lg bg-accent text-accent-foreground font-heading font-bold text-xs disabled:opacity-50">
                    {settingPassword ? '...' : '🔑 Set'}
                  </button>
                </motion.div>
              )}

              {/* Agent Payment Numbers */}
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground font-heading font-bold flex items-center gap-1"><Phone size={10} /> Deposit / Withdraw Rotation</p>
                  <button onClick={() => { setShowNumberForm(showNumberForm === a.user_id ? null : a.user_id); setNumMethod(''); setNumNumber(''); setNumRotationHours('2'); setNumSortOrder('0'); }}
                    className="text-[10px] text-primary font-heading font-bold flex items-center gap-0.5">
                    <PlusCircle size={10} /> Add
                  </button>
                </div>
                {agentNumbers.filter(n => n.agent_id === a.user_id).map(n => (
                  <div key={n.id} className="bg-background/50 rounded-lg px-2.5 py-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-primary font-heading font-bold">{n.payment_method}</span>
                        <span className="text-xs text-foreground font-heading font-bold ml-2">{n.number}</span>
                      </div>
                      <button onClick={() => deleteAgentNumber(n.id)} className="p-0.5 text-destructive hover:bg-destructive/10 rounded">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={n.rotation_hours}
                        onChange={e => setAgentNumberField(n.id, 'rotation_hours', Number(e.target.value))}
                        type="number"
                        min={1}
                        className="bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border"
                        placeholder="Rotation hours"
                      />
                      <input
                        value={n.sort_order}
                        onChange={e => setAgentNumberField(n.id, 'sort_order', Number(e.target.value))}
                        type="number"
                        min={0}
                        className="bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border"
                        placeholder="Order"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-heading font-bold">
                        <input
                          type="checkbox"
                          checked={n.is_active}
                          onChange={e => setAgentNumberField(n.id, 'is_active', e.target.checked)}
                        />
                        Active in rotation
                      </label>
                      <button
                        onClick={() => saveAgentNumber(n)}
                        disabled={savingNumber}
                        className="px-2.5 py-1 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-[10px] disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
                {agentNumbers.filter(n => n.agent_id === a.user_id).length === 0 && (
                  <p className="text-[9px] text-muted-foreground italic">No numbers assigned</p>
                )}
                {showNumberForm === a.user_id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="grid grid-cols-2 gap-1.5 pt-1">
                    <select value={numMethod} onChange={e => setNumMethod(e.target.value)}
                      className="bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border flex-1">
                      <option value="">Method</option>
                      <option value="bKash">bKash</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Rocket">Rocket</option>
                      <option value="UPay">UPay</option>
                      <option value="TAP">TAP</option>
                      <option value="OKWallet">OKWallet</option>
                    </select>
                    <input value={numNumber} onChange={e => setNumNumber(e.target.value)} type="tel" placeholder="01XXXXXXXXX" maxLength={11}
                      className="bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border flex-1" />
                    <input value={numRotationHours} onChange={e => setNumRotationHours(e.target.value)} type="number" min={1} placeholder="Hours active"
                      className="bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border flex-1" />
                    <div className="flex gap-1.5">
                      <input value={numSortOrder} onChange={e => setNumSortOrder(e.target.value)} type="number" min={0} placeholder="Order"
                        className="bg-background rounded-lg px-2 py-1.5 text-foreground font-heading text-xs outline-none gold-border flex-1" />
                    <button onClick={() => addAgentNumber(a.user_id)} disabled={savingNumber}
                      className="px-3 py-1.5 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-[10px] disabled:opacity-50">
                      {savingNumber ? '...' : '✓'}
                    </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Add Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowBulkModal(false); setBulkInput(''); setBulkResult(null); }} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <div className="px-5 pb-6 space-y-4 overflow-y-auto flex-1">
                <h2 className="font-heading font-bold text-base">📤 Bulk Add Payment Agents (max {MAX_BULK})</h2>
                <p className="text-xs text-muted-foreground">Paste phone numbers (01XXXXXXXXX) one per line, or comma/tab separated. Or upload CSV.</p>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground font-heading text-xs cursor-pointer">
                    <Upload size={14} /> Upload CSV
                    <input type="file" accept=".csv,.txt" onChange={handleBulkFileUpload} className="hidden" />
                  </label>
                </div>
                <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder="01712345678&#10;01812345678&#10;01912345678"
                  rows={6} className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm resize-none" />
                {bulkResult && (
                  <div className="rounded-xl bg-secondary p-3 space-y-1 text-sm">
                    <p className="font-heading font-bold text-primary">✅ Added: {bulkResult.added}</p>
                    <p className="text-muted-foreground">Skipped/Failed: {bulkResult.skipped}</p>
                    {bulkResult.failed.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">View details</summary>
                        <ul className="mt-1 text-xs text-muted-foreground max-h-24 overflow-y-auto space-y-0.5">
                          {bulkResult.failed.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                <button onClick={bulkAddAgents} disabled={bulkAdding || parsePhoneList(bulkInput).length === 0}
                  className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50">
                  {bulkAdding ? 'Adding...' : `Add ${parsePhoneList(bulkInput).length || 0} Agents`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Agent Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <div className="px-5 pb-6 space-y-4">
                <h2 className="font-heading font-bold text-base">➕ Add Payment Agent</h2>
                <p className="text-xs text-muted-foreground">Phone + password – agent logs in at /agent-login with these. No sign-up needed.</p>
                <div>
                  <label className="text-xs text-muted-foreground">👤 Agent Name (optional)</label>
                  <input value={addAgentNameInput} onChange={e => setAddAgentNameInput(e.target.value)} type="text" placeholder="e.g. Karim Mia"
                    className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary mt-1" />
                </div>
                <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} type="tel" placeholder="01XXXXXXXXX" maxLength={14}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-center text-lg" />
                <div>
                   <label className="text-xs text-muted-foreground">🔑 Login Password (min 6 chars) – required for new agents</label>
                  <input value={addPasswordInput} onChange={e => setAddPasswordInput(e.target.value)} type="text" placeholder="Agent will use this to login"
                    className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-center text-lg mt-1" />
                </div>
                <button onClick={addAgent} disabled={adding}
                  className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50">
                  {adding ? 'Adding...' : '✅ Make Payment Agent'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAgents;
