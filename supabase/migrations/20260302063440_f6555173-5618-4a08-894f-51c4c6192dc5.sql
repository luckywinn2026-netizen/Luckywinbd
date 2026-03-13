
-- Table for admin-managed fake mega wins (shown on leaderboard + live ticker)
CREATE TABLE public.fake_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  win_amount numeric NOT NULL DEFAULT 0,
  game_name text NOT NULL DEFAULT 'Aviator',
  is_active boolean NOT NULL DEFAULT true,
  show_on_ticker boolean NOT NULL DEFAULT true,
  show_on_leaderboard boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fake_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fake wins"
  ON public.fake_wins FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active fake wins"
  ON public.fake_wins FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Update get_leaderboard to merge fake wins
CREATE OR REPLACE FUNCTION public.get_leaderboard(time_range text DEFAULT 'weekly'::text)
 RETURNS TABLE(user_id uuid, username text, total_winnings numeric, total_games bigint, top_game text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH real_stats AS (
    SELECT
      gs.user_id,
      SUM(gs.win_amount) as total_winnings,
      COUNT(*) as total_games,
      (SELECT gs2.game_name FROM public.game_sessions gs2 
       WHERE gs2.user_id = gs.user_id 
       GROUP BY gs2.game_name 
       ORDER BY SUM(gs2.win_amount) DESC 
       LIMIT 1) as top_game
    FROM public.game_sessions gs
    WHERE 
      CASE WHEN time_range = 'weekly' 
        THEN gs.created_at >= now() - interval '7 days'
        ELSE true
      END
    GROUP BY gs.user_id
    HAVING SUM(gs.win_amount) > 0
  ),
  fake_stats AS (
    SELECT
      fw.id as user_id,
      fw.win_amount as total_winnings,
      (floor(random() * 30) + 5)::bigint as total_games,
      fw.game_name as top_game
    FROM public.fake_wins fw
    WHERE fw.is_active = true AND fw.show_on_leaderboard = true
  ),
  combined AS (
    SELECT rs.user_id, COALESCE(p.username, 'Player') as username, rs.total_winnings, rs.total_games, COALESCE(rs.top_game, '-') as top_game
    FROM real_stats rs
    LEFT JOIN public.profiles p ON p.user_id = rs.user_id
    UNION ALL
    SELECT fs.user_id, fw.username, fs.total_winnings, fs.total_games, fs.top_game
    FROM fake_stats fs
    JOIN public.fake_wins fw ON fw.id = fs.user_id
  )
  SELECT c.user_id, c.username, c.total_winnings, c.total_games, c.top_game
  FROM combined c
  ORDER BY c.total_winnings DESC
  LIMIT 20;
$function$;
