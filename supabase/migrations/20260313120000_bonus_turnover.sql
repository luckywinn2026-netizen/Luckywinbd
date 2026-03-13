-- Bonus turnover (wagering requirement) per bonus rule
-- turnover_multiplier in config: e.g. 10 = 10x (user must bet 10x bonus amount before withdraw)

-- 1. Add turnover columns to bonus_awards
ALTER TABLE public.bonus_awards
  ADD COLUMN IF NOT EXISTS required_turnover numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_turnover numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bonus_awards_user_pending_turnover
  ON public.bonus_awards (user_id)
  WHERE required_turnover > 0 AND completed_turnover < required_turnover;

-- 2. Update grant_bonus_award to accept and store turnover
CREATE OR REPLACE FUNCTION public.grant_bonus_award(
  p_rule_id uuid,
  p_user_id uuid,
  p_deposit_id uuid,
  p_referral_id uuid,
  p_source_event text,
  p_award_type text,
  p_amount numeric,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_turnover_multiplier numeric DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_award_id uuid;
  v_required_turnover numeric := 0;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN false;
  END IF;

  IF COALESCE(p_turnover_multiplier, 0) > 0 THEN
    v_required_turnover := ROUND(p_amount * p_turnover_multiplier, 2);
  END IF;

  INSERT INTO public.bonus_awards (
    rule_id,
    user_id,
    deposit_id,
    referral_id,
    source_event,
    award_type,
    amount,
    required_turnover,
    completed_turnover,
    idempotency_key,
    metadata
  )
  VALUES (
    p_rule_id,
    p_user_id,
    p_deposit_id,
    p_referral_id,
    p_source_event,
    p_award_type,
    p_amount,
    v_required_turnover,
    0,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_award_id;

  IF v_award_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  RETURN true;
END;
$$;

-- 3. Update apply_bonus_rules_for_deposit to read turnover_multiplier and pass to grant_bonus_award
CREATE OR REPLACE FUNCTION public.apply_bonus_rules_for_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
  v_rule public.bonus_rules%ROWTYPE;
  v_referral public.referrals%ROWTYPE;
  v_is_first_deposit boolean := false;
  v_percent numeric;
  v_fixed_amount numeric;
  v_min_deposit numeric;
  v_max_bonus numeric;
  v_referral_cap numeric;
  v_remaining_cap numeric;
  v_bonus_amount numeric;
  v_total_bonus numeric := 0;
  v_applied_count integer := 0;
  v_turnover_multiplier numeric DEFAULT 0;
BEGIN
  SELECT *
  INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit.id IS NULL OR v_deposit.status <> 'approved' THEN
    RETURN jsonb_build_object('totalBonus', 0, 'appliedCount', 0);
  END IF;

  SELECT COUNT(*) = 1
  INTO v_is_first_deposit
  FROM public.deposits
  WHERE user_id = v_deposit.user_id
    AND status = 'approved';

  SELECT *
  INTO v_referral
  FROM public.referrals
  WHERE referred_id = v_deposit.user_id
  LIMIT 1
  FOR UPDATE;

  FOR v_rule IN
    SELECT *
    FROM public.bonus_rules
    WHERE is_enabled = true
      AND trigger_type IN ('deposit_approved', 'first_deposit_approved', 'referral_deposit_approved')
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    ORDER BY priority ASC, display_order ASC, created_at ASC
  LOOP
    v_percent := NULLIF(COALESCE(v_rule.config->>'percent', v_rule.config->>'reward_percent', ''), '')::numeric;
    v_fixed_amount := NULLIF(COALESCE(v_rule.config->>'fixed_amount', ''), '')::numeric;
    v_min_deposit := COALESCE(NULLIF(v_rule.config->>'min_deposit', '')::numeric, 0);
    v_max_bonus := NULLIF(COALESCE(v_rule.config->>'max_bonus_amount', ''), '')::numeric;
    v_referral_cap := NULLIF(COALESCE(v_rule.config->>'referral_cap', ''), '')::numeric;
    v_turnover_multiplier := COALESCE(NULLIF(v_rule.config->>'turnover_multiplier', '')::numeric, 0);

    IF v_deposit.amount < v_min_deposit THEN
      CONTINUE;
    END IF;

    IF v_rule.trigger_type = 'first_deposit_approved' AND NOT v_is_first_deposit THEN
      CONTINUE;
    END IF;

    IF v_rule.trigger_type IN ('deposit_approved', 'first_deposit_approved') THEN
      IF v_rule.reward_type = 'deposit_percent' THEN
        v_bonus_amount := ROUND(v_deposit.amount * COALESCE(v_percent, 0) / 100.0, 2);
      ELSIF v_rule.reward_type IN ('deposit_fixed', 'bonus_balance') THEN
        v_bonus_amount := ROUND(COALESCE(v_fixed_amount, 0), 2);
      ELSE
        CONTINUE;
      END IF;

      IF v_max_bonus IS NOT NULL THEN
        v_bonus_amount := LEAST(v_bonus_amount, v_max_bonus);
      END IF;

      IF public.grant_bonus_award(
        v_rule.id,
        v_deposit.user_id,
        v_deposit.id,
        NULL,
        v_rule.trigger_type,
        v_rule.reward_type,
        v_bonus_amount,
        'deposit:' || v_deposit.id::text || ':' || v_rule.id::text || ':' || v_deposit.user_id::text,
        jsonb_build_object('deposit_amount', v_deposit.amount, 'first_deposit', v_is_first_deposit),
        v_turnover_multiplier
      ) THEN
        v_total_bonus := v_total_bonus + v_bonus_amount;
        v_applied_count := v_applied_count + 1;
      END IF;
    ELSIF v_rule.trigger_type = 'referral_deposit_approved' AND v_referral.id IS NOT NULL THEN
      IF v_rule.reward_type = 'referral_percent' THEN
        v_bonus_amount := ROUND(v_deposit.amount * COALESCE(v_percent, 0) / 100.0, 2);
      ELSIF v_rule.reward_type = 'referral_fixed' THEN
        v_bonus_amount := ROUND(COALESCE(v_fixed_amount, 0), 2);
      ELSE
        CONTINUE;
      END IF;

      v_remaining_cap := GREATEST(
        0,
        COALESCE(v_referral_cap, v_referral.bonus_cap) - COALESCE(v_referral.bonus_earned, 0)
      );
      v_bonus_amount := LEAST(v_bonus_amount, v_remaining_cap);

      IF public.grant_bonus_award(
        v_rule.id,
        v_referral.referrer_id,
        v_deposit.id,
        v_referral.id,
        v_rule.trigger_type,
        v_rule.reward_type,
        v_bonus_amount,
        'referral:' || v_deposit.id::text || ':' || v_rule.id::text || ':' || v_referral.referrer_id::text,
        jsonb_build_object('deposit_amount', v_deposit.amount, 'referred_user_id', v_deposit.user_id),
        v_turnover_multiplier
      ) THEN
        UPDATE public.referrals
        SET bonus_earned = bonus_earned + v_bonus_amount,
            bonus_cap = COALESCE(v_referral_cap, bonus_cap),
            status = 'active',
            updated_at = now()
        WHERE id = v_referral.id;
        v_applied_count := v_applied_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'totalBonus', v_total_bonus,
    'appliedCount', v_applied_count
  );
END;
$$;

-- 4. Add turnover when user places bet (FIFO: oldest bonus first)
CREATE OR REPLACE FUNCTION public.add_bonus_turnover(p_user_id uuid, p_bet_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_award RECORD;
  v_remaining numeric;
  v_to_add numeric;
BEGIN
  IF COALESCE(p_bet_amount, 0) <= 0 THEN
    RETURN;
  END IF;

  v_remaining := p_bet_amount;

  FOR v_award IN
    SELECT id, amount, required_turnover, completed_turnover
    FROM public.bonus_awards
    WHERE user_id = p_user_id
      AND status = 'credited'
      AND required_turnover > 0
      AND completed_turnover < required_turnover
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_add := LEAST(
      v_remaining,
      v_award.required_turnover - v_award.completed_turnover
    );

    IF v_to_add > 0 THEN
      UPDATE public.bonus_awards
      SET completed_turnover = completed_turnover + v_to_add,
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{last_turnover_at}',
            to_jsonb(now()::text)
          )
      WHERE id = v_award.id;

      v_remaining := v_remaining - v_to_add;
    END IF;
  END LOOP;
END;
$$;

-- 5. Trigger: on game_sessions INSERT, add turnover for that user's bet
CREATE OR REPLACE FUNCTION public.trigger_add_bonus_turnover_on_bet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bet_amount IS NOT NULL AND NEW.bet_amount > 0 THEN
    PERFORM public.add_bonus_turnover(NEW.user_id, NEW.bet_amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_bonus_turnover_on_bet ON public.game_sessions;
CREATE TRIGGER trg_add_bonus_turnover_on_bet
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_add_bonus_turnover_on_bet();

-- 6. Get withdrawable balance (wallet - locked bonus)
-- Overload 1: with p_user_id (for backend/admin)
CREATE OR REPLACE FUNCTION public.get_withdrawable_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
  v_locked numeric;
BEGIN
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_balance IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_locked
  FROM public.bonus_awards
  WHERE user_id = p_user_id
    AND status = 'credited'
    AND required_turnover > 0
    AND completed_turnover < required_turnover;

  RETURN GREATEST(0, v_balance - COALESCE(v_locked, 0));
END;
$$;
