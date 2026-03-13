
-- Table to store 4th reel multiplier probabilities (admin-controlled)
CREATE TABLE public.multiplier_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pct_1x numeric NOT NULL DEFAULT 90,
  pct_2x_25x numeric NOT NULL DEFAULT 5,
  pct_100x_500x numeric NOT NULL DEFAULT 2,
  pct_wild numeric NOT NULL DEFAULT 2,
  pct_scatter numeric NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.multiplier_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can manage multiplier settings"
  ON public.multiplier_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone authenticated can read (games need to fetch)
CREATE POLICY "Anyone can read multiplier settings"
  ON public.multiplier_settings FOR SELECT
  USING (true);

-- Insert default row
INSERT INTO public.multiplier_settings (pct_1x, pct_2x_25x, pct_100x_500x, pct_wild, pct_scatter)
VALUES (90, 5, 2, 2, 1);
