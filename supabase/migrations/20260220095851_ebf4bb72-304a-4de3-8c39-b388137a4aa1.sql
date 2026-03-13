
-- Update deposit approval trigger to add 2.5% bonus
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.wallets 
    SET balance = balance + NEW.amount + ROUND(NEW.amount * 0.025, 2), 
        updated_at = now() 
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Enable realtime on wallets table
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
