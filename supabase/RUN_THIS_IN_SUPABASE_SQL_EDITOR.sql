-- ============================================================
-- Copy this ENTIRE file and run in Supabase Dashboard → SQL Editor
-- Project: cjiqtfkkmtggntihcwgi.supabase.co
-- ============================================================

-- 1. Create table
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

-- 2. Drop old policies if any, then create
DROP POLICY IF EXISTS "Anyone can view active promo banners" ON public.promo_banners;
DROP POLICY IF EXISTS "Admins can view all promo banners" ON public.promo_banners;
DROP POLICY IF EXISTS "Admins can manage promo banners" ON public.promo_banners;

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

-- 3. Trigger
DROP TRIGGER IF EXISTS update_promo_banners_updated_at ON public.promo_banners;
CREATE TRIGGER update_promo_banners_updated_at
BEFORE UPDATE ON public.promo_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies
DROP POLICY IF EXISTS "Promo banners are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload promo banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update promo banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete promo banners" ON storage.objects;

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

-- ============================================================
-- Lucky Agent Payment (telegram_link, withdrawal_code)
-- Run this section if not already applied via migrations
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_link text;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS withdrawal_code text UNIQUE;
CREATE SEQUENCE IF NOT EXISTS public.withdrawal_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_withdrawal_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE next_val int; code text;
BEGIN
  next_val := nextval('public.withdrawal_code_seq');
  code := 'LWA' || lpad(next_val::text, 6, '0');
  RETURN code;
END; $$;

CREATE OR REPLACE FUNCTION public.set_withdrawal_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.withdrawal_code IS NULL OR NEW.withdrawal_code = '' THEN
    NEW.withdrawal_code := public.generate_withdrawal_code();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_withdrawal_code_trigger ON public.withdrawals;
CREATE TRIGGER set_withdrawal_code_trigger
  BEFORE INSERT ON public.withdrawals FOR EACH ROW
  EXECUTE FUNCTION public.set_withdrawal_code();

DROP POLICY IF EXISTS "Authenticated can view payment agent profiles" ON public.profiles;
CREATE POLICY "Authenticated can view payment agent profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.user_id AND ur.role = 'payment_agent'));

-- ============================================================
-- Backfill profiles for approved agents (e.g. Bitul Mia)
-- Run this to fix agents not showing in Payment Agents list
-- ============================================================
INSERT INTO public.profiles (user_id, username, phone, refer_code, user_code)
SELECT
  u.id,
  aa.name,
  aa.phone,
  public.generate_refer_code(),
  public.generate_user_code()
FROM auth.users u
JOIN public.agent_applications aa
  ON u.email = regexp_replace(aa.phone, '[^0-9]', '', 'g') || '@luckywin.app'
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'payment_agent'
WHERE aa.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

-- Sync name/phone for agents who already have profile
UPDATE public.profiles p SET username = aa.name, phone = aa.phone
FROM auth.users u
JOIN public.agent_applications aa ON u.email = regexp_replace(aa.phone, '[^0-9]', '', 'g') || '@luckywin.app'
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'payment_agent'
WHERE aa.status = 'approved' AND p.user_id = u.id;

-- ============================================================
-- Daily Spin: get_daily_spin_status RPC (for backend /api/rpc)
-- Run this for daily spin to work via backend
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_spin_status(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_last_spin_at timestamptz; v_can_spin boolean; v_next_spin_at timestamptz;
BEGIN
  SELECT last_spin_at INTO v_last_spin_at FROM public.user_vip_data WHERE user_id = p_user_id;
  IF v_last_spin_at IS NULL THEN v_can_spin := true; v_next_spin_at := NULL;
  ELSIF v_last_spin_at > now() - interval '24 hours' THEN v_can_spin := false; v_next_spin_at := v_last_spin_at + interval '24 hours';
  ELSE v_can_spin := true; v_next_spin_at := NULL;
  END IF;
  RETURN json_build_object('canSpin', v_can_spin, 'lastSpinAt', v_last_spin_at, 'nextSpinAt', v_next_spin_at);
END;
$$;

-- ============================================================
-- Agent Deposit Management: show user ID (LW02545) instead of Unknown
-- Payment agents need to view profiles of deposit users
-- ============================================================
DROP POLICY IF EXISTS "Payment agents can view deposit user profiles" ON public.profiles;
CREATE POLICY "Payment agents can view deposit user profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'payment_agent'::app_role));
