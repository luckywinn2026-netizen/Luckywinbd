-- Seed all app games into games table so Admin can manage them
-- Uses ON CONFLICT DO NOTHING to avoid overwriting existing rows

INSERT INTO public.games (game_id, game_type, name, emoji, sort_order, popular) VALUES
  -- Slot games (20 total)
  ('super-ace', 'slot', 'Super Ace', '🂡', 1, true),
  ('sweet-bonanza', 'slot', 'Boxing King', '🍬', 2, true),
  ('ludo-king', 'ludo', 'Lucky Ludo King', '🎲', 3, true),
  ('money-coming', 'slot', 'Lucky Money Coming', '💰', 4, true),
  ('lucky-777', 'slot', 'Lucky 777', '🎰', 5, false),
  ('tropical-fruits', 'slot', 'Lucky Tropical Fruits', '🍉', 6, false),
  ('golden-book', 'slot', 'Lucky Golden Book', '📕', 7, false),
  ('classic-777', 'slot', 'Lucky Classic 777', '🎲', 8, false),
  ('fruit-party', 'slot', 'Lucky Fruit Party', '🎉', 9, false),
  ('fortune-gems', 'slot', 'Lucky Fortune Gems', '💎', 10, true),
  ('fortune-wheel', 'slot', 'Lucky Fortune Wheel', '🎡', 11, true),
  ('classic-casino', 'slot', 'Lucky Classic Casino', '🃏', 12, true),
  ('color-prediction', 'slot', 'Lucky Color Prediction', '🎨', 13, true),
  ('spin-wheel', 'slot', 'Lucky Spin the Wheel', '🎡', 14, true),
  ('lucky-spin', 'slot', 'Lucky Spin', '✨', 15, true),
  ('lucky-win', 'slot', 'Lucky Win', '🏆', 16, true),
  ('book-of-dead', 'slot', 'Book of Dead', '📖', 17, false),
  ('mega-moolah', 'slot', 'Mega Moolah', '🦁', 18, false),
  ('starburst', 'slot', 'Starburst', '⭐', 19, false),
  ('bike-racing', 'slot', 'Bike Racing', '🏍️', 20, false),
  -- Crash games (6 total)
  ('aviator', 'crash', 'Aviator', '✈️', 1, true),
  ('rocket', 'crash', 'Rocket Crash', '🚀', 2, true),
  ('jet', 'crash', 'Jet Crash', '🛩️', 3, true),
  ('chicken-road', 'crash', 'Chicken Road', '🐔', 4, false),
  ('turbo', 'crash', 'Turbo Crash', '⚡', 5, true),
  ('multi', 'crash', 'Multiplier X', '🔥', 6, true)
ON CONFLICT (game_id) DO NOTHING;
