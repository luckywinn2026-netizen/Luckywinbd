ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS bonus_amount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credited_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.bonus_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN ('deposit_approved', 'first_deposit_approved', 'referral_deposit_approved', 'game_settlement')),
  reward_type text NOT NULL CHECK (reward_type IN ('deposit_percent', 'deposit_fixed', 'referral_percent', 'referral_fixed', 'bonus_balance')),
  priority integer NOT NULL DEFAULT 100,
  is_enabled boolean NOT NULL DEFAULT true,
  promo_code text,
  display_order integer NOT NULL DEFAULT 0,
  display_icon text NOT NULL DEFAULT 'Gift',
  display_color_from text NOT NULL DEFAULT 'from-primary',
  display_color_to text NOT NULL DEFAULT 'to-gold-dark',
  starts_at timestamptz,
  ends_at timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active bonus rules" ON public.bonus_rules;
CREATE POLICY "Public can view active bonus rules"
ON public.bonus_rules FOR SELECT
TO anon, authenticated
USING (
  is_enabled = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

DROP POLICY IF EXISTS "Admins can manage bonus rules" ON public.bonus_rules;
CREATE POLICY "Admins can manage bonus rules"
ON public.bonus_rules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_bonus_rules_updated_at ON public.bonus_rules;
CREATE TRIGGER update_bonus_rules_updated_at
BEFORE UPDATE ON public.bonus_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bonus_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.bonus_rules(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  source_event text NOT NULL,
  award_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'credited' CHECK (status IN ('credited', 'skipped', 'reversed')),
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  awarded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bonus awards" ON public.bonus_awards;
CREATE POLICY "Users can view own bonus awards"
ON public.bonus_awards FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all bonus awards" ON public.bonus_awards;
CREATE POLICY "Admins can view all bonus awards"
ON public.bonus_awards FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_bonus_rules_trigger_enabled
  ON public.bonus_rules (trigger_type, is_enabled, priority, display_order);

CREATE INDEX IF NOT EXISTS idx_bonus_awards_user_created
  ON public.bonus_awards (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bonus_awards_deposit
  ON public.bonus_awards (deposit_id);

CREATE OR REPLACE FUNCTION public.link_referral_by_code(p_refer_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_existing referrals%ROWTYPE;
  v_clean_code text := upper(trim(p_refer_code));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_clean_code IS NULL OR v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;

  SELECT *
  INTO v_existing
  FROM public.referrals
  WHERE referred_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'linked', true, 'message', 'Referral already linked');
  END IF;

  SELECT user_id
  INTO v_referrer_id
  FROM public.profiles
  WHERE refer_code = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot use your own referral code');
  END IF;

  UPDATE public.profiles
  SET referred_by = v_clean_code
  WHERE user_id = v_user_id
    AND (referred_by IS NULL OR referred_by = '');

  INSERT INTO public.referrals (referrer_id, referred_id)
  VALUES (v_referrer_id, v_user_id)
  ON CONFLICT (referred_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'linked', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_bonus_award(
  p_rule_id uuid,
  p_user_id uuid,
  p_deposit_id uuid,
  p_referral_id uuid,
  p_source_event text,
  p_award_type text,
  p_amount numeric,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_award_id uuid;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.bonus_awards (
    rule_id,
    user_id,
    deposit_id,
    referral_id,
    source_event,
    award_type,
    amount,
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
        jsonb_build_object('deposit_amount', v_deposit.amount, 'first_deposit', v_is_first_deposit)
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
        jsonb_build_object('deposit_amount', v_deposit.amount, 'referred_user_id', v_deposit.user_id)
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

CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_result jsonb;
  v_total_bonus numeric := 0;
BEGIN
  IF (OLD.status = 'pending' OR OLD.status = 'agent_approved') AND NEW.status = 'approved' THEN
    UPDATE public.wallets
    SET balance = balance + NEW.amount,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Wallet not found for user %', NEW.user_id;
    END IF;

    v_bonus_result := public.apply_bonus_rules_for_deposit(NEW.id);
    v_total_bonus := COALESCE((v_bonus_result->>'totalBonus')::numeric, 0);

    UPDATE public.deposits
    SET approved_at = COALESCE(approved_at, now()),
        bonus_amount_total = v_total_bonus,
        credited_amount = NEW.amount + v_total_bonus,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.bonus_rules (
  slug,
  name,
  description,
  trigger_type,
  reward_type,
  priority,
  is_enabled,
  promo_code,
  display_order,
  display_icon,
  display_color_from,
  display_color_to,
  config
)
VALUES
(
  'deposit-bonus-default',
  'Regular Deposit Bonus',
  'Applies a small bonus on every approved deposit.',
  'deposit_approved',
  'deposit_percent',
  20,
  true,
  'RELOAD225',
  10,
  'Percent',
  'from-primary',
  'to-gold-dark',
  jsonb_build_object('percent', 2.25, 'min_deposit', 200)
),
(
  'referral-bonus-default',
  'Referral Deposit Bonus',
  'Credits the referrer when the referred user makes an approved deposit.',
  'referral_deposit_approved',
  'referral_percent',
  30,
  true,
  'REFER50',
  20,
  'Users',
  'from-success',
  'to-primary',
  jsonb_build_object('percent', 50, 'referral_cap', 12500, 'min_deposit', 200)
),
(
  'first-deposit-welcome',
  'First Deposit Welcome Bonus',
  'Optional welcome offer for the first approved deposit.',
  'first_deposit_approved',
  'deposit_percent',
  10,
  false,
  'LUCKY100',
  30,
  'Crown',
  'from-primary',
  'to-gold-light',
  jsonb_build_object('percent', 100, 'min_deposit', 500, 'max_bonus_amount', 20000)
),
(
  'weekend-reload',
  'Weekend Reload Bonus',
  'Optional reload bonus that can be enabled during campaigns.',
  'deposit_approved',
  'deposit_percent',
  40,
  false,
  'WEEKEND25',
  40,
  'Zap',
  'from-success',
  'to-primary',
  jsonb_build_object('percent', 25, 'min_deposit', 200)
)
ON CONFLICT (slug) DO NOTHING;
