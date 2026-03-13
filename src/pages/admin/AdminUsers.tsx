import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { Search, Eye, Save, Download, Key } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  phone: string | null;
  user_code: string | null;
  avatar_url: string | null;
  created_at: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<(Profile & { balance: number; last_play: string | null })[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<(Profile & { balance: number; last_play: string | null }) | null>(null);
  const [userDeposits, setUserDeposits] = useState<any[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<any[]>([]);
  const [userGames, setUserGames] = useState<any[]>([]);
  const [editBalance, setEditBalance] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!profiles) return;

    const { data: wallets } = await supabase.from('wallets').select('user_id, balance');
    const walletMap = new Map((wallets || []).map(w => [w.user_id, Number(w.balance)]));

    // Fetch last play time per user from game_sessions
    const userIds = profiles.map(p => p.user_id);
    const { data: lastPlays } = await supabase
      .from('game_sessions')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    // Build map of user_id -> latest created_at
    const lastPlayMap = new Map<string, string>();
    (lastPlays || []).forEach(lp => {
      if (!lastPlayMap.has(lp.user_id)) {
        lastPlayMap.set(lp.user_id, lp.created_at);
      }
    });

    setUsers(profiles.map(p => ({
      ...p,
      balance: walletMap.get(p.user_id) || 0,
      last_play: lastPlayMap.get(p.user_id) || null,
    })));
  };

  const downloadExcel = () => {
    setDownloading(true);
    try {
      const headers = ['Username', 'User Code', 'User ID', 'Phone', 'Balance', 'Last Play', 'Join Date'];
      const rows = users.map(u => [
        u.username || 'N/A',
        u.user_code || 'N/A',
        u.user_id,
        u.phone || 'N/A',
        u.balance.toString(),
        u.last_play ? new Date(u.last_play).toLocaleString() : 'Never',
        new Date(u.created_at).toLocaleDateString(),
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${users.length} users exported!`);
    } catch {
      toast.error('Export failed');
    }
    setDownloading(false);
  };

// ... keep existing code (viewUserDetail, updateBalance, filtered, selectedUser detail view)

  const setUserPassword = async () => {
    if (!selectedUser || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSettingPassword(true);
    try {
      await api.adminSetPassword({ user_id: selectedUser.user_id, password: newPassword });
      toast.success('✅ Password updated!');
      setShowPasswordForm(false);
      setNewPassword('');
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Failed to set password');
    }
    setSettingPassword(false);
  };

  const viewUserDetail = async (user: Profile & { balance: number; last_play: string | null }) => {
    setSelectedUser(user);
    setEditBalance(String(user.balance));
    setShowPasswordForm(false);
    setNewPassword('');
    const [deps, withs, games] = await Promise.all([
      supabase.from('deposits').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false }),
      supabase.from('withdrawals').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false }),
      supabase.from('game_sessions').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false }).limit(20),
    ]);
    setUserDeposits(deps.data || []);
    setUserWithdrawals(withs.data || []);
    setUserGames(games.data || []);
  };

  const updateBalance = async () => {
    if (!selectedUser) return;
    const newBal = Number(editBalance);
    if (isNaN(newBal) || newBal < 0) { toast.error('Invalid balance'); return; }
    const { error } = await supabase.from('wallets').update({ balance: newBal }).eq('user_id', selectedUser.user_id);
    if (error) { toast.error('Failed to update balance'); return; }
    toast.success(`Balance updated to ৳${newBal.toLocaleString()}`);
    setSelectedUser({ ...selectedUser, balance: newBal });
    setEditingBalance(false);
    fetchUsers();
  };

  const filtered = users.filter(u =>
    (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || '').includes(search) ||
    (u.user_code || '').toLowerCase().includes(search.toLowerCase())
  );

  if (selectedUser) {
    const totalDeposit = userDeposits.filter(d => d.status === 'approved').reduce((s, d) => s + Number(d.amount), 0);
    const totalWithdraw = userWithdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + Number(w.amount), 0);
    const totalBet = userGames.reduce((s, g) => s + Number(g.bet_amount), 0);
    const totalWin = userGames.reduce((s, g) => s + Number(g.win_amount), 0);

    return (
      <div className="p-3 md:p-6 space-y-4">
        <button onClick={() => setSelectedUser(null)} className="text-sm text-primary font-heading min-h-[44px] flex items-center">← Back to Users</button>
        <div className="bg-card rounded-xl p-4 gold-border">
          <h2 className="font-heading font-bold text-lg mb-1">{selectedUser.username || 'No Name'}</h2>
          <p className="text-sm text-muted-foreground">Phone: {selectedUser.phone || 'N/A'}</p>
          <p className="text-xs text-muted-foreground">ID: {selectedUser.user_id}</p>
          <p className="text-xs text-muted-foreground">Code: {selectedUser.user_code || 'N/A'}</p>
          <p className="text-xs text-muted-foreground">Joined: {new Date(selectedUser.created_at).toLocaleDateString()}</p>
          <p className="text-xs text-muted-foreground">Last Play: {selectedUser.last_play ? new Date(selectedUser.last_play).toLocaleString() : 'Never'}</p>
        </div>

        {/* Change Password */}
        <div className="bg-card rounded-xl p-4 gold-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading font-bold flex items-center gap-1.5"><Key size={16} /> Change Password</h3>
            {!showPasswordForm ? (
              <button onClick={() => setShowPasswordForm(true)} className="text-xs text-primary font-heading">Set Password</button>
            ) : (
              <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); }} className="text-xs text-muted-foreground">Cancel</button>
            )}
          </div>
          {showPasswordForm ? (
            <div className="flex gap-2">
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="text" placeholder="New password (min 6 chars)"
                className="flex-1 bg-secondary rounded-lg px-3 py-2 text-foreground font-heading text-sm outline-none gold-border" />
              <button onClick={setUserPassword} disabled={settingPassword}
                className="px-4 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs disabled:opacity-50">
                {settingPassword ? '...' : '🔑 Set'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">User can login with phone + this password</p>
          )}
        </div>

        {/* Balance Card with Edit */}
        <div className="bg-card rounded-xl p-4 gold-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading font-bold">💰 Account Balance</h3>
            {!editingBalance ? (
              <button onClick={() => setEditingBalance(true)} className="text-xs text-primary font-heading">Edit</button>
            ) : (
              <div className="flex gap-1">
                <button onClick={updateBalance} className="p-1 text-green-400"><Save size={14} /></button>
                <button onClick={() => setEditingBalance(false)} className="p-1 text-muted-foreground text-xs">✕</button>
              </div>
            )}
          </div>
          {editingBalance ? (
            <input value={editBalance} onChange={e => setEditBalance(e.target.value)} type="number"
              className="w-full bg-secondary rounded-lg px-3 py-2 text-foreground font-heading font-bold text-xl outline-none gold-border" />
          ) : (
            <p className="font-heading font-bold text-2xl text-primary">৳{selectedUser.balance.toLocaleString()}</p>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl p-3 gold-border">
            <p className="text-xs text-muted-foreground">Total Deposits</p>
            <p className="font-heading font-bold text-green-400">৳{totalDeposit.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl p-3 gold-border">
            <p className="text-xs text-muted-foreground">Total Withdrawals</p>
            <p className="font-heading font-bold text-red-400">৳{totalWithdraw.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl p-3 gold-border">
            <p className="text-xs text-muted-foreground">Total Bets</p>
            <p className="font-heading font-bold text-cyan-400">৳{totalBet.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl p-3 gold-border">
            <p className="text-xs text-muted-foreground">Total Wins</p>
            <p className="font-heading font-bold text-emerald-400">৳{totalWin.toLocaleString()}</p>
          </div>
        </div>

        {/* Pending Deposits for this user */}
        {userDeposits.filter(d => d.status === 'pending').length > 0 && (
          <div className="bg-card rounded-xl p-4 gold-border">
            <h3 className="font-heading font-bold mb-2 text-yellow-400">⏳ Pending Deposits</h3>
            {userDeposits.filter(d => d.status === 'pending').map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-heading">{d.method} — ৳{Number(d.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">TrxID: {d.trx_id || 'N/A'} • Phone: {d.phone || 'N/A'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={async () => {
                    await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
                    toast.success('Deposit approved');
                    viewUserDetail(selectedUser);
                  }} className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded font-heading font-bold">Approve</button>
                  <button onClick={async () => {
                    await supabase.from('deposits').update({ status: 'rejected' }).eq('id', d.id);
                    toast.success('Deposit rejected');
                    viewUserDetail(selectedUser);
                  }} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded font-heading font-bold">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending Withdrawals for this user */}
        {userWithdrawals.filter(w => w.status === 'pending').length > 0 && (
          <div className="bg-card rounded-xl p-4 gold-border">
            <h3 className="font-heading font-bold mb-2 text-orange-400">⏳ Pending Withdrawals</h3>
            {userWithdrawals.filter(w => w.status === 'pending').map(w => (
              <div key={w.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-heading">{w.method} — ৳{Number(w.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">To: {w.phone || 'N/A'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={async () => {
                    await supabase.from('withdrawals').update({ status: 'approved' }).eq('id', w.id);
                    toast.success('Withdrawal approved');
                    viewUserDetail(selectedUser);
                  }} className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded font-heading font-bold">Approve</button>
                  <button onClick={async () => {
                    await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', w.id);
                    toast.success('Withdrawal rejected');
                    viewUserDetail(selectedUser);
                  }} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded font-heading font-bold">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-card rounded-xl p-4 gold-border">
          <h3 className="font-heading font-bold mb-2">Game History (Last 20)</h3>
          {userGames.length === 0 ? (
            <p className="text-muted-foreground text-sm">No games played</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-muted-foreground text-xs">
                  <th className="text-left py-2">Game</th><th className="text-left">Bet</th><th className="text-left">Win</th><th className="text-left">Result</th><th className="text-left">Date</th>
                </tr></thead>
                <tbody>
                  {userGames.map(g => (
                    <tr key={g.id} className="border-t border-border">
                      <td className="py-2 font-heading">{g.game_name || g.game_type}</td>
                      <td>৳{Number(g.bet_amount).toLocaleString()}</td>
                      <td className="text-green-400">৳{Number(g.win_amount).toLocaleString()}</td>
                      <td><span className={`text-xs px-2 py-0.5 rounded ${g.result === 'win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{g.result}</span></td>
                      <td className="text-muted-foreground text-xs">{new Date(g.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <h1 className="font-heading font-bold text-lg md:text-2xl">👥 User Management</h1>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">{users.length} users</span>
        <button
          onClick={downloadExcel}
          disabled={downloading || users.length === 0}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs active:scale-95 transition-transform disabled:opacity-50"
        >
          <Download size={14} />
          Download Excel
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by username, phone, or user code..."
          className="w-full bg-card rounded-lg pl-9 pr-3 py-2.5 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3">
        {filtered.map(u => (
          <div key={u.id} className="bg-card rounded-xl gold-border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold text-sm">{u.username || 'N/A'}</p>
                <p className="text-xs text-primary">{u.user_code || '—'}</p>
              </div>
              <p className="font-heading font-bold text-primary text-sm">৳{u.balance.toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground">📞 {u.phone || 'N/A'}</p>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Last: {u.last_play ? new Date(u.last_play).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
              <span>Joined: {new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            <button onClick={() => viewUserDetail(u)} className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary font-heading font-bold text-sm">
              <Eye size={16} /> View Details
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No users found</p>}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-card rounded-xl gold-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-muted-foreground text-xs border-b border-border">
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">User ID</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Balance</th>
              <th className="text-left p-3">Last Play</th>
              <th className="text-left p-3">Joined</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-secondary/50 transition-colors">
                <td className="p-3">
                  <p className="font-heading font-bold">{u.username || 'N/A'}</p>
                  <p className="text-[10px] text-primary">{u.user_code || '—'}</p>
                </td>
                <td className="p-3 text-[10px] text-muted-foreground font-mono max-w-[120px] truncate" title={u.user_id}>{u.user_id.slice(0, 8)}...</td>
                <td className="p-3 text-muted-foreground">{u.phone || 'N/A'}</td>
                <td className="p-3 font-heading font-bold text-primary">৳{u.balance.toLocaleString()}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {u.last_play ? (
                    <>
                      {new Date(u.last_play).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      {' '}
                      {new Date(u.last_play).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  ) : (
                    <span className="text-muted-foreground/50">Never</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <button onClick={() => viewUserDetail(u)} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No users found</p>}
      </div>
    </div>
  );
};

export default AdminUsers;
