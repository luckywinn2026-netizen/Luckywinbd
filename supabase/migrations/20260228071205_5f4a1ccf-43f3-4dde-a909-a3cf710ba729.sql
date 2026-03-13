
-- Table to store agent-specific payment numbers
CREATE TABLE public.agent_payment_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  payment_method text NOT NULL,
  number text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_payment_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agent payment numbers"
  ON public.agent_payment_numbers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Payment agents can view own numbers"
  ON public.agent_payment_numbers FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Authenticated users can view active numbers"
  ON public.agent_payment_numbers FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Add assigned_agent_id to deposits table
ALTER TABLE public.deposits ADD COLUMN assigned_agent_id uuid;

-- Update RLS: payment agents can only see deposits assigned to them
DROP POLICY IF EXISTS "Payment agents can view pending deposits" ON public.deposits;
CREATE POLICY "Payment agents can view assigned deposits"
  ON public.deposits FOR SELECT
  USING (has_role(auth.uid(), 'payment_agent'::app_role) AND assigned_agent_id = auth.uid());

DROP POLICY IF EXISTS "Payment agents can update pending deposits" ON public.deposits;
CREATE POLICY "Payment agents can update assigned deposits"
  ON public.deposits FOR UPDATE
  USING (has_role(auth.uid(), 'payment_agent'::app_role) AND assigned_agent_id = auth.uid());
