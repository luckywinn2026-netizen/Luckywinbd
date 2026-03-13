import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, ToggleLeft, ToggleRight, Trophy, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

type FakeWin = {
  id: string;
  username: string;
  win_amount: number;
  game_name: string;
  is_active: boolean;
  show_on_ticker: boolean;
  show_on_leaderboard: boolean;
  created_at: string;
};

const GAME_OPTIONS = [
  'Aviator', 'Rocket Crash', 'Jet Crash', 'Lucky Boxing King', 'Super Ace',
  'Book of Dead', 'Golden Book', 'Fortune Wheel', 'Lucky 777', 'Money Coming',
  'Tropical Fruits', 'Fruit Party', 'Starburst', 'Mega Moolah', 'Fortune Gems',
  'Classic 777', 'Cricket Bet', 'Football Bet', 'Chicken Road',
];

const AdminFakeWins = () => {
  const [entries, setEntries] = useState<FakeWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [winAmount, setWinAmount] = useState('');
  const [gameName, setGameName] = useState('Aviator');
  const [showTicker, setShowTicker] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from('fake_wins')
      .select('*')
      .order('win_amount', { ascending: false });
    setEntries((data as FakeWin[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    if (!username.trim() || !winAmount) {
      toast.error('Enter name and win amount');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('fake_wins').insert({
      username: username.trim(),
      win_amount: Number(winAmount),
      game_name: gameName,
      show_on_ticker: showTicker,
      show_on_leaderboard: showLeaderboard,
    });
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Fake win added ✅');
      setUsername('');
      setWinAmount('');
      fetch();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('fake_wins').update({ is_active: !current }).eq('id', id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_active: !current } : e));
  };

  const handleDelete = async (id: string) => {
    await supabase.from('fake_wins').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Deleted');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Trophy size={22} className="text-primary" />
        <h1 className="font-heading font-bold text-lg md:text-xl gold-text">Fake Mega Wins</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Add fake mega win entries here. They will show on the leaderboard and live ticker — users will think someone won big.
      </p>

      {/* Add Form */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-3">
        <h2 className="font-heading font-bold text-sm">➕ Add New Fake Win</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground font-heading">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. RakibX"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-heading">Win Amount (৳)</label>
            <input
              type="number"
              value={winAmount}
              onChange={e => setWinAmount(e.target.value)}
              placeholder="e.g. 150000"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-heading">Game Name</label>
            <select
              value={gameName}
              onChange={e => setGameName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
            >
              {GAME_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showTicker} onChange={e => setShowTicker(e.target.checked)} className="rounded" />
              Live Ticker
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showLeaderboard} onChange={e => setShowLeaderboard(e.target.checked)} className="rounded" />
              Leaderboard
            </label>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Add
        </button>
      </div>

      {/* Entries List */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground font-heading">No fake wins yet</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center justify-between gap-3 bg-card rounded-xl p-3 gold-border ${!entry.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-bold text-sm">{entry.username}</span>
                  <span className="text-xs text-success font-heading font-bold">৳{Number(entry.win_amount).toLocaleString()}</span>
                  <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">{entry.game_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  {entry.show_on_ticker && <span className="bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">Ticker</span>}
                  {entry.show_on_leaderboard && <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded">Leaderboard</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleActive(entry.id, entry.is_active)} className="p-1.5 rounded-lg hover:bg-secondary">
                  {entry.is_active ? <ToggleRight size={20} className="text-success" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
                </button>
                <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFakeWins;
