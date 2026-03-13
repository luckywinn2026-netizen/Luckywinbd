CREATE OR REPLACE FUNCTION public.settle_generic_game_round(
  p_user_id uuid,
  p_game_id text,
  p_game_name text,
  p_game_type text,
  p_bet_amount numeric,
  p_total_win numeric,
  p_result text,
  p_multiplier numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_balance numeric;
  v_new_balance numeric;
  v_points integer;
BEGIN
  IF p_bet_amount <= 0 THEN
    RAISE EXCEPTION 'Bet amount must be positive';
  END IF;

  IF p_total_win < 0 THEN
    RAISE EXCEPTION 'Total win cannot be negative';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('generic_round_' || p_game_id || '_' || p_user_id::text));

  SELECT balance
  INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_new_balance := v_wallet_balance - p_bet_amount + p_total_win;

  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  v_points := LEAST(50, FLOOR(p_bet_amount / 10)::integer);
  IF v_points > 0 THEN
    PERFORM public.add_vip_points(p_user_id, v_points, p_bet_amount);
  END IF;

  INSERT INTO public.game_sessions (
    user_id,
    game_type,
    game_name,
    game_id,
    bet_amount,
    win_amount,
    result,
    multiplier
  )
  VALUES (
    p_user_id,
    p_game_type,
    p_game_name,
    p_game_id,
    p_bet_amount,
    p_total_win,
    CASE WHEN p_total_win > 0 THEN 'win' ELSE COALESCE(NULLIF(p_result, ''), 'loss') END,
    p_multiplier
  );

  RETURN jsonb_build_object(
    'new_balance', ROUND(v_new_balance, 2),
    'bet_amount', ROUND(p_bet_amount, 2),
    'win_amount', ROUND(p_total_win, 2),
    'result', CASE WHEN p_total_win > 0 THEN 'win' ELSE COALESCE(NULLIF(p_result, ''), 'loss') END
  );
END;
$$;
