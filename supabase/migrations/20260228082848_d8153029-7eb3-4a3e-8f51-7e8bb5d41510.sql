
-- Table for agent payment settlements to app owner
CREATE TABLE public.agent_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  note text,
  approved_at timestamp with time zone,
  approved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all settlements"
ON public.agent_settlements FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Payment agents can insert own settlements"
ON public.agent_settlements FOR INSERT
WITH CHECK (auth.uid() = agent_id AND has_role(auth.uid(), 'payment_agent'::app_role));

CREATE POLICY "Payment agents can view own settlements"
ON public.agent_settlements FOR SELECT
USING (auth.uid() = agent_id);

-- RPC to approve settlement and deduct agent balance
CREATE OR REPLACE FUNCTION public.approve_agent_settlement(p_settlement_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Deduct from agent balance
  UPDATE public.agent_wallets
  SET balance = balance - v_amount, updated_at = now()
  WHERE user_id = v_agent_id;

  -- Mark settlement as approved
  UPDATE public.agent_settlements
  SET status = 'approved', approved_at = now(), approved_by = p_admin_id, updated_at = now()
  WHERE id = p_settlement_id;
END;
$$;
