
-- Add user_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_code text UNIQUE;

-- Function to generate unique user code like LW250587
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := 'LW' || lpad(floor(random() * 1000000)::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$function$;

-- Update handle_new_user to include user_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, phone, refer_code, user_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email, '@', 1)),
    public.generate_refer_code(),
    public.generate_user_code()
  );
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_vip_data (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

-- Backfill existing users who don't have a user_code
UPDATE public.profiles SET user_code = public.generate_user_code() WHERE user_code IS NULL;
