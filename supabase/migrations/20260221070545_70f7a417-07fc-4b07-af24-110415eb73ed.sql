
-- 1. Add unique refer_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS refer_code text UNIQUE;

-- 2. Create function to generate short unique refer code
CREATE OR REPLACE FUNCTION public.generate_refer_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := 'LW' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE refer_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- 3. Generate refer codes for all existing users who don't have one
UPDATE public.profiles SET refer_code = public.generate_refer_code() WHERE refer_code IS NULL;

-- 4. Update handle_new_user to auto-generate refer_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, refer_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), public.generate_refer_code());
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

-- 5. Create referrals table
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  bonus_earned numeric NOT NULL DEFAULT 0,
  bonus_cap numeric NOT NULL DEFAULT 12500,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals as referrer"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referral as referred"
ON public.referrals FOR SELECT
USING (auth.uid() = referred_id);

CREATE POLICY "System can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referred_id);

CREATE POLICY "Admins can view all referrals"
ON public.referrals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage referrals"
ON public.referrals FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Update deposit approval trigger to give referral bonus (50% up to ৳12,500 total)
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ref_record RECORD;
  bonus_amount numeric;
  remaining_cap numeric;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    -- Credit depositor with 2.5% bonus
    UPDATE public.wallets SET balance = balance + NEW.amount + ROUND(NEW.amount * 0.025, 2), updated_at = now() WHERE user_id = NEW.user_id;
    
    -- Check if this user was referred by someone
    SELECT * INTO ref_record FROM public.referrals WHERE referred_id = NEW.user_id AND bonus_earned < bonus_cap LIMIT 1;
    
    IF FOUND THEN
      -- Calculate 50% of deposit, capped at remaining allowance
      remaining_cap := ref_record.bonus_cap - ref_record.bonus_earned;
      bonus_amount := LEAST(ROUND(NEW.amount * 0.5, 2), remaining_cap);
      
      IF bonus_amount > 0 THEN
        -- Credit referrer wallet
        UPDATE public.wallets SET balance = balance + bonus_amount, updated_at = now() WHERE user_id = ref_record.referrer_id;
        
        -- Update referral bonus earned
        UPDATE public.referrals SET bonus_earned = bonus_earned + bonus_amount, status = 'active', updated_at = now() WHERE id = ref_record.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for updated_at on referrals
CREATE TRIGGER update_referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
