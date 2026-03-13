import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Percent, Shield, TrendingUp, Clock, Layers, Trophy } from 'lucide-react';

interface GameProfitSetting {
  id: string;
  game_id: string;
  game_name: string;
  profit_margin: number;
  min_profit_margin: number;
  max_win_multiplier: number;
  loss_rate: number;
  is_active: boolean;
  updated_at: string;
  small_win_pool_pct: number;
  medium_win_pool_pct: number;
  big_win_pool_pct: number;
  jackpot_pool_pct: number;
  max_win_cap: number;
  jackpot_cooldown_hours: number;
  big_win_cooldown_hours: number;
  small_win_pct: number;
  medium_win_pct: number;
  big_win_pct: number;
  jackpot_win_pct: number;
}

interface PoolBalance {
  game_id: string;
  pool_type: string;
  balance: number;
  total_contributed: number;
  total_paid_out: number;
}

const AdminProfitSettings = () => {
  const [settings, setSettings] = useState<GameProfitSetting[]>([]);
  const [editing, setEditing] = useState<Record<string, Partial<GameProfitSetting>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [pools, setPools] = useState<PoolBalance[]>([]);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('game_profit_settings' as any)
      .select('*')
      .order('game_name');
    if (data) setSettings(data as any);
  }, []);

  const fetchPools = useCallback(async () => {
    const { data } = await supabase.from('reward_pools' as any).select('*');
    if (data) setPools(data as any);
  }, []);

  useEffect(() => { fetchSettings(); fetchPools(); }, [fetchSettings, fetchPools]);

  const handleChange = (id: string, field: string, value: number | boolean) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const getValue = (setting: GameProfitSetting, field: keyof GameProfitSetting) => {
    const editVal = editing[setting.id]?.[field];
    return editVal !== undefined ? editVal : setting[field];
  };

  const saveSettings = async (setting: GameProfitSetting) => {
    const changes = editing[setting.id];
    if (!changes) return;
    setSaving(setting.id);
    const { error } = await supabase
      .from('game_profit_settings' as any)
      .update(changes as any)
      .eq('id', setting.id);
    if (error) {
      toast.error(`Failed to update ${setting.game_name}`);
    } else {
      toast.success(`✅ ${setting.game_name} updated!`);
      setEditing(prev => { const next = { ...prev }; delete next[setting.id]; return next; });
      fetchSettings();
    }
    setSaving(null);
  };

  const saveAll = async () => {
    const ids = Object.keys(editing);
    if (ids.length === 0) { toast.info('No changes'); return; }
    for (const id of ids) {
      const s = settings.find(x => x.id === id);
      if (s) await saveSettings(s);
    }
  };

  const poolLabels: Record<string, { label: string; color: string; icon: string }> = {
    small_win: { label: 'Small Win Pool', color: 'text-green-400', icon: '🟢' },
    medium_win: { label: 'Medium Win Pool', color: 'text-blue-400', icon: '🔵' },
    big_win: { label: 'Big Win Pool', color: 'text-orange-400', icon: '🟠' },
    jackpot: { label: 'Jackpot Pool', color: 'text-yellow-400', icon: '🏆' },
  };

  const poolGroups = settings.map(setting => ({
    gameId: setting.game_id,
    gameName: setting.game_name,
    pools: pools.filter(pool => pool.game_id === setting.game_id),
  })).filter(group => group.pools.length > 0);

  return (
    <div className="p-3 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-lg md:text-2xl flex items-center gap-2">
          <Shield size={22} className="text-primary" />
          Profit & Pool Control System
        </h1>
        {Object.keys(editing).length > 0 && (
          <button onClick={saveAll} className="flex items-center gap-1.5 px-4 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-sm">
            <Save size={14} /> Save All
          </button>
        )}
      </div>

      {/* Per-Game Pool Balances */}
      <div className="bg-card rounded-xl p-4 gold-border">
        <h2 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
          <Layers size={16} className="text-primary" /> Per-Game Reward Pools
        </h2>
        <div className="space-y-4">
          {poolGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No per-game reward pools found.</p>
          ) : poolGroups.map(group => (
            <div key={group.gameId} className="bg-secondary rounded-xl p-3">
              <div className="mb-3">
                <p className="font-heading font-bold text-sm">{group.gameName}</p>
                <p className="text-[10px] text-muted-foreground">{group.gameId}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {group.pools.map(pool => {
                  const meta = poolLabels[pool.pool_type] || { label: pool.pool_type, color: 'text-foreground', icon: '⚪' };
                  return (
                    <div key={`${group.gameId}-${pool.pool_type}`} className="bg-card rounded-lg p-3 text-center">
                      <p className="text-lg mb-1">{meta.icon}</p>
                      <p className={`font-heading font-bold text-sm ${meta.color}`}>৳{Number(pool.balance).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        <span>In: ৳{Number(pool.total_contributed).toLocaleString()}</span>
                        <span>Out: ৳{Number(pool.total_paid_out).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Game Settings */}
      <div className="bg-card rounded-xl p-3 gold-border space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          🔒 Click any game to expand pool/probability/cooldown controls. Owner never loses.
        </p>

        {settings.map(setting => {
          const hasChanges = !!editing[setting.id];
          const isExpanded = expandedGame === setting.id;

          return (
            <div key={setting.id} className={`bg-secondary rounded-lg overflow-hidden ${hasChanges ? 'ring-1 ring-primary/50' : ''}`}>
              {/* Compact Row */}
              <div
                className="grid grid-cols-[1fr_auto_auto_auto_auto] md:grid-cols-[3fr_2fr_2fr_2fr_1fr_auto] gap-2 items-center p-3 cursor-pointer"
                onClick={() => setExpandedGame(isExpanded ? null : setting.id)}
              >
                <div>
                  <p className="font-heading font-bold text-sm">{setting.game_name}</p>
                  <p className="text-[10px] text-muted-foreground">{setting.game_id}</p>
                </div>

                {/* Profit Margin */}
                <div className="text-center" onClick={e => e.stopPropagation()}>
                  <label className="text-[10px] text-muted-foreground block">Margin%</label>
                  <div className="flex items-center gap-0.5">
                    <input type="number" min={15} max={40} step={1}
                      value={getValue(setting, 'profit_margin') as number}
                      onChange={e => handleChange(setting.id, 'profit_margin', Number(e.target.value))}
                      className="w-14 bg-card rounded px-1.5 py-1 text-xs text-foreground outline-none gold-border text-center font-heading font-bold" />
                    <Percent size={10} className="text-muted-foreground" />
                  </div>
                </div>

                {/* Loss Rate */}
                <div className="text-center" onClick={e => e.stopPropagation()}>
                  <label className="text-[10px] text-muted-foreground block">Loss%</label>
                  <div className="flex items-center gap-0.5">
                    <input type="number" min={40} max={90} step={1}
                      value={getValue(setting, 'loss_rate') as number}
                      onChange={e => handleChange(setting.id, 'loss_rate', Number(e.target.value))}
                      className="w-14 bg-card rounded px-1.5 py-1 text-xs text-foreground outline-none gold-border text-center font-heading font-bold" />
                    <Percent size={10} className="text-muted-foreground" />
                  </div>
                </div>

                {/* Max Cap */}
                <div className="text-center" onClick={e => e.stopPropagation()}>
                  <label className="text-[10px] text-muted-foreground block">MaxCap</label>
                  <input type="number" min={50} max={500} step={10}
                    value={getValue(setting, 'max_win_cap') as number}
                    onChange={e => handleChange(setting.id, 'max_win_cap', Number(e.target.value))}
                    className="w-14 bg-card rounded px-1.5 py-1 text-xs text-foreground outline-none gold-border text-center font-heading" />
                </div>

                {/* Active + Save */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleChange(setting.id, 'is_active', !(getValue(setting, 'is_active') as boolean))}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getValue(setting, 'is_active') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                  >{getValue(setting, 'is_active') ? 'ON' : 'OFF'}</button>
                  {hasChanges && (
                    <button onClick={() => saveSettings(setting)} disabled={saving === setting.id}
                      className="flex items-center gap-0.5 px-2 py-1 rounded gold-gradient text-primary-foreground font-heading font-bold text-[10px] disabled:opacity-50">
                      <Save size={10} />{saving === setting.id ? '...' : 'Save'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Panel */}
              {isExpanded && (
                <div className="border-t border-border/30 p-3 space-y-3" onClick={e => e.stopPropagation()}>
                  {/* Win Probability Tiers */}
                  <div>
                    <h4 className="text-xs font-heading font-bold mb-2 flex items-center gap-1">
                      <TrendingUp size={12} /> Win Probability (%)
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { key: 'small_win_pct', label: 'Small', color: 'text-green-400', range: '1.2x-2x' },
                        { key: 'medium_win_pct', label: 'Medium', color: 'text-blue-400', range: '2x-5x' },
                        { key: 'big_win_pct', label: 'Big', color: 'text-orange-400', range: '10x-30x' },
                        { key: 'jackpot_win_pct', label: 'Jackpot', color: 'text-yellow-400', range: '50x-200x' },
                      ] as const).map(tier => (
                        <div key={tier.key} className="text-center">
                          <label className={`text-[10px] font-bold block ${tier.color}`}>{tier.label}</label>
                          <input type="number" min={0} max={50} step={0.5}
                            value={getValue(setting, tier.key) as number}
                            onChange={e => handleChange(setting.id, tier.key, Number(e.target.value))}
                            className="w-full bg-card rounded px-1.5 py-1 text-xs text-foreground outline-none gold-border text-center font-heading" />
                          <span className="text-[9px] text-muted-foreground">{tier.range}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pool Distribution */}
                  <div>
                    <h4 className="text-xs font-heading font-bold mb-2 flex items-center gap-1">
                      <Layers size={12} /> Pool Distribution (% of each bet)
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { key: 'small_win_pool_pct', label: 'Small', icon: '🟢' },
                        { key: 'medium_win_pool_pct', label: 'Medium', icon: '🔵' },
                        { key: 'big_win_pool_pct', label: 'Big', icon: '🟠' },
                        { key: 'jackpot_pool_pct', label: 'Jackpot', icon: '🏆' },
                      ] as const).map(pool => (
                        <div key={pool.key} className="text-center">
                          <label className="text-[10px] text-muted-foreground block">{pool.icon} {pool.label}</label>
                          <div className="flex items-center justify-center gap-0.5">
                            <input type="number" min={0} max={50} step={1}
                              value={getValue(setting, pool.key) as number}
                              onChange={e => handleChange(setting.id, pool.key, Number(e.target.value))}
                              className="w-full bg-card rounded px-1.5 py-1 text-xs text-foreground outline-none gold-border text-center font-heading" />
                            <Percent size={10} className="text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      House Edge = {100 - ((getValue(setting, 'small_win_pool_pct') as number) + (getValue(setting, 'medium_win_pool_pct') as number) + (getValue(setting, 'big_win_pool_pct') as number) + (getValue(setting, 'jackpot_pool_pct') as number))}% of each bet
                    </p>
                  </div>

                  {/* Cooldowns */}
                  <div>
                    <h4 className="text-xs font-heading font-bold mb-2 flex items-center gap-1">
                      <Clock size={12} /> Win Cooldowns (hours between repeat wins)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Big Win Cooldown</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={1} max={168} step={1}
                            value={getValue(setting, 'big_win_cooldown_hours') as number}
                            onChange={e => handleChange(setting.id, 'big_win_cooldown_hours', Number(e.target.value))}
                            className="w-full bg-card rounded px-2 py-1.5 text-xs text-foreground outline-none gold-border text-center font-heading" />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">hrs</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Jackpot Cooldown</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={1} max={168} step={1}
                            value={getValue(setting, 'jackpot_cooldown_hours') as number}
                            onChange={e => handleChange(setting.id, 'jackpot_cooldown_hours', Number(e.target.value))}
                            className="w-full bg-card rounded px-2 py-1.5 text-xs text-foreground outline-none gold-border text-center font-heading" />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">hrs</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Max Win Multiplier */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Max Win Multiplier</label>
                      <input type="number" min={5} max={100} step={1}
                        value={getValue(setting, 'max_win_multiplier') as number}
                        onChange={e => handleChange(setting.id, 'max_win_multiplier', Number(e.target.value))}
                        className="w-full bg-card rounded px-2 py-1.5 text-xs text-foreground outline-none gold-border text-center font-heading" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Min Profit Margin %</label>
                      <input type="number" min={5} max={40} step={1}
                        value={getValue(setting, 'min_profit_margin') as number}
                        onChange={e => handleChange(setting.id, 'min_profit_margin', Number(e.target.value))}
                        className="w-full bg-card rounded px-2 py-1.5 text-xs text-foreground outline-none gold-border text-center font-heading" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-2">
        <h3 className="font-heading font-bold text-sm flex items-center gap-1"><Trophy size={14} /> How the Pool System Works</h3>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li>• <strong>Win distribution (per game)</strong>: Set so users get <strong>frequent small wins</strong>, <strong>less often medium</strong>, <strong>less often big</strong>, <strong>rare mega/jackpot</strong>. House profit stays safe for 1 user or 100k users.</li>
          <li>• <strong>Recommended ranges</strong>: Small 32–40%, Medium 10–15%, Big 2–5%, Jackpot 0.3–1%. Loss rate = remainder (e.g. 48%).</li>
          <li>• <strong>Profit Margin (15–40%)</strong>: House edge. System auto-adjusts RTP when players win too much.</li>
          <li>• <strong>Pool Distribution</strong>: Each bet splits into Small/Medium/Big/Jackpot pools. Payouts come from these pools.</li>
          <li>• <strong>Cooldowns</strong>: Same user can't repeat Big/Jackpot within the set hours. Prevents abuse.</li>
          <li>• <strong>Max Win Cap</strong>: Max payout = Bet × Cap (e.g. 200x). Protects pools.</li>
          <li>• 🔒 Global profit pool + per-game settings + reward pools keep owner profit safe.</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminProfitSettings;
