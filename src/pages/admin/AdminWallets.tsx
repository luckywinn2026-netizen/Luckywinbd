import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Save } from 'lucide-react';
import { toast } from 'sonner';

const AdminWallets = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!profiles) return;
    const { data: wallets } = await supabase.from('wallets').select('user_id, balance');
    const walletMap = new Map((wallets || []).map(w => [w.user_id, Number(w.balance)]));
    setUsers(profiles.map(p => ({ ...p, balance: walletMap.get(p.user_id) || 0 })));
  };

  const updateBalance = async (userId: string) => {
    const newBal = Number(editBalance);
    if (isNaN(newBal) || newBal < 0) { toast.error('Invalid balance'); return; }
    const { error } = await supabase.from('wallets').update({ balance: newBal }).eq('user_id', userId);
    if (error) { toast.error('Failed'); return; }
    toast.success('Balance updated');
    setEditingId(null);
    fetchUsers();
  };

  const filtered = users.filter(u =>
    (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || '').includes(search)
  );

  return (
    <div className="p-3 md:p-6 space-y-4">
      <h1 className="font-heading font-bold text-lg md:text-2xl">💳 Wallet Control</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search user..."
          className="w-full bg-card rounded-lg pl-9 pr-3 py-2.5 min-h-[44px] text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3">
        {filtered.map(u => (
          <div key={u.user_id} className="bg-card rounded-xl gold-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold">{u.username || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">{u.phone || 'N/A'}</p>
              </div>
              <div className="text-right">
                {editingId === u.user_id ? (
                  <input value={editBalance} onChange={e => setEditBalance(e.target.value)} type="number"
                    className="bg-secondary rounded px-2 py-1.5 min-h-[40px] w-24 text-foreground font-heading font-bold outline-none gold-border text-right" />
                ) : (
                  <span className="font-heading font-bold text-primary">৳{u.balance.toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {editingId === u.user_id ? (
                <>
                  <button onClick={() => updateBalance(u.user_id)} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-sm font-heading font-bold">
                    <Save size={14} /> Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="min-h-[44px] px-4 py-2.5 bg-secondary text-muted-foreground rounded-xl text-sm">Cancel</button>
                </>
              ) : (
                <button onClick={() => { setEditingId(u.user_id); setEditBalance(String(u.balance)); }}
                  className="min-h-[44px] px-4 py-2.5 bg-primary/20 text-primary rounded-xl text-sm font-heading font-bold">Edit</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No users found</p>}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-card rounded-xl gold-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs border-b border-border">
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Balance</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.user_id} className="border-t border-border hover:bg-secondary/50">
                <td className="p-3 font-heading font-bold">{u.username || 'N/A'}</td>
                <td className="p-3 text-muted-foreground">{u.phone || 'N/A'}</td>
                <td className="p-3">
                  {editingId === u.user_id ? (
                    <input value={editBalance} onChange={e => setEditBalance(e.target.value)} type="number"
                      className="bg-secondary rounded px-2 py-1 text-foreground font-heading font-bold outline-none gold-border w-28" />
                  ) : (
                    <span className="font-heading font-bold text-primary">৳{u.balance.toLocaleString()}</span>
                  )}
                </td>
                <td className="p-3">
                  {editingId === u.user_id ? (
                    <div className="flex gap-1">
                      <button onClick={() => updateBalance(u.user_id)} className="p-2 min-w-[36px] text-green-400 hover:bg-green-500/20 rounded"><Save size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-2 min-w-[36px] text-muted-foreground hover:bg-secondary rounded text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(u.user_id); setEditBalance(String(u.balance)); }}
                      className="min-h-[36px] px-3 py-1.5 text-xs text-primary font-heading hover:underline rounded">Edit</button>
                  )}
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

export default AdminWallets;
