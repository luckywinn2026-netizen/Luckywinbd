
-- Function to get sum of approved deposits (avoids 1000-row client limit)
CREATE OR REPLACE FUNCTION public.get_approved_deposit_total()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM public.deposits WHERE status = 'approved';
$$;

-- Function to get sum of approved withdrawals
CREATE OR REPLACE FUNCTION public.get_approved_withdrawal_total()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM public.withdrawals WHERE status = 'approved';
$$;

-- Function to get game session stats by date range (avoids 1000-row limit)
CREATE OR REPLACE FUNCTION public.get_session_stats_by_range(p_start timestamptz)
RETURNS TABLE(total_bets numeric, total_wins numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(bet_amount), 0) as total_bets, COALESCE(SUM(win_amount), 0) as total_wins 
  FROM public.game_sessions 
  WHERE created_at >= p_start;
$$;

-- Function to get per-game stats by date range
CREATE OR REPLACE FUNCTION public.get_per_game_stats_by_range(p_start timestamptz)
RETURNS TABLE(game_name text, total_bets numeric, total_wins numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(game_name, 'Unknown') as game_name, 
         COALESCE(SUM(bet_amount), 0) as total_bets, 
         COALESCE(SUM(win_amount), 0) as total_wins 
  FROM public.game_sessions 
  WHERE created_at >= p_start
  GROUP BY game_name;
$$;

-- Function to get chart data by range with daily/weekly/monthly bucketing
CREATE OR REPLACE FUNCTION public.get_profit_chart_data(p_start timestamptz, p_period text DEFAULT 'daily')
RETURNS TABLE(bucket_label text, total_bets numeric, total_wins numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN p_period = 'daily' THEN to_char(created_at, 'MM/DD')
      WHEN p_period = 'weekly' THEN 'W' || to_char(date_trunc('week', created_at), 'MM/DD')
      ELSE to_char(created_at, 'YYYY-MM')
    END as bucket_label,
    COALESCE(SUM(bet_amount), 0) as total_bets,
    COALESCE(SUM(win_amount), 0) as total_wins
  FROM public.game_sessions
  WHERE created_at >= p_start
  GROUP BY bucket_label
  ORDER BY MIN(created_at);
$$;
