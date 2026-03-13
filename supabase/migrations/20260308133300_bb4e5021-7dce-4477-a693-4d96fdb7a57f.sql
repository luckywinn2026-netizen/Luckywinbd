
CREATE TABLE public.crash_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  crash_point numeric NOT NULL,
  server_start_ms bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read crash rounds" ON public.crash_rounds
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read crash rounds" ON public.crash_rounds
FOR SELECT TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.crash_rounds;

CREATE INDEX idx_crash_rounds_game_latest ON public.crash_rounds(game_id, created_at DESC);

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
  v_round_end_ms bigint;
  v_new_id uuid;
  v_crash_point numeric;
  v_settings RECORD;
  v_rtp numeric;
  v_rand numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('crash_round_' || p_game_id));
  v_now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  SELECT * INTO v_round FROM public.crash_rounds
  WHERE game_id = p_game_id ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    v_crash_delay := GREATEST(0, (ln(GREATEST(v_round.crash_point::double precision, 1.01)) / 0.00006)::bigint);
    v_round_end_ms := v_round.server_start_ms + v_countdown_ms + v_crash_delay + v_pause_ms;
    IF v_now_ms < v_round_end_ms THEN
      RETURN jsonb_build_object(
        'id', v_round.id, 'game_id', v_round.game_id,
        'crash_point', v_round.crash_point,
        'server_start_ms', v_round.server_start_ms,
        'server_now_ms', v_now_ms
      );
    END IF;
  END IF;

  SELECT * INTO v_settings FROM public.crash_settings LIMIT 1;

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
    'id', v_new_id, 'game_id', p_game_id,
    'crash_point', v_crash_point,
    'server_start_ms', v_now_ms,
    'server_now_ms', v_now_ms
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_crash_rounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.crash_rounds
  WHERE game_id = NEW.game_id
  AND created_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_crash_rounds_trigger
AFTER INSERT ON public.crash_rounds
FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_crash_rounds();
