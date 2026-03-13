-- Per-game crash settings + authoritative crash bet settlement

ALTER TABLE public.crash_settings
  ADD COLUMN IF NOT EXISTS game_id text;

DO $$
DECLARE
  v_template RECORD;
BEGIN
  SELECT mode, fixed_crash_point, min_crash, max_crash, house_edge_percent
  INTO v_template
  FROM public.crash_settings
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_template IS NULL THEN
    INSERT INTO public.crash_settings (game_id, mode, fixed_crash_point, min_crash, max_crash, house_edge_percent)
    VALUES ('aviator', 'auto', NULL, 1.01, 100, 3)
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.crash_settings
    SET game_id = COALESCE(game_id, 'aviator')
    WHERE game_id IS NULL;

    INSERT INTO public.crash_settings (game_id, mode, fixed_crash_point, min_crash, max_crash, house_edge_percent)
    SELECT game_id, v_template.mode, v_template.fixed_crash_point, v_template.min_crash, v_template.max_crash, v_template.house_edge_percent
    FROM (
      VALUES ('aviator'), ('rocket'), ('jet'), ('turbo'), ('multi')
    ) AS games(game_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.crash_settings existing
      WHERE existing.game_id = games.game_id
    );
  END IF;
END $$;

ALTER TABLE public.crash_settings
  ALTER COLUMN game_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_settings_game_id
  ON public.crash_settings (game_id);

CREATE TABLE IF NOT EXISTS public.crash_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  round_id uuid NOT NULL REFERENCES public.crash_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username_snapshot text NOT NULL,
  panel_index integer NOT NULL CHECK (panel_index IN (0, 1)),
  bet_amount numeric NOT NULL CHECK (bet_amount > 0),
  auto_cashout numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cashed_out', 'lost', 'cancelled')),
  cashout_multiplier numeric,
  win_amount numeric NOT NULL DEFAULT 0,
  placed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crash_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read crash bets" ON public.crash_bets;
CREATE POLICY "Authenticated can read crash bets"
ON public.crash_bets FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anon can read crash bets" ON public.crash_bets;
CREATE POLICY "Anon can read crash bets"
ON public.crash_bets FOR SELECT
TO anon
USING (true);

