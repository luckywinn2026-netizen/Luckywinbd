
-- Agent wallets
CREATE TABLE public.agent_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_deposited numeric NOT NULL DEFAULT 0,
  total_commission numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage agent wallets" ON public.agent_wallets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Payment agents can view own wallet" ON public.agent_wallets FOR SELECT USING (auth.uid() = user_id);

-- Agent commission settings
CREATE TABLE public.agent_commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  per_amount numeric NOT NULL DEFAULT 1000,
  commission numeric NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.agent_commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage commission settings" ON public.agent_commission_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Payment agents can view commission settings" ON public.agent_commission_settings FOR SELECT USING (has_role(auth.uid(), 'payment_agent'::app_role));
INSERT INTO public.agent_commission_settings (per_amount, commission) VALUES (1000, 4);

-- Agent deposits log
CREATE TABLE public.agent_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage agent deposits" ON public.agent_deposits FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Payment agents can view own deposits" ON public.agent_deposits FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Payment agents can insert deposits" ON public.agent_deposits FOR INSERT WITH CHECK (auth.uid() = agent_id AND has_role(auth.uid(), 'payment_agent'::app_role));

-- Atomic agent deposit function
CREATE OR REPLACE FUNCTION public.process_agent_deposit(
  p_agent_id uuid, p_user_code text, p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_agent_balance numeric; v_commission_rate numeric;
  v_per_amount numeric; v_commission numeric; v_new_agent_balance numeric; v_new_user_balance numeric;
BEGIN
  IF p_amount < 100 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum deposit ৳100'); END IF;
  IF NOT has_role(p_agent_id, 'payment_agent'::app_role) THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;

  SELECT user_id INTO v_user_id FROM public.profiles WHERE user_code = p_user_code;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'User not found: ' || p_user_code); END IF;
  IF v_user_id = p_agent_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot deposit to own account'); END IF;

  SELECT balance INTO v_agent_balance FROM public.agent_wallets WHERE user_id = p_agent_id FOR UPDATE;
  IF v_agent_balance IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found'); END IF;
  IF v_agent_balance < p_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance: ৳' || v_agent_balance); END IF;

  SELECT per_amount, commission INTO v_per_amount, v_commission_rate FROM public.agent_commission_settings LIMIT 1;
  v_commission := ROUND((p_amount / COALESCE(NULLIF(v_per_amount,0),1000)) * COALESCE(v_commission_rate,4), 2);

  UPDATE public.agent_wallets SET balance = balance - p_amount + v_commission, total_deposited = total_deposited + p_amount, total_commission = total_commission + v_commission, updated_at = now() WHERE user_id = p_agent_id RETURNING balance INTO v_new_agent_balance;
  UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
  IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

  INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, v_commission);

  RETURN jsonb_build_object('success', true, 'agent_balance', v_new_agent_balance, 'commission', v_commission, 'amount', p_amount);
END;
$function$;

-- Admin load agent balance
CREATE OR REPLACE FUNCTION public.load_agent_balance(p_agent_user_id uuid, p_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_new_balance numeric;
BEGIN
  UPDATE public.agent_wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = p_agent_user_id RETURNING balance INTO v_new_balance;
  IF v_new_balance IS NULL THEN RAISE EXCEPTION 'Agent wallet not found'; END IF;
  RETURN v_new_balance;
END;
$function$;
