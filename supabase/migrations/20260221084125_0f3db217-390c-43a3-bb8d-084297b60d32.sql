
-- Game assets table
CREATE TABLE public.game_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('symbol', 'background', 'music')),
  asset_key TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  label TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, asset_type, asset_key)
);

ALTER TABLE public.game_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game assets are publicly readable"
  ON public.game_assets FOR SELECT USING (true);

CREATE POLICY "Admins can insert game assets"
  ON public.game_assets FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game assets"
  ON public.game_assets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game assets"
  ON public.game_assets FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-assets', 'game-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Game assets publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'game-assets');

CREATE POLICY "Admins upload game assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'game-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update game assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'game-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete game assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'game-assets' AND public.has_role(auth.uid(), 'admin'));

-- Trigger
CREATE TRIGGER update_game_assets_updated_at
  BEFORE UPDATE ON public.game_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