CREATE INDEX IF NOT EXISTS idx_crash_bets_game_round
  ON public.crash_bets (game_id, round_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_crash_bets_user_round
  ON public.crash_bets (user_id, round_id, placed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_bets_active_panel
  ON public.crash_bets (round_id, user_id, panel_index)
  WHERE status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crash_bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crash_bets;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_crash_bets_updated_at ON public.crash_bets;
CREATE TRIGGER update_crash_bets_updated_at
BEFORE UPDATE ON public.crash_bets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_crash_game_name(p_game_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_game_id
    WHEN 'aviator' THEN 'Lucky Aviator'
    WHEN 'rocket' THEN 'Lucky Rocket Crash'
    WHEN 'jet' THEN 'Lucky Jet Crash'
    WHEN 'turbo' THEN 'Lucky Turbo Crash'
    WHEN 'multi' THEN 'Multiplier X'
    ELSE initcap(replace(p_game_id, '-', ' '))
  END;
$$;

CREATE OR REPLACE FUNCTION public.settle_crash_round_losses(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

    IF v_now_ms >= v_crash_time_ms THEN
      PERFORM public.settle_crash_round_losses(v_round.id);
    END IF;

    IF v_now_ms < v_round_end_ms THEN
      RETURN jsonb_build_object(
        'id', v_round.id,
        'game_id', v_round.game_id,
        'crash_point', v_round.crash_point,
        'server_start_ms', v_round.server_start_ms,
        'server_now_ms', v_now_ms
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
    'crash_point', v_crash_point,
    'server_start_ms', v_now_ms,
    'server_now_ms', v_now_ms
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.place_crash_bet(
  p_game_id text,
  p_round_id uuid,
  p_user_id uuid,
  p_panel_index integer,
  p_bet_amount numeric,
  p_auto_cashout numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_round RECORD;
  v_current_round_id uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_username text;
  v_points integer;
  v_bet public.crash_bets%ROWTYPE;
BEGIN
  IF p_panel_index NOT IN (0, 1) THEN
    RAISE EXCEPTION 'Invalid panel index';
  END IF;
  IF p_bet_amount < 5 OR p_bet_amount > 10000 THEN
    RAISE EXCEPTION 'Bet amount must be between 5 and 10000';
  END IF;
  IF p_auto_cashout IS NOT NULL AND p_auto_cashout < 1.01 THEN
    RAISE EXCEPTION 'Auto cashout must be at least 1.01x';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crash_bet_' || p_game_id || '_' || p_user_id::text));

  SELECT id
  INTO v_current_round_id
  FROM public.crash_rounds
  WHERE game_id = p_game_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_round_id IS NULL OR v_current_round_id <> p_round_id THEN
    RAISE EXCEPTION 'Round is no longer current';
  END IF;

  SELECT *
  INTO v_round
  FROM public.crash_rounds
  WHERE id = p_round_id
    AND game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crash round not found';
  END IF;

  IF v_now_ms >= v_round.server_start_ms + 10000 THEN
    RAISE EXCEPTION 'Betting closed for this round';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.crash_bets
    WHERE round_id = p_round_id
      AND user_id = p_user_id
      AND panel_index = p_panel_index
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active bet already exists on this panel';
  END IF;

  SELECT balance
  INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  SELECT COALESCE(username, 'Player')
  INTO v_username
  FROM public.profiles
  WHERE user_id = p_user_id;

  UPDATE public.wallets
  SET balance = balance - p_bet_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  v_points := FLOOR(p_bet_amount / 100);
  IF v_points > 0 THEN
    PERFORM public.add_vip_points(p_user_id, v_points, p_bet_amount);
  ELSE
    PERFORM public.add_vip_points(p_user_id, 0, p_bet_amount);
  END IF;

  INSERT INTO public.crash_bets (
    game_id,
    round_id,
    user_id,
    username_snapshot,
    panel_index,
    bet_amount,
    auto_cashout
  )
  VALUES (
    p_game_id,
    p_round_id,
    p_user_id,
    COALESCE(v_username, 'Player'),
    p_panel_index,
    p_bet_amount,
    p_auto_cashout
  )
  RETURNING * INTO v_bet;

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'newBalance', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_crash_bet(
  p_bet_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_bet public.crash_bets%ROWTYPE;
  v_round public.crash_rounds%ROWTYPE;
  v_new_balance numeric;
BEGIN
  SELECT *
  INTO v_bet
  FROM public.crash_bets
  WHERE id = p_bet_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crash bet not found';
  END IF;

  IF v_bet.status <> 'active' THEN
    RAISE EXCEPTION 'Only active bets can be cancelled';
  END IF;

  SELECT *
  INTO v_round
  FROM public.crash_rounds
  WHERE id = v_bet.round_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crash round not found';
  END IF;

  IF v_now_ms >= v_round.server_start_ms + 10000 THEN
    RAISE EXCEPTION 'Bet can no longer be cancelled';
  END IF;

  UPDATE public.crash_bets
  SET status = 'cancelled',
      settled_at = now(),
      updated_at = now()
  WHERE id = v_bet.id
  RETURNING * INTO v_bet;

  UPDATE public.wallets
  SET balance = balance + v_bet.bet_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'newBalance', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cashout_crash_bet(
  p_bet_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_bet public.crash_bets%ROWTYPE;
  v_round public.crash_rounds%ROWTYPE;
  v_fly_start_ms bigint;
  v_crash_delay bigint;
  v_crash_time_ms bigint;
  v_multiplier numeric;
  v_raw_win numeric;
  v_max_win_cap numeric := 1000;
  v_win_amount numeric;
  v_new_balance numeric;
BEGIN
  SELECT *
  INTO v_bet
  FROM public.crash_bets
  WHERE id = p_bet_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crash bet not found';
  END IF;

  IF v_bet.status <> 'active' THEN
    RAISE EXCEPTION 'Crash bet is no longer active';
  END IF;

  SELECT *
  INTO v_round
  FROM public.crash_rounds
  WHERE id = v_bet.round_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crash round not found';
  END IF;

  v_fly_start_ms := v_round.server_start_ms + 10000;
  v_crash_delay := GREATEST(0, (ln(GREATEST(v_round.crash_point::double precision, 1.01)) / 0.00006)::bigint);
  v_crash_time_ms := v_fly_start_ms + v_crash_delay;

  IF v_now_ms < v_fly_start_ms THEN
    RAISE EXCEPTION 'Round has not started yet';
  END IF;

  IF v_now_ms >= v_crash_time_ms THEN
    RAISE EXCEPTION 'Round already crashed';
  END IF;

  SELECT COALESCE(max_win_cap, 1000)
  INTO v_max_win_cap
  FROM public.game_profit_settings
  WHERE game_id = v_bet.game_id
  LIMIT 1;

  v_multiplier := FLOOR(EXP(0.00006 * (v_now_ms - v_fly_start_ms)) * 100) / 100;
  v_raw_win := ROUND(v_bet.bet_amount * v_multiplier);
  v_win_amount := LEAST(v_raw_win, ROUND(v_bet.bet_amount * v_max_win_cap));

  UPDATE public.crash_bets
  SET status = 'cashed_out',
      cashout_multiplier = v_multiplier,
      win_amount = v_win_amount,
      settled_at = now(),
      updated_at = now()
  WHERE id = v_bet.id
  RETURNING * INTO v_bet;

  UPDATE public.wallets
  SET balance = balance + v_win_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

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
    'crash',
    public.get_crash_game_name(v_bet.game_id),
    v_bet.game_id,
    v_bet.bet_amount,
    v_win_amount,
    'win',
    v_multiplier
  );

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'newBalance', v_new_balance,
    'winAmount', v_win_amount,
    'cashoutMultiplier', v_multiplier
  );
END;
$$;
