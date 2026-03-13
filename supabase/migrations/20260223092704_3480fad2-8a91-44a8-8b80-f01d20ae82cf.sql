
-- Per-game profit margin settings
CREATE TABLE public.game_profit_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id text NOT NULL UNIQUE,
  game_name text NOT NULL,
  profit_margin numeric NOT NULL DEFAULT 15,
  min_profit_margin numeric NOT NULL DEFAULT 10,
  max_win_multiplier numeric NOT NULL DEFAULT 25,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.game_profit_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage game profit settings"
ON public.game_profit_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read (needed by edge function via service role, and for display)
CREATE POLICY "Anyone can read game profit settings"
ON public.game_profit_settings FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_game_profit_settings_updated_at
BEFORE UPDATE ON public.game_profit_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings for existing games
INSERT INTO public.game_profit_settings (game_id, game_name, profit_margin) VALUES
  ('lucky-777', 'Lucky 777', 15),
  ('classic-777', 'Classic 777', 15),
  ('fruit-party', 'Fruit Party', 15),
  ('sweet-bonanza', 'Sweet Bonanza', 15),
  ('sweet-bonanza-2', 'Sweet Bonanza 2', 15),
  ('golden-book', 'Golden Book', 15),
  ('book-of-dead', 'Book of Dead', 15),
  ('starburst', 'Starburst', 15),
  ('mega-moolah', 'Mega Moolah', 15),
  ('money-coming', 'Money Coming', 15),
  ('tropical-fruits', 'Tropical Fruits', 15),
  ('aviator', 'Aviator', 15),
  ('rocket', 'Rocket Crash', 15),
  ('jet', 'Jet Crash', 15),
  ('chicken-road', 'Chicken Road', 15),
  ('ludo-king', 'Ludo King', 15);
