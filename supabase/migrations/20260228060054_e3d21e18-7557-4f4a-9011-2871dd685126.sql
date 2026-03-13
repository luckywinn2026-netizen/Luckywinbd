-- Fix: handle_deposit_approval should also fire when status changes from agent_approved to approved
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref_record RECORD;
  bonus_amount numeric;
  remaining_cap numeric;
BEGIN
  IF (OLD.status = 'pending' OR OLD.status = 'agent_approved') AND NEW.status = 'approved' THEN
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
$function$;