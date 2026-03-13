-- Promo banners for home page (admin-managed)
CREATE TABLE IF NOT EXISTS public.promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promo banners"
ON public.promo_banners FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all promo banners"
ON public.promo_banners FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage promo banners"
ON public.promo_banners FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_promo_banners_updated_at
BEFORE UPDATE ON public.promo_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for promo banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Promo banners are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'promo-banners');

CREATE POLICY "Admins can upload promo banners"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'promo-banners' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update promo banners"
ON storage.objects FOR UPDATE
USING (bucket_id = 'promo-banners' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete promo banners"
ON storage.objects FOR DELETE
USING (bucket_id = 'promo-banners' AND public.has_role(auth.uid(), 'admin'::app_role));
