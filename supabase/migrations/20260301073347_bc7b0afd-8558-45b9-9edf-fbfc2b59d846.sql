
-- Update record_agent_commission: track commission but DON'T deduct from balance
CREATE OR REPLACE FUNCTION public.record_agent_commission(p_agent_id uuid, p_commission numeric, p_deposit_amount numeric DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- balance += full deposit amount (NO commission deduction)
  -- total_commission += commission (tracking only)
  UPDATE public.agent_wallets
  SET total_commission = total_commission + p_commission,
      balance = balance + p_deposit_amount,
      total_deposited = total_deposited + p_deposit_amount,
      updated_at = now()
  WHERE user_id = p_agent_id;
END;
$function$;

-- Update process_agent_deposit: restore commission calculation but no balance deduction
CREATE OR REPLACE FUNCTION public.process_agent_deposit(p_agent_id uuid, p_user_code text, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_agent_balance numeric;
  v_new_agent_balance numeric; v_new_user_balance numeric;
  v_is_admin boolean; v_is_agent boolean;
  v_commission numeric := 0;
  v_comm_settings RECORD;
BEGIN
  IF p_amount < 100 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum deposit ৳100'); END IF;

  v_is_admin := has_role(p_agent_id, 'admin'::app_role);
  v_is_agent := has_role(p_agent_id, 'payment_agent'::app_role);
  
  IF NOT v_is_admin AND NOT v_is_agent THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); 
  END IF;

  SELECT user_id INTO v_user_id FROM public.profiles WHERE user_code = p_user_code;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'User not found: ' || p_user_code); END IF;
  IF v_user_id = p_agent_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot deposit to own account'); END IF;

  -- Calculate commission for tracking
  SELECT per_amount, commission INTO v_comm_settings FROM public.agent_commission_settings LIMIT 1;
  IF v_comm_settings IS NOT NULL AND v_comm_settings.per_amount > 0 THEN
    v_commission := ROUND((p_amount / v_comm_settings.per_amount) * v_comm_settings.commission, 2);
  END IF;

  IF v_is_admin THEN
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
    IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

    INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, 0);

    RETURN jsonb_build_object('success', true, 'agent_balance', 0, 'commission', 0, 'amount', p_amount);
  ELSE
    -- Payment agent: commission tracked, but NOT deducted from balance
    SELECT balance INTO v_agent_balance FROM public.agent_wallets WHERE user_id = p_agent_id FOR UPDATE;
    IF v_agent_balance IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found'); END IF;
    IF v_agent_balance < p_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance: ৳' || v_agent_balance); END IF;

    -- Deduct full deposit from agent wallet (agent pays user), but commission is NOT subtracted
    UPDATE public.agent_wallets 
    SET balance = balance - p_amount, 
        total_deposited = total_deposited + p_amount, 
        total_commission = total_commission + v_commission,
        updated_at = now() 
    WHERE user_id = p_agent_id RETURNING balance INTO v_new_agent_balance;
    
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
    IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

    INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, v_commission);

    RETURN jsonb_build_object('success', true, 'agent_balance', v_new_agent_balance, 'commission', v_commission, 'amount', p_amount);
  END IF;
END;
$function$;
