-- Add agent review fields to withdrawals (matching deposits pattern)
ALTER TABLE public.withdrawals 
  ADD COLUMN reviewed_by_agent uuid,
  ADD COLUMN agent_approved_at timestamptz;

-- Create separate withdraw commission settings
CREATE TABLE public.agent_withdraw_commission_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  per_amount numeric NOT NULL DEFAULT 1000,
  commission numeric NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.agent_withdraw_commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage withdraw commission settings"
  ON public.agent_withdraw_commission_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Payment agents can view withdraw commission settings"
  ON public.agent_withdraw_commission_settings FOR SELECT
  USING (has_role(auth.uid(), 'payment_agent'::app_role));

-- Insert default settings
INSERT INTO public.agent_withdraw_commission_settings (per_amount, commission) VALUES (1000, 4);

-- Track agent-processed withdrawals (like agent_deposits)
CREATE TABLE public.agent_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agent withdrawals"
  ON public.agent_withdrawals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Payment agents can insert withdrawals"
  ON public.agent_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = agent_id AND has_role(auth.uid(), 'payment_agent'::app_role));

CREATE POLICY "Payment agents can view own withdrawals"
  ON public.agent_withdrawals FOR SELECT
  USING (auth.uid() = agent_id);

-- Update withdrawal approval trigger to handle agent_approved step
CREATE OR REPLACE FUNCTION public.handle_withdrawal_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.status = 'pending' OR OLD.status = 'agent_approved') AND NEW.status = 'approved' THEN
    UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Enable realtime for withdrawals
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;