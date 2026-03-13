
-- 1. Create a summary table to cache total bets and wins (avoids full table scan)
CREATE TABLE public.game_stats_summary (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_bets numeric NOT NULL DEFAULT 0,
  total_wins numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Initialize with current data
INSERT INTO public.game_stats_summary (id, total_bets, total_wins)
SELECT 1, COALESCE(SUM(bet_amount), 0), COALESCE(SUM(win_amount), 0)
FROM public.game_sessions;

-- Enable RLS
ALTER TABLE public.game_stats_summary ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed by edge function via service role anyway)
CREATE POLICY "Anyone can read game stats summary"
  ON public.game_stats_summary FOR SELECT USING (true);

-- Only admins can manually update
CREATE POLICY "Admins can manage game stats summary"
  ON public.game_stats_summary FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create trigger to auto-update summary on every game_sessions INSERT
CREATE OR REPLACE FUNCTION public.update_game_stats_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.game_stats_summary
  SET total_bets = total_bets + NEW.bet_amount,
      total_wins = total_wins + NEW.win_amount,
      updated_at = now()
  WHERE id = 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_game_stats_summary
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_game_stats_summary();

-- 3. Replace the old get_total_bets_and_wins to read from summary table (O(1) instead of full scan)
CREATE OR REPLACE FUNCTION public.get_total_bets_and_wins()
RETURNS TABLE(total_bets numeric, total_wins numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT total_bets, total_wins FROM public.game_stats_summary WHERE id = 1;
$$;

-- 4. Add index on game_sessions for user spin count query
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON public.game_sessions(user_id);

-- 5. Add index on profiles for forced_result lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- 6. Add index on active_players for cleanup
CREATE INDEX IF NOT EXISTS idx_active_players_user_id_game ON public.active_players(user_id, game_name);
