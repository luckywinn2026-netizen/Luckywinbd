
-- Atomic function to adjust wallet balance (prevents race conditions)
CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_balance numeric;
BEGIN
  UPDATE public.wallets 
  SET balance = GREATEST(0, balance + p_amount), updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO new_balance;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  RETURN new_balance;
END;
$$;
