
-- Add agent tracking columns to deposits
ALTER TABLE public.deposits 
ADD COLUMN IF NOT EXISTS reviewed_by_agent uuid,
ADD COLUMN IF NOT EXISTS agent_approved_at timestamptz;

-- Allow payment agents to view all pending deposits
CREATE POLICY "Payment agents can view pending deposits"
ON public.deposits
FOR SELECT
USING (has_role(auth.uid(), 'payment_agent'::app_role));

-- Allow payment agents to update deposit status (pending -> agent_approved)
CREATE POLICY "Payment agents can update pending deposits"
ON public.deposits
FOR UPDATE
USING (has_role(auth.uid(), 'payment_agent'::app_role));

-- Enable realtime for deposits
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
