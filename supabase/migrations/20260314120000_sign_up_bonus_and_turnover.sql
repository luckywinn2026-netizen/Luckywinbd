-- Sign up bonus: first-time users get bonus (default 10 taka) with configurable turnover
-- Admin can set amount and turnover_multiplier from admin panel (site_settings)

-- 1. Add sign_up_bonus to site_settings
INSERT INTO public.site_settings (key, value) VALUES
  ('sign_up_bonus', jsonb_build_object(
    'amount', 10,
    'turnover_multiplier', 10
  ))
ON CONFLICT (key) DO NOTHING;

-- 2. Function to grant sign up bonus (called from handle_new_user)
CREATE OR REPLACE FUNCTION public.grant_sign_up_bonus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings jsonb;
  v_amount numeric;
  v_turnover_mult numeric;
  v_required_turnover numeric := 0;
  v_award_id uuid;
BEGIN
  SELECT value INTO v_settings
  FROM public.site_settings
  WHERE key = 'sign_up_bonus'
  LIMIT 1;

  IF v_settings IS NULL THEN
    RETURN;
  END IF;

  v_amount := COALESCE((v_settings->>'amount')::numeric, 0);
  v_turnover_mult := COALESCE((v_settings->>'turnover_multiplier')::numeric, 0);

  IF v_amount <= 0 THEN
    RETURN;
  END IF;

  IF v_turnover_mult > 0 THEN
    v_required_turnover := ROUND(v_amount * v_turnover_mult, 2);
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
    status,
    idempotency_key,
    metadata
  )
  VALUES (
    NULL,
    p_user_id,
    NULL,
    NULL,
    'sign_up',
    'bonus_balance',
    v_amount,
    v_required_turnover,
    0,
    'credited',
    'sign_up:' || p_user_id::text,
    jsonb_build_object('sign_up_bonus', true)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_award_id;

  IF v_award_id IS NULL THEN
    RETURN; -- Already granted (idempotent)
  END IF;

  UPDATE public.wallets
  SET balance = balance + v_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
END;
$$;

-- 3. Update handle_new_user to grant sign up bonus after creating wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, phone, refer_code, user_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email, '@', 1)),
    public.generate_refer_code(),
    public.generate_user_code()
  );
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_vip_data (user_id) VALUES (NEW.id);

  -- Grant sign up bonus (reads amount + turnover from site_settings)
  PERFORM public.grant_sign_up_bonus(NEW.id);

  RETURN NEW;
END;
$function$;
