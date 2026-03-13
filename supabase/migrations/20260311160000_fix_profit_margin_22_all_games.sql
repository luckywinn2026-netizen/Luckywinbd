-- Fix: All games should use profit_margin 22% (RTP 78%) and loss_rate 48%
-- Previous migrations left many games with loss_rate 85 (RTP ~15%). This corrects that.

UPDATE public.game_profit_settings
SET
  profit_margin = 22,
  loss_rate = 48,
  small_win_pool_pct = 32,
  medium_win_pool_pct = 22,
  big_win_pool_pct = 10,
  jackpot_pool_pct = 6,
  max_win_cap = 200,
  jackpot_cooldown_hours = 48,
  big_win_cooldown_hours = 24,
  small_win_pct = 36,
  medium_win_pct = 12,
  big_win_pct = 3,
  jackpot_win_pct = 0.8,
  updated_at = now()
WHERE profit_margin != 22 OR loss_rate != 48;

-- Add any missing slot/ludo games with correct defaults (games that use calculateOutcome)
INSERT INTO public.game_profit_settings (
  game_id, game_name, profit_margin, max_win_multiplier, loss_rate,
  small_win_pool_pct, medium_win_pool_pct, big_win_pool_pct, jackpot_pool_pct,
  max_win_cap, jackpot_cooldown_hours, big_win_cooldown_hours,
  small_win_pct, medium_win_pct, big_win_pct, jackpot_win_pct
) VALUES
  ('super-ace', 'Super Ace', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('sweet-bonanza', 'Boxing King', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('ludo-king', 'Lucky Ludo King', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('money-coming', 'Lucky Money Coming', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('lucky-777', 'Lucky 777', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('tropical-fruits', 'Lucky Tropical Fruits', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('golden-book', 'Lucky Golden Book', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('classic-777', 'Lucky Classic 777', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('fruit-party', 'Lucky Fruit Party', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('fortune-gems', 'Lucky Fortune Gems', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('fortune-wheel', 'Lucky Fortune Wheel', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('classic-casino', 'Lucky Classic Casino', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('color-prediction', 'Lucky Color Prediction', 22, 9, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('spin-wheel', 'Lucky Spin the Wheel', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('lucky-spin', 'Lucky Spin', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('lucky-win', 'Lucky Win', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('book-of-dead', 'Book of Dead', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('mega-moolah', 'Mega Moolah', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('starburst', 'Starburst', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8),
  ('bike-racing', 'Bike Racing', 22, 25, 48, 32, 22, 10, 6, 200, 48, 24, 36, 12, 3, 0.8)
ON CONFLICT (game_id) DO UPDATE SET
  profit_margin = 22,
  loss_rate = 48,
  small_win_pool_pct = 32,
  medium_win_pool_pct = 22,
  big_win_pool_pct = 10,
  jackpot_pool_pct = 6,
  max_win_cap = 200,
  jackpot_cooldown_hours = 48,
  big_win_cooldown_hours = 24,
  small_win_pct = 36,
  medium_win_pct = 12,
  big_win_pct = 3,
  jackpot_win_pct = 0.8,
  updated_at = now();
