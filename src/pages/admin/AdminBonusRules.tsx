import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Edit2, Gift, Plus, Save, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { getBonusRuleIcon } from '@/lib/bonusRuleUi';
import { BonusRewardType, BonusRule, BonusTriggerType, useBonusRules } from '@/hooks/useBonusRules';

type RuleForm = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  trigger_type: BonusTriggerType;
  reward_type: BonusRewardType;
  priority: number;
  is_enabled: boolean;
  promo_code: string;
  display_order: number;
  display_icon: string;
  display_color_from: string;
  display_color_to: string;
  starts_at: string;
  ends_at: string;
  percent: string;
  fixed_amount: string;
  min_deposit: string;
  max_bonus_amount: string;
  referral_cap: string;
  turnover_multiplier: string;
  allowed_game_ids: string[];
};

const triggerOptions: { value: BonusTriggerType; label: string }[] = [
  { value: 'first_deposit_approved', label: 'First Deposit' },
  { value: 'deposit_approved', label: 'Deposit / Reload' },
  { value: 'referral_deposit_approved', label: 'Referral Deposit' },
  { value: 'game_settlement', label: 'Game Settlement' },
];

const rewardOptions: { value: BonusRewardType; label: string }[] = [
  { value: 'deposit_percent', label: 'Percent Bonus' },
  { value: 'deposit_fixed', label: 'Fixed Bonus' },
  { value: 'referral_percent', label: 'Referral Percent' },
  { value: 'referral_fixed', label: 'Referral Fixed' },
  { value: 'bonus_balance', label: 'Balance Credit' },
];

const iconOptions = ['Gift', 'Crown', 'Percent', 'Users', 'Zap', 'Plane', 'Wallet', 'Sparkles'];

const emptyForm = (): RuleForm => ({
  id: null,
  slug: '',
  name: '',
  description: '',
  trigger_type: 'deposit_approved',
  reward_type: 'deposit_percent',
  priority: 20,
  is_enabled: true,
  promo_code: '',
  display_order: 10,
  display_icon: 'Gift',
  display_color_from: 'from-primary',
  display_color_to: 'to-gold-dark',
  starts_at: '',
  ends_at: '',
  percent: '',
  fixed_amount: '',
  min_deposit: '',
  max_bonus_amount: '',
  referral_cap: '',
  turnover_multiplier: '',
  allowed_game_ids: [],
});

const toLocalInputValue = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().slice(0, 16);
};

const buildFormFromRule = (rule: BonusRule): RuleForm => ({
  id: rule.id,
  slug: rule.slug,
  name: rule.name,
  description: rule.description || '',
  trigger_type: rule.trigger_type,
  reward_type: rule.reward_type,
  priority: rule.priority,
  is_enabled: rule.is_enabled,
  promo_code: rule.promo_code || '',
  display_order: rule.display_order,
  display_icon: rule.display_icon,
  display_color_from: rule.display_color_from,
  display_color_to: rule.display_color_to,
  starts_at: toLocalInputValue(rule.starts_at),
  ends_at: toLocalInputValue(rule.ends_at),
  percent: String(rule.config?.percent ?? rule.config?.reward_percent ?? ''),
  fixed_amount: String(rule.config?.fixed_amount ?? ''),
  min_deposit: String(rule.config?.min_deposit ?? ''),
  max_bonus_amount: String(rule.config?.max_bonus_amount ?? ''),
  referral_cap: String(rule.config?.referral_cap ?? ''),
  turnover_multiplier: String(rule.config?.turnover_multiplier ?? ''),
  allowed_game_ids: Array.isArray(rule.config?.allowed_game_ids)
    ? rule.config.allowed_game_ids.filter((value): value is string => typeof value === 'string')
    : [],
});

