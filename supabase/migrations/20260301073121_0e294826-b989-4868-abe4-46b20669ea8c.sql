
-- Add assigned_agent_id column to withdrawals (like deposits)
ALTER TABLE public.withdrawals ADD COLUMN assigned_agent_id uuid;

-- RLS: Payment agents can view only their assigned withdrawals
CREATE POLICY "Payment agents can view assigned withdrawals"
ON public.withdrawals FOR SELECT
USING (has_role(auth.uid(), 'payment_agent'::app_role) AND assigned_agent_id = auth.uid());

-- RLS: Payment agents can update only their assigned withdrawals
CREATE POLICY "Payment agents can update assigned withdrawals"
ON public.withdrawals FOR UPDATE
USING (has_role(auth.uid(), 'payment_agent'::app_role) AND assigned_agent_id = auth.uid());
