
-- Add type column to agent_settlements to differentiate settlement vs commission payment
ALTER TABLE public.agent_settlements ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'settlement';

-- RPC: Admin pays agent commission → records it and resets total_commission
CREATE OR REPLACE FUNCTION public.pay_agent_commission(p_admin_id uuid, p_agent_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_commission numeric;
BEGIN
  IF NOT has_role(p_admin_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get current total_commission
  SELECT total_commission INTO v_commission FROM public.agent_wallets WHERE user_id = p_agent_id;
  IF v_commission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found');
  END IF;
  IF v_commission <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No commission to pay');
  END IF;

  -- Record the commission payment as a settlement entry
  INSERT INTO public.agent_settlements (agent_id, amount, status, type, approved_by, approved_at)
  VALUES (p_agent_id, v_commission, 'approved', 'commission_paid', p_admin_id, now());

  -- Reset total_commission to 0
  UPDATE public.agent_wallets SET total_commission = 0, updated_at = now() WHERE user_id = p_agent_id;

  RETURN jsonb_build_object('success', true, 'amount', v_commission);
END;
$function$;
