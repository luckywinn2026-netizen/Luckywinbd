CREATE OR REPLACE FUNCTION public.settle_crash_auto_cashouts(
  p_round_id uuid,
  p_target_multiplier numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bet RECORD;
  v_max_win_cap numeric;
  v_win_amount numeric;
BEGIN
  IF p_target_multiplier IS NULL OR p_target_multiplier < 1.01 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crash_auto_cashout_' || p_round_id::text));

  FOR v_bet IN
    SELECT
      cb.id,
      cb.user_id,
      cb.game_id,
      cb.bet_amount,
      cb.auto_cashout
    FROM public.crash_bets cb
    WHERE cb.round_id = p_round_id
      AND cb.status = 'active'
      AND cb.auto_cashout IS NOT NULL
      AND cb.auto_cashout <= p_target_multiplier
    ORDER BY cb.placed_at
    FOR UPDATE OF cb
  LOOP
    SELECT COALESCE(max_win_cap, 1000)
    INTO v_max_win_cap
    FROM public.game_profit_settings
    WHERE game_id = v_bet.game_id
    LIMIT 1;

    v_win_amount := LEAST(
      ROUND(v_bet.bet_amount * v_bet.auto_cashout),
      ROUND(v_bet.bet_amount * COALESCE(v_max_win_cap, 1000))
    );

    UPDATE public.crash_bets
    SET status = 'cashed_out',
        cashout_multiplier = v_bet.auto_cashout,
        win_amount = v_win_amount,
        settled_at = now(),
        updated_at = now()
    WHERE id = v_bet.id
      AND status = 'active';

    IF FOUND THEN
      UPDATE public.wallets
      SET balance = balance + v_win_amount,
          updated_at = now()
      WHERE user_id = v_bet.user_id;

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
        v_bet.user_id,
        'crash',
        public.get_crash_game_name(v_bet.game_id),
        v_bet.game_id,
        v_bet.bet_amount,
        v_win_amount,
        'win',
        v_bet.auto_cashout
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_crash_round_losses(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('crash_round_loss_' || p_round_id::text));

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
  SELECT
    cb.user_id,
    'crash',
    public.get_crash_game_name(cb.game_id),
    cb.game_id,
    cb.bet_amount,
    0,
    'loss',
    NULL
  FROM public.crash_bets cb
  WHERE cb.round_id = p_round_id
    AND cb.status = 'active';

  UPDATE public.crash_bets
  SET status = 'lost',
      win_amount = 0,
      settled_at = now(),
      updated_at = now()
  WHERE round_id = p_round_id
    AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_crash_round(p_game_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now_ms bigint;
  v_round RECORD;
  v_countdown_ms bigint := 10000;
  v_pause_ms bigint := 3000;
  v_crash_delay bigint;
  v_crash_time_ms bigint;
  v_round_end_ms bigint;
  v_new_id uuid;
  v_crash_point numeric;
  v_settings RECORD;
  v_rtp numeric;
  v_rand numeric;
  v_fly_elapsed_ms bigint;
  v_current_multiplier numeric;
  v_phase text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('crash_round_' || p_game_id));
  v_now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  SELECT *
  INTO v_round
  FROM public.crash_rounds
  WHERE game_id = p_game_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_crash_delay := GREATEST(0, (ln(GREATEST(v_round.crash_point::double precision, 1.01)) / 0.00006)::bigint);
    v_crash_time_ms := v_round.server_start_ms + v_countdown_ms + v_crash_delay;
    v_round_end_ms := v_crash_time_ms + v_pause_ms;

    IF v_now_ms < v_round.server_start_ms + v_countdown_ms THEN
      v_phase := 'waiting';
      v_current_multiplier := 1.00;
    ELSIF v_now_ms < v_crash_time_ms THEN
      v_phase := 'flying';
      v_fly_elapsed_ms := GREATEST(0, v_now_ms - (v_round.server_start_ms + v_countdown_ms));
      v_current_multiplier := FLOOR(EXP(0.00006 * v_fly_elapsed_ms) * 100) / 100;
      PERFORM public.settle_crash_auto_cashouts(v_round.id, v_current_multiplier);
    ELSE
      v_phase := 'crashed';
      v_current_multiplier := ROUND(v_round.crash_point::numeric, 2);
      PERFORM public.settle_crash_auto_cashouts(v_round.id, v_round.crash_point);
      PERFORM public.settle_crash_round_losses(v_round.id);
    END IF;

    IF v_now_ms < v_round_end_ms THEN
      RETURN jsonb_build_object(
        'id', v_round.id,
        'game_id', v_round.game_id,
        'phase', v_phase,
        'current_multiplier', v_current_multiplier,
        'countdown_ms', GREATEST(0, (v_round.server_start_ms + v_countdown_ms) - v_now_ms),
        'elapsed_ms', CASE
          WHEN v_phase = 'flying' THEN GREATEST(0, v_now_ms - (v_round.server_start_ms + v_countdown_ms))
          WHEN v_phase = 'crashed' THEN GREATEST(0, v_crash_time_ms - (v_round.server_start_ms + v_countdown_ms))
          ELSE 0
        END,
        'server_start_ms', v_round.server_start_ms,
        'server_now_ms', v_now_ms,
        'crash_point', CASE WHEN v_phase = 'crashed' THEN ROUND(v_round.crash_point::numeric, 2) ELSE NULL END
      );
    END IF;
  END IF;

  SELECT *
  INTO v_settings
  FROM public.crash_settings
  WHERE game_id = p_game_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_settings IS NOT NULL AND v_settings.mode = 'fixed' AND v_settings.fixed_crash_point IS NOT NULL AND v_settings.fixed_crash_point > 1 THEN
    v_crash_point := v_settings.fixed_crash_point;
  ELSIF v_settings IS NOT NULL AND v_settings.mode = 'range' AND v_settings.min_crash IS NOT NULL AND v_settings.max_crash IS NOT NULL THEN
    v_crash_point := ROUND((v_settings.min_crash + random() * (v_settings.max_crash - v_settings.min_crash)) * 100) / 100;
  ELSE
    v_rtp := (100 - COALESCE(v_settings.house_edge_percent, 5)) / 100.0;
    v_rand := random();
    IF v_rand < 0.01 THEN
      v_crash_point := 1.00;
    ELSE
      v_crash_point := GREATEST(1.01, LEAST(FLOOR(v_rtp / v_rand * 100) / 100, 1000));
    END IF;
  END IF;

  INSERT INTO public.crash_rounds (game_id, crash_point, server_start_ms)
  VALUES (p_game_id, v_crash_point, v_now_ms)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'game_id', p_game_id,
    'phase', 'waiting',
    'current_multiplier', 1.00,
    'countdown_ms', v_countdown_ms,
    'elapsed_ms', 0,
    'server_start_ms', v_now_ms,
    'server_now_ms', v_now_ms,
    'crash_point', NULL
  );
END;
$$;
