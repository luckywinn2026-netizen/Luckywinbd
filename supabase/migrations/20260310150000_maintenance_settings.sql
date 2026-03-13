-- Site-wide maintenance + per-game maintenance for development
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage site_settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_settings (key, value) VALUES
  ('maintenance', jsonb_build_object('app_under_maintenance', false, 'message', 'We are currently under maintenance. Please check back soon.'))
ON CONFLICT (key) DO NOTHING;

-- Per-game maintenance
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS under_maintenance boolean NOT NULL DEFAULT false;
