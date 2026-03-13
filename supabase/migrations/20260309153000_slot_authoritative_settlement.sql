ALTER TABLE public.super_ace_sessions
  ADD COLUMN IF NOT EXISTS game_id text NOT NULL DEFAULT 'super-ace';

UPDATE public.super_ace_sessions
SET game_id = COALESCE(game_id, 'super-ace')
WHERE game_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_super_ace_sessions_user_game
  ON public.super_ace_sessions (user_id, game_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_super_ace_sessions_active_user_game
  ON public.super_ace_sessions (user_id, game_id)
  WHERE active = true;

ALTER TABLE public.super_ace_spin_logs
  ADD COLUMN IF NOT EXISTS game_id text NOT NULL DEFAULT 'super-ace';

UPDATE public.super_ace_spin_logs
SET game_id = COALESCE(game_id, 'super-ace')
WHERE game_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_super_ace_spin_logs_user_game
  ON public.super_ace_spin_logs (user_id, game_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.settle_slot_spin(
  p_user_id uuid,
  p_game_id text,
  p_game_name text,
  p_bet_amount numeric,
  p_total_win numeric,
  p_is_free_spin boolean,
  p_session_spin_delta integer,
  p_session_award integer,
  p_log_cascades integer,
  p_log_grid_result jsonb,
  p_result_multiplier numeric,
  p_win_tier text,
  p_small_pct numeric DEFAULT 30,
  p_medium_pct numeric DEFAULT 20,
  p_big_pct numeric DEFAULT 10,
  p_jackpot_pct numeric DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_balance numeric;
  v_new_balance numeric;
  v_effective_bet numeric := CASE WHEN p_is_free_spin THEN 0 ELSE p_bet_amount END;
  v_session public.super_ace_sessions%ROWTYPE;
  v_has_session boolean := false;
  v_next_remaining integer := 0;
  v_next_awarded integer := 0;
  v_next_active boolean := false;
  v_pool_type text;
BEGIN
  IF p_bet_amount <= 0 THEN
    RAISE EXCEPTION 'Bet amount must be positive';
  END IF;
  IF p_total_win < 0 THEN
    RAISE EXCEPTION 'Total win cannot be negative';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('slot_spin_' || p_game_id || '_' || p_user_id::text));

  SELECT balance
  INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  SELECT *
  INTO v_session
  FROM public.super_ace_sessions
  WHERE user_id = p_user_id
    AND game_id = p_game_id
    AND active = true
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  v_has_session := FOUND;

  IF p_is_free_spin AND (NOT v_has_session OR COALESCE(v_session.spins_remaining, 0) <= 0) THEN
    RAISE EXCEPTION 'Free spin session not found';
  END IF;

  IF NOT p_is_free_spin AND v_wallet_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  IF v_has_session THEN
    v_next_remaining := GREATEST(0, v_session.spins_remaining - GREATEST(COALESCE(p_session_spin_delta, 0), 0) + GREATEST(COALESCE(p_session_award, 0), 0));
    v_next_awarded := v_session.total_spins_awarded + GREATEST(COALESCE(p_session_award, 0), 0);
    v_next_active := v_next_remaining > 0;

    UPDATE public.super_ace_sessions
    SET spins_remaining = v_next_remaining,
        total_spins_awarded = v_next_awarded,
        active = v_next_active,
        updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  ELSIF COALESCE(p_session_award, 0) > 0 THEN
    INSERT INTO public.super_ace_sessions (
      user_id,
      game_id,
      spins_remaining,
      total_spins_awarded,
      active
    )
    VALUES (
      p_user_id,
      p_game_id,
      p_session_award,
      p_session_award,
      true
    )
    RETURNING * INTO v_session;

    v_has_session := true;
    v_next_remaining := v_session.spins_remaining;
    v_next_awarded := v_session.total_spins_awarded;
    v_next_active := true;
  END IF;

  v_new_balance := v_wallet_balance - v_effective_bet + p_total_win;

  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF v_effective_bet > 0 THEN
    PERFORM public.distribute_bet_to_pools(
      p_game_id,
      p_bet_amount,
      p_small_pct,
      p_medium_pct,
      p_big_pct,
      p_jackpot_pct
    );
  END IF;

  IF p_total_win > 0 THEN
    v_pool_type := CASE WHEN p_win_tier = 'mega_win' THEN 'big_win' ELSE p_win_tier END;
    IF v_pool_type IN ('small_win', 'medium_win', 'big_win', 'jackpot') THEN
      PERFORM public.deduct_from_pool(p_game_id, v_pool_type, p_total_win);
    END IF;
  END IF;

  IF p_is_free_spin OR v_effective_bet > 0 THEN
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
      'slot',
      p_game_name,
      p_game_id,
      v_effective_bet,
      p_total_win,
      CASE WHEN p_total_win > 0 THEN 'win' ELSE 'loss' END,
      p_result_multiplier
    );
  END IF;

  INSERT INTO public.super_ace_spin_logs (
    user_id,
    game_id,
    bet_amount,
    total_win,
    cascades,
    free_spin_mode,
    grid_result
  )
  VALUES (
    p_user_id,
    p_game_id,
    v_effective_bet,
    p_total_win,
    COALESCE(p_log_cascades, 0),
    p_is_free_spin,
    COALESCE(p_log_grid_result, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'newBalance', v_new_balance,
    'freeSpins', CASE
      WHEN v_has_session THEN jsonb_build_object(
        'sessionId', CASE WHEN v_session.active THEN v_session.id ELSE NULL END,
        'remaining', COALESCE(v_session.spins_remaining, 0),
        'totalAwarded', COALESCE(v_session.total_spins_awarded, 0),
        'active', COALESCE(v_session.active, false)
      )
      ELSE jsonb_build_object(
        'sessionId', NULL,
        'remaining', 0,
        'totalAwarded', 0,
        'active', false
      )
    END
  );
END;
$$;