const AdminBonusRules = () => {
  const { rules, loading, refetch } = useBonusRules({ includeDisabled: true });
  const [games, setGames] = useState<{ game_id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  useEffect(() => {
    const fetchGames = async () => {
      const { data } = await (supabase as any)
        .from('games')
        .select('game_id, name')
        .order('name', { ascending: true });
      setGames(Array.isArray(data) ? data : []);
    };
    fetchGames();
  }, []);

  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter(rule => rule.is_enabled).length,
    deposit: rules.filter(rule => rule.trigger_type === 'deposit_approved' || rule.trigger_type === 'first_deposit_approved').length,
    referral: rules.filter(rule => rule.trigger_type === 'referral_deposit_approved').length,
  }), [rules]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (rule: BonusRule) => {
    setForm(buildFormFromRule(rule));
    setShowModal(true);
  };

  const toggleGame = (gameId: string) => {
    setForm(prev => ({
      ...prev,
      allowed_game_ids: prev.allowed_game_ids.includes(gameId)
        ? prev.allowed_game_ids.filter(value => value !== gameId)
        : [...prev.allowed_game_ids, gameId],
    }));
  };

  const toggleRule = async (rule: BonusRule) => {
    const { error } = await (supabase as any)
      .from('bonus_rules')
      .update({ is_enabled: !rule.is_enabled, updated_at: new Date().toISOString() })
      .eq('id', rule.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${rule.name} ${rule.is_enabled ? 'disabled' : 'enabled'}`);
    refetch();
  };

  const saveRule = async () => {
    if (!form.slug.trim() || !form.name.trim()) {
      toast.error('Rule name and slug are required');
      return;
    }

    setSaving(true);

    const config = {
      percent: form.percent ? Number(form.percent) : undefined,
      fixed_amount: form.fixed_amount ? Number(form.fixed_amount) : undefined,
      min_deposit: form.min_deposit ? Number(form.min_deposit) : undefined,
      max_bonus_amount: form.max_bonus_amount ? Number(form.max_bonus_amount) : undefined,
      referral_cap: form.referral_cap ? Number(form.referral_cap) : undefined,
      turnover_multiplier: form.turnover_multiplier ? Number(form.turnover_multiplier) : undefined,
      allowed_game_ids: form.allowed_game_ids,
    };

    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      trigger_type: form.trigger_type,
      reward_type: form.reward_type,
      priority: Number(form.priority),
      is_enabled: form.is_enabled,
      promo_code: form.promo_code.trim() || null,
      display_order: Number(form.display_order),
      display_icon: form.display_icon,
      display_color_from: form.display_color_from.trim() || 'from-primary',
      display_color_to: form.display_color_to.trim() || 'to-gold-dark',
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      config,
      updated_at: new Date().toISOString(),
    };

    const query = form.id
      ? (supabase as any).from('bonus_rules').update(payload).eq('id', form.id)
      : (supabase as any).from('bonus_rules').insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(form.id ? 'Bonus rule updated' : 'Bonus rule created');
    setShowModal(false);
    refetch();
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-lg md:text-2xl">🎁 Bonus Rule Management</h1>
          <p className="text-sm text-muted-foreground">Configure deposit, referral, welcome, and game-targeted bonus campaigns.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gold-gradient text-primary-foreground font-heading font-bold"
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Total Rules</p>
          <p className="font-heading font-bold text-2xl text-primary">{stats.total}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Enabled</p>
          <p className="font-heading font-bold text-2xl text-green-400">{stats.enabled}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Deposit Rules</p>
          <p className="font-heading font-bold text-2xl text-primary">{stats.deposit}</p>
        </div>
        <div className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Referral Rules</p>
          <p className="font-heading font-bold text-2xl text-yellow-400">{stats.referral}</p>
        </div>
      </div>

      <div className="space-y-3">
        {loading && rules.length === 0 ? (
          <div className="bg-card rounded-xl p-8 gold-border text-center text-muted-foreground">Loading bonus rules...</div>
        ) : rules.length === 0 ? (
          <div className="bg-card rounded-xl p-8 gold-border text-center text-muted-foreground">No bonus rules found.</div>
        ) : (
          rules.map(rule => {
            const Icon = getBonusRuleIcon(rule);
            const percent = Number(rule.config?.percent ?? 0);
            const fixedAmount = Number(rule.config?.fixed_amount ?? 0);
            const minDeposit = Number(rule.config?.min_deposit ?? 0);
            const maxBonus = Number(rule.config?.max_bonus_amount ?? 0);
            const referralCap = Number(rule.config?.referral_cap ?? 0);
            const turnoverMult = Number(rule.config?.turnover_multiplier ?? 0);
            const gameIds = Array.isArray(rule.config?.allowed_game_ids) ? rule.config.allowed_game_ids : [];

            return (
              <div key={rule.id} className="bg-card rounded-2xl p-4 gold-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${rule.display_color_from} ${rule.display_color_to} flex items-center justify-center text-white`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-heading font-bold text-base">{rule.name}</h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading ${rule.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                          {rule.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {rule.trigger_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rule.description || 'No description provided.'}</p>
                      <div className="flex gap-2 flex-wrap mt-2 text-[11px] text-muted-foreground">
                        {percent > 0 && <span>Percent: {percent}%</span>}
                        {fixedAmount > 0 && <span>Fixed: ৳{fixedAmount.toLocaleString()}</span>}
                        {minDeposit > 0 && <span>Min deposit: ৳{minDeposit.toLocaleString()}</span>}
                        {maxBonus > 0 && <span>Max bonus: ৳{maxBonus.toLocaleString()}</span>}
                        {referralCap > 0 && <span>Cap: ৳{referralCap.toLocaleString()}</span>}
                        {turnoverMult > 0 && <span>Turnover: {turnoverMult}x</span>}
                        {rule.promo_code && <span>Code: {rule.promo_code}</span>}
                      </div>
                      {gameIds.length > 0 && (
                        <div className="mt-2 text-[11px] text-primary">
                          Games: {gameIds.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleRule(rule)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                      {rule.is_enabled ? <ToggleRight size={22} className="text-green-400" /> : <ToggleLeft size={22} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => openEdit(rule)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                      <Edit2 size={16} className="text-primary" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => !saving && setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed inset-0 z-50 p-4 md:p-8 overflow-y-auto"
            >
              <div className="max-w-4xl mx-auto bg-card rounded-2xl gold-border p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Gift size={18} className="text-primary" />
                    <h2 className="font-heading font-bold text-lg">{form.id ? 'Edit Bonus Rule' : 'Create Bonus Rule'}</h2>
                  </div>
                  <button onClick={() => !saving && setShowModal(false)} className="p-2 rounded-lg hover:bg-secondary">
                    <X size={18} />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Rule name" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input value={form.slug} onChange={e => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="Slug" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <select value={form.trigger_type} onChange={e => setForm(prev => ({ ...prev, trigger_type: e.target.value as BonusTriggerType }))} className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border">
                    {triggerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={form.reward_type} onChange={e => setForm(prev => ({ ...prev, reward_type: e.target.value as BonusRewardType }))} className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border">
                    {rewardOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input type="number" value={form.priority} onChange={e => setForm(prev => ({ ...prev, priority: Number(e.target.value) }))} placeholder="Priority" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" value={form.display_order} onChange={e => setForm(prev => ({ ...prev, display_order: Number(e.target.value) }))} placeholder="Display order" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input value={form.promo_code} onChange={e => setForm(prev => ({ ...prev, promo_code: e.target.value }))} placeholder="Promo code" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <select value={form.display_icon} onChange={e => setForm(prev => ({ ...prev, display_icon: e.target.value }))} className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border">
                    {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                  </select>
                  <input value={form.display_color_from} onChange={e => setForm(prev => ({ ...prev, display_color_from: e.target.value }))} placeholder="From class" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input value={form.display_color_to} onChange={e => setForm(prev => ({ ...prev, display_color_to: e.target.value }))} placeholder="To class" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="datetime-local" value={form.starts_at} onChange={e => setForm(prev => ({ ...prev, starts_at: e.target.value }))} className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm(prev => ({ ...prev, ends_at: e.target.value }))} className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" value={form.percent} onChange={e => setForm(prev => ({ ...prev, percent: e.target.value }))} placeholder="Percent" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" value={form.fixed_amount} onChange={e => setForm(prev => ({ ...prev, fixed_amount: e.target.value }))} placeholder="Fixed amount" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" value={form.min_deposit} onChange={e => setForm(prev => ({ ...prev, min_deposit: e.target.value }))} placeholder="Min deposit" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" value={form.max_bonus_amount} onChange={e => setForm(prev => ({ ...prev, max_bonus_amount: e.target.value }))} placeholder="Max bonus amount" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" value={form.referral_cap} onChange={e => setForm(prev => ({ ...prev, referral_cap: e.target.value }))} placeholder="Referral cap" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <input type="number" min="0" step="0.5" value={form.turnover_multiplier} onChange={e => setForm(prev => ({ ...prev, turnover_multiplier: e.target.value }))} placeholder="Turnover (e.g. 10 = 10x)" title="Wagering requirement: user must bet this many times the bonus before withdraw" className="bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border" />
                  <label className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 gold-border">
                    <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(prev => ({ ...prev, is_enabled: e.target.checked }))} />
                    <span className="text-sm">Enabled</span>
                  </label>
                </div>

                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description"
                  rows={3}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border"
                />

                <div className="bg-secondary/60 rounded-2xl p-4 gold-border">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-primary" />
                    <h3 className="font-heading font-bold text-sm">Target Games</h3>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {games.map(game => (
                      <button
                        type="button"
                        key={game.game_id}
                        onClick={() => toggleGame(game.game_id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-heading transition-colors ${
                          form.allowed_game_ids.includes(game.game_id)
                            ? 'gold-gradient text-primary-foreground'
                            : 'bg-card text-muted-foreground gold-border'
                        }`}
                      >
                        {game.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowModal(false)} disabled={saving} className="px-4 py-2 rounded-xl bg-secondary gold-border">
                    Cancel
                  </button>
                  <button onClick={saveRule} disabled={saving} className="px-4 py-2 rounded-xl gold-gradient text-primary-foreground font-heading font-bold flex items-center gap-2">
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Rule'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBonusRules;
