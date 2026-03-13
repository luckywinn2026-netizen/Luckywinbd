-- Aggregated per-game stats to avoid heavy full scan of game_sessions (fix for 100k+ rows).
-- Use: get_game_stats(p_game_id) returns one row with total_bets, total_wins.
CREATE OR REPLACE FUNCTION public.get_game_stats(p_game_id text)
RETURNS TABLE(total_bets numeric, total_wins numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    COALESCE(SUM(bet_amount), 0)::numeric AS total_bets,
    COALESCE(SUM(win_amount), 0)::numeric AS total_wins
  FROM public.game_sessions
  WHERE game_id = p_game_id;
$$;

COMMENT ON FUNCTION public.get_game_stats(text) IS 'Per-game aggregated stats for profit margin checks; avoids fetching all rows in app.';
