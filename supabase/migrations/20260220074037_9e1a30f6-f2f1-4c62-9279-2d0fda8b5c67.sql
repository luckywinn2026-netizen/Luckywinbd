
-- Crash game settings table for admin control
CREATE TABLE public.crash_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'fixed', 'range')),
  fixed_crash_point numeric DEFAULT NULL,
  min_crash numeric DEFAULT 1.01,
  max_crash numeric DEFAULT 100,
  house_edge_percent numeric DEFAULT 3,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL
);

ALTER TABLE public.crash_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crash settings"
ON public.crash_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read crash settings"
ON public.crash_settings FOR SELECT
USING (true);

-- Insert default settings
INSERT INTO public.crash_settings (mode, house_edge_percent, min_crash, max_crash)
VALUES ('auto', 3, 1.01, 100);
