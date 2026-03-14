import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { ShieldPlus, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const ALL_MODULES = [
  { key: '/admin/dashboard', label: 'Dashboard' },
  { key: '/admin/users', label: 'Users' },
  { key: '/admin/referrals', label: 'Referrals' },
  { key: '/admin/deposits', label: 'Deposits' },
  { key: '/admin/withdrawals', label: 'Withdrawals' },
  { key: '/admin/wallets', label: 'Wallets' },
  { key: '/admin/games', label: 'Games' },
  { key: '/admin/game-assets', label: 'Game Assets' },
  { key: '/admin/crash-control', label: 'Crash Control' },
  { key: '/admin/multiplier', label: '4th Reel Control' },
  { key: '/admin/profit-settings', label: 'Profit Control' },
  { key: '/admin/chat-management', label: 'Chat Mgmt' },
  { key: '/admin/live-monitor', label: 'Live Monitor' },
  { key: '/admin/analytics', label: 'Analytics' },
  { key: '/admin/settings', label: 'Settings' },
];

interface SubAdmin {
  user_id: string;
  username: string;
  phone: string;
  created_at: string;
  modules: string[];
}

const AdminSubAdmins = () => {
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [savingModules, setSavingModules] = useState<string | null>(null);

  const fetchSubAdmins = useCallback(async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, created_at').eq('role', 'moderator');
    if (!roles || roles.length === 0) { setSubAdmins([]); setLoading(false); return; }
    const ids = roles.map(r => r.user_id);
    const [{ data: profiles }, { data: perms }] = await Promise.all([
      supabase.from('profiles').select('user_id, username, phone').in('user_id', ids),
      supabase.from('sub_admin_permissions').select('user_id, module').in('user_id', ids),
    ]);
    const pMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
    const permMap: Record<string, string[]> = {};
    (perms || []).forEach(p => {
      if (!permMap[p.user_id]) permMap[p.user_id] = [];
      permMap[p.user_id].push(p.module);
    });
    setSubAdmins(roles.map(r => ({
      user_id: r.user_id,
      username: pMap[r.user_id]?.username || 'User',
      phone: pMap[r.user_id]?.phone || '-',
      created_at: r.created_at,
      modules: permMap[r.user_id] || [],
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubAdmins(); }, [fetchSubAdmins]);

  const addSubAdmin = async () => {
    const p = phone.trim();
    const pw = password.trim();
    if (!p || !pw) {
      toast.error('Phone number and password required');
      return;
    }
    if (pw.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setCreating(true);
    try {
      await api.adminCreateSubAdmin({ phone: p, password: pw });
      toast.success('Sub-admin created! Login at admin panel with this phone and password.');
      setPhone('');
      setPassword('');
      fetchSubAdmins();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create sub-admin');
    } finally {
      setCreating(false);
    }
  };

  const removeSubAdmin = async (userId: string) => {
    await Promise.all([
      supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'moderator'),
      supabase.from('sub_admin_permissions').delete().eq('user_id', userId),
    ]);
    toast.success('Sub-admin removed');
    fetchSubAdmins();
  };

  const toggleModule = async (userId: string, module: string, currentModules: string[]) => {
    setSavingModules(userId);
    const has = currentModules.includes(module);
    if (has) {
      await supabase.from('sub_admin_permissions').delete().eq('user_id', userId).eq('module', module);
    } else {
      await supabase.from('sub_admin_permissions').insert({ user_id: userId, module });
    }
    // Update local state immediately
    setSubAdmins(prev => prev.map(sa =>
      sa.user_id === userId
        ? { ...sa, modules: has ? sa.modules.filter(m => m !== module) : [...sa.modules, module] }
        : sa
    ));
    setSavingModules(null);
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground font-heading">Loading...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="font-heading font-bold text-xl">🛡️ Sub-Admin Management</h1>
      <p className="text-xs text-muted-foreground font-body">
        Select module access for each sub-admin individually
      </p>

      <div className="bg-card rounded-xl gold-border p-4 space-y-3">
        <p className="text-xs text-muted-foreground font-body">Create sub-admin with phone number and password. They can log in at admin panel with the same credentials.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone (01XXXXXXXXX)"
            className="flex-1 bg-secondary gold-border rounded-lg px-3 py-2 text-sm font-body outline-none" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="flex-1 bg-secondary gold-border rounded-lg px-3 py-2 text-sm font-body outline-none" />
          <button onClick={addSubAdmin} disabled={creating} className="px-4 py-2 rounded-lg gold-gradient font-heading font-bold text-sm text-primary-foreground disabled:opacity-50 flex items-center gap-2 shrink-0">
            <Plus size={16} />
            {creating ? 'Creating...' : 'Create Sub-Admin'}
          </button>
        </div>
      </div>

      {subAdmins.map(sa => (
        <div key={sa.user_id} className="bg-card rounded-xl gold-border overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <ShieldPlus size={20} className="text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-sm">{sa.username}</p>
              <p className="text-[10px] text-muted-foreground">
                {sa.phone} • {sa.modules.length} modules • Added {new Date(sa.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <button onClick={() => setExpandedUser(expandedUser === sa.user_id ? null : sa.user_id)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors">
              {expandedUser === sa.user_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button onClick={() => removeSubAdmin(sa.user_id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
              <Trash2 size={16} />
            </button>
          </div>

          {expandedUser === sa.user_id && (
            <div className="px-4 pb-4 border-t border-border pt-3">
              <p className="text-xs font-heading font-bold mb-2 text-muted-foreground">Access Modules:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_MODULES.map(mod => (
                  <label key={mod.key} className="flex items-center gap-2 text-xs font-body cursor-pointer hover:bg-secondary/50 rounded-lg px-2 py-1.5 transition-colors">
                    <Checkbox
                      checked={sa.modules.includes(mod.key)}
                      onCheckedChange={() => toggleModule(sa.user_id, mod.key, sa.modules)}
                      disabled={savingModules === sa.user_id}
                    />
                    {mod.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {subAdmins.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldPlus size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-heading font-bold">No Sub-admins yet</p>
          <p className="text-xs mt-1">Add one using the phone number field above</p>
        </div>
      )}
    </div>
  );
};

export default AdminSubAdmins;
