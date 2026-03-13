
-- RPC to record agent commission atomically (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.record_agent_commission(
  p_agent_id uuid,
  p_commission numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.agent_wallets
  SET total_commission = total_commission + p_commission,
      balance = balance + p_commission,
      updated_at = now()
  WHERE user_id = p_agent_id;
END;
$function$;
