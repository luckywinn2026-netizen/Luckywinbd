-- Create a function to get total bets and wins across all games
CREATE OR REPLACE FUNCTION public.get_total_bets_and_wins()
RETURNS TABLE(total_bets numeric, total_wins numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(bet_amount), 0) AS total_bets,
    COALESCE(SUM(win_amount), 0) AS total_wins
  FROM public.game_sessions;
$$;