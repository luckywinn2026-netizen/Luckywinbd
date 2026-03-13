
CREATE OR REPLACE FUNCTION public.record_agent_commission(
  p_agent_id uuid,
  p_commission numeric,
  p_deposit_amount numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- balance += (deposit_amount - commission) = money agent owes to app owner
  -- total_commission += commission = agent's earnings
  UPDATE public.agent_wallets
  SET total_commission = total_commission + p_commission,
      balance = balance + (p_deposit_amount - p_commission),
      total_deposited = total_deposited + p_deposit_amount,
      updated_at = now()
  WHERE user_id = p_agent_id;
END;
$function$;
