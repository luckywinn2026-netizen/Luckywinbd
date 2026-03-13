import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';

export type BonusTriggerType =
  | 'deposit_approved'
  | 'first_deposit_approved'
  | 'referral_deposit_approved'
  | 'game_settlement';

export type BonusRewardType =
  | 'deposit_percent'
  | 'deposit_fixed'
  | 'referral_percent'
  | 'referral_fixed'
  | 'bonus_balance';

export type BonusRule = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  trigger_type: BonusTriggerType;
  reward_type: BonusRewardType;
  priority: number;
  is_enabled: boolean;
  promo_code: string | null;
  display_order: number;
  display_icon: string;
  display_color_from: string;
  display_color_to: string;
  starts_at: string | null;
  ends_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type UseBonusRulesOptions = {
  triggerTypes?: BonusTriggerType[];
  includeDisabled?: boolean;
};

const normalizeRule = (row: any): BonusRule => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description ?? null,
  trigger_type: row.trigger_type,
  reward_type: row.reward_type,
  priority: Number(row.priority || 0),
  is_enabled: Boolean(row.is_enabled),
  promo_code: row.promo_code ?? null,
  display_order: Number(row.display_order || 0),
  display_icon: row.display_icon || 'Gift',
  display_color_from: row.display_color_from || 'from-primary',
  display_color_to: row.display_color_to || 'to-gold-dark',
  starts_at: row.starts_at ?? null,
  ends_at: row.ends_at ?? null,
  config: typeof row.config === 'object' && row.config ? row.config : {},
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export function getBonusRuleNumber(rule: BonusRule | null | undefined, key: string, fallback = 0) {
  const raw = rule?.config?.[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getBonusRuleString(rule: BonusRule | null | undefined, key: string, fallback = '') {
  const raw = rule?.config?.[key];
  return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

export function getBonusRuleGameIds(rule: BonusRule | null | undefined): string[] {
  const raw = rule?.config?.allowed_game_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

const EMPTY_TRIGGERS: BonusTriggerType[] = [];

export function useBonusRules(options: UseBonusRulesOptions = {}) {
  const { triggerTypes = EMPTY_TRIGGERS, includeDisabled = false } = options;
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [loading, setLoading] = useState(true);

  const triggerKey = triggerTypes.length ? triggerTypes.join(',') : '';

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('bonus_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!includeDisabled) {
        query = query.eq('is_enabled', true);
      }
      if (triggerTypes.length > 0) {
        query = query.in('trigger_type', triggerTypes);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[useBonusRules]', error);
        setRules([]);
      } else {
        setRules(Array.isArray(data) ? data.map(normalizeRule) : []);
      }
    } catch (err) {
      console.error('[useBonusRules]', err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [includeDisabled, triggerKey]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    loading,
    refetch: fetchRules,
  };
}
