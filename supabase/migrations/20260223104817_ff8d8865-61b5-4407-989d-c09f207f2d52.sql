
-- 1. crash_settings: remove public read, keep admin-only
DROP POLICY IF EXISTS "Anyone can read crash settings" ON public.crash_settings;

-- 2. multiplier_settings: remove public read, keep admin-only
DROP POLICY IF EXISTS "Anyone can read multiplier settings" ON public.multiplier_settings;

-- 3. game_profit_settings: remove public read, keep admin-only
DROP POLICY IF EXISTS "Anyone can read game profit settings" ON public.game_profit_settings;

-- 4. game_stats_summary: remove public read, add authenticated-only read
DROP POLICY IF EXISTS "Anyone can read game stats summary" ON public.game_stats_summary;
CREATE POLICY "Authenticated users can read game stats summary"
  ON public.game_stats_summary FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. payment_methods: remove public read, add authenticated-only read (hides from anonymous)
DROP POLICY IF EXISTS "Anyone can view active payment methods" ON public.payment_methods;
CREATE POLICY "Authenticated users can view active payment methods"
  ON public.payment_methods FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- 6. game_sessions: remove the "all sessions" policy, keep own-user and admin
DROP POLICY IF EXISTS "Authenticated users can view all sessions" ON public.game_sessions;
