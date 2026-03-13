-- Slot win distribution: frequent small, less medium, less big, rare mega. House profit safe (admin-controlled).
-- Backend uses these when game_profit_settings has a row; else uses code DEFAULT_SETTINGS with same logic.
-- Add any missing games so every slot/crash/ludo has admin-editable settings.

INSERT INTO public.game_profit_settings (
  game_id, game_name, profit_margin, max_win_multiplier, loss_rate,
  small_win_pool_pct, medium_win_pool_pct, big_win_pool_pct, jackpot_pool_pct,
  max_win_cap, jackpot_cooldown_hours, big_win_cooldown_hours,
  small_win_pct, medium_win_pct, big_win_pct, jackpot_win_pct
) VALUES
  ('super-ace', 'Super Ace', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('lucky-spin', 'Lucky Spin', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('lucky-win', 'Lucky Win', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('fortune-gems', 'Fortune Gems', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('fortune-wheel', 'Fortune Wheel', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('classic-casino', 'Classic Casino', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('spin-wheel', 'Spin Wheel', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('bike-racing', 'Bike Racing', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('turbo', 'Turbo Crash', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('multi', 'Multiplier X', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('color-prediction', 'Color Prediction', 22, 9, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8)
ON CONFLICT (game_id) DO NOTHING;

-- Optionally set recommended defaults for existing games (only if you want to reset; comment out if admins already tuned)
-- UPDATE public.game_profit_settings SET
--   profit_margin = 22, loss_rate = 48,
--   small_win_pct = 36, medium_win_pct = 12, big_win_pct = 3, jackpot_win_pct = 0.8,
--   small_win_pool_pct = 32, medium_win_pool_pct = 22, big_win_pool_pct = 10, jackpot_pool_pct = 6
-- WHERE game_id IN ('lucky-777','classic-777','fruit-party','sweet-bonanza','sweet-bonanza-2','golden-book','book-of-dead','starburst','mega-moolah','money-coming','tropical-fruits','aviator','rocket','jet','chicken-road','ludo-king');
