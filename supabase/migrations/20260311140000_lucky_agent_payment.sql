-- Lucky Agent payment flow: telegram link for agents, withdrawal_code for user-facing IDs

-- 1. Add telegram_link to profiles (for agents - deposit via agent opens telegram)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_link text;

-- 2. Add withdrawal_code to withdrawals (unique display ID like LWA254585)
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS withdrawal_code text UNIQUE;

-- 3. Sequence for withdrawal codes
CREATE SEQUENCE IF NOT EXISTS public.withdrawal_code_seq START 1;

-- 4. Function to generate next withdrawal code (LWA + 6 digits)
CREATE OR REPLACE FUNCTION public.generate_withdrawal_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val int;
  code text;
BEGIN
  next_val := nextval('public.withdrawal_code_seq');
  code := 'LWA' || lpad(next_val::text, 6, '0');
  RETURN code;
END;
$$;

-- 5. Trigger to auto-set withdrawal_code on insert
CREATE OR REPLACE FUNCTION public.set_withdrawal_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.withdrawal_code IS NULL OR NEW.withdrawal_code = '' THEN
    NEW.withdrawal_code := public.generate_withdrawal_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_withdrawal_code_trigger ON public.withdrawals;
CREATE TRIGGER set_withdrawal_code_trigger
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_withdrawal_code();

-- 6. Allow authenticated users to view agent profiles (for Lucky Agent selection)
DROP POLICY IF EXISTS "Authenticated can view payment agent profiles" ON public.profiles;
CREATE POLICY "Authenticated can view payment agent profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.user_id AND ur.role = 'payment_agent')
  );

-- 7. Backfill: set codes for existing rows using sequence (run once)
DO $$
DECLARE
  r RECORD;
  next_code text;
BEGIN
  FOR r IN SELECT id FROM public.withdrawals WHERE withdrawal_code IS NULL OR withdrawal_code = '' ORDER BY created_at
  LOOP
    next_code := public.generate_withdrawal_code();
    UPDATE public.withdrawals SET withdrawal_code = next_code WHERE id = r.id;
  END LOOP;
END $$;
