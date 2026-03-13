-- Fix: Remove double-deduction from withdrawal trigger
-- Balance is already deducted when user submits withdrawal in the frontend (via adjust_wallet_balance RPC)
-- So the trigger should NOT deduct again on approval.
-- Instead, if withdrawal is REJECTED, we should REFUND the balance.

CREATE OR REPLACE FUNCTION public.handle_withdrawal_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If withdrawal is rejected, refund the user's balance (since it was deducted on submission)
  IF (OLD.status = 'pending' OR OLD.status = 'agent_approved') AND NEW.status = 'rejected' THEN
    UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;