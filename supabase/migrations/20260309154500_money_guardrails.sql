CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance numeric;
BEGIN
  SELECT balance
  INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  v_new_balance := v_current_balance + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance for user %', p_user_id;
  END IF;

  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_from_pool(
  p_game_id text,
  p_pool_type text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
  v_next_balance numeric;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
    VALUES (p_game_id, p_pool_type, 0, 0, 0, now())
    ON CONFLICT (game_id, pool_type) DO NOTHING;

    SELECT balance
    INTO v_balance
    FROM public.reward_pools
    WHERE game_id = p_game_id
      AND pool_type = p_pool_type;

    RETURN COALESCE(v_balance, 0);
  END IF;

  INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
  VALUES (p_game_id, p_pool_type, 0, 0, 0, now())
  ON CONFLICT (game_id, pool_type) DO NOTHING;

  SELECT balance
  INTO v_balance
  FROM public.reward_pools
  WHERE game_id = p_game_id
    AND pool_type = p_pool_type
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Reward pool not found for % / %', p_game_id, p_pool_type;
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient reward pool balance for % / %', p_game_id, p_pool_type;
  END IF;

  v_next_balance := v_balance - p_amount;

  UPDATE public.reward_pools
  SET balance = v_next_balance,
      total_paid_out = total_paid_out + p_amount,
      updated_at = now()
  WHERE game_id = p_game_id
    AND pool_type = p_pool_type;

  RETURN v_next_balance;
END;
$$;
