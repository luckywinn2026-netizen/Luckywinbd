
-- Create games table to store game configs and thumbnails
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL DEFAULT 'slot',
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🎰',
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Anyone can read active games
CREATE POLICY "Anyone can view active games" ON public.games FOR SELECT USING (true);

-- Admins can manage games
CREATE POLICY "Admins can manage games" ON public.games FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for game thumbnails
INSERT INTO storage.buckets (id, name, public) VALUES ('game-thumbnails', 'game-thumbnails', true);

-- Storage policies
CREATE POLICY "Game thumbnails are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'game-thumbnails');
CREATE POLICY "Admins can upload game thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'game-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update game thumbnails" ON storage.objects FOR UPDATE USING (bucket_id = 'game-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete game thumbnails" ON storage.objects FOR DELETE USING (bucket_id = 'game-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

-- Seed all 10 slot games + 5 crash games
INSERT INTO public.games (game_id, game_type, name, emoji, sort_order) VALUES
  ('super-ace', 'slot', 'Super Ace', '🂡', 1),
  ('sweet-bonanza', 'slot', 'Sweet Bonanza', '🍬', 2),
  ('book-of-dead', 'slot', 'Book of Dead', '📖', 3),
  ('lucky-777', 'slot', 'Lucky 777', '🎰', 4),
  ('tropical-fruits', 'slot', 'Tropical Fruits', '🍉', 5),
  ('golden-book', 'slot', 'Golden Book', '📕', 6),
  ('classic-777', 'slot', 'Classic 777', '🎲', 7),
  ('fruit-party', 'slot', 'Fruit Party', '🎉', 8),
  ('mega-moolah', 'slot', 'Mega Moolah', '🦁', 9),
  ('starburst', 'slot', 'Starburst', '⭐', 10),
  ('aviator', 'crash', 'Aviator', '✈️', 1),
  ('rocket', 'crash', 'Rocket Crash', '🚀', 2),
  ('jet', 'crash', 'Jet Crash', '🛩️', 3),
  ('turbo', 'crash', 'Turbo Crash', '⚡', 4),
  ('multi', 'crash', 'Multiplier X', '🔥', 5);
