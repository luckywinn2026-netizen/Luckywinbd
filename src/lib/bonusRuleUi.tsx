import { Crown, Gift, Percent, Plane, Sparkles, Users, Wallet, Zap } from 'lucide-react';

import type { BonusRule } from '@/hooks/useBonusRules';

export const bonusRuleIconMap = {
  Crown,
  Gift,
  Percent,
  Plane,
  Sparkles,
  Users,
  Wallet,
  Zap,
};

export function getBonusRuleIcon(rule: BonusRule) {
  return bonusRuleIconMap[rule.display_icon as keyof typeof bonusRuleIconMap] || Gift;
}

export function formatBonusRuleSummary(rule: BonusRule) {
  const percent = Number(rule.config?.percent ?? rule.config?.reward_percent ?? 0);
  const fixedAmount = Number(rule.config?.fixed_amount ?? 0);
  const maxBonus = Number(rule.config?.max_bonus_amount ?? 0);
  const minDeposit = Number(rule.config?.min_deposit ?? 0);
  const referralCap = Number(rule.config?.referral_cap ?? 0);

  let rewardText = '';
  if (rule.reward_type.includes('percent') && Number.isFinite(percent) && percent > 0) {
    rewardText = `${percent}%`;
  } else if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
    rewardText = `৳${fixedAmount.toLocaleString()}`;
  }

  const parts = [rewardText];
  if (minDeposit > 0) parts.push(`Min ৳${minDeposit.toLocaleString()}`);
  if (maxBonus > 0) parts.push(`Max ৳${maxBonus.toLocaleString()}`);
  if (referralCap > 0) parts.push(`Cap ৳${referralCap.toLocaleString()}`);

  return parts.filter(Boolean).join(' • ');
}
