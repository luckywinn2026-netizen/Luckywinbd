
CREATE OR REPLACE FUNCTION public.approve_agent_settlement(p_settlement_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount numeric;
  v_agent_id uuid;
  v_status text;
BEGIN
  SELECT amount, agent_id, status INTO v_amount, v_agent_id, v_status
  FROM public.agent_settlements WHERE id = p_settlement_id;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Settlement already processed';
  END IF;

  -- Deduct from agent balance AND reset total_commission to 0
  UPDATE public.agent_wallets
  SET balance = balance - v_amount, 
      total_commission = 0,
      updated_at = now()
  WHERE user_id = v_agent_id;

  -- Mark settlement as approved
  UPDATE public.agent_settlements
  SET status = 'approved', approved_at = now(), approved_by = p_admin_id, updated_at = now()
  WHERE id = p_settlement_id;
END;
$function$;
