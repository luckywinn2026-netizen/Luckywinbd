
-- crash_settings and multiplier_settings need authenticated read for game logic
-- (game_profit_settings stays admin-only - only used in admin pages)

CREATE POLICY "Authenticated users can read crash settings"
  ON public.crash_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read multiplier settings"
  ON public.multiplier_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);
