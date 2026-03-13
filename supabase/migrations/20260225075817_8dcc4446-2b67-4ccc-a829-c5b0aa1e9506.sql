
CREATE OR REPLACE FUNCTION public.process_agent_deposit(p_agent_id uuid, p_user_code text, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_agent_balance numeric; v_commission_rate numeric;
  v_per_amount numeric; v_commission numeric; v_new_agent_balance numeric; v_new_user_balance numeric;
  v_is_admin boolean; v_is_agent boolean;
BEGIN
  IF p_amount < 100 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum deposit ৳100'); END IF;

  -- Check if admin or payment_agent
  v_is_admin := has_role(p_agent_id, 'admin'::app_role);
  v_is_agent := has_role(p_agent_id, 'payment_agent'::app_role);
  
  IF NOT v_is_admin AND NOT v_is_agent THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); 
  END IF;

  SELECT user_id INTO v_user_id FROM public.profiles WHERE user_code = p_user_code;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'User not found: ' || p_user_code); END IF;
  IF v_user_id = p_agent_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot deposit to own account'); END IF;

  -- Get commission settings
  SELECT per_amount, commission INTO v_per_amount, v_commission_rate FROM public.agent_commission_settings LIMIT 1;
  v_commission := ROUND((p_amount / COALESCE(NULLIF(v_per_amount,0),1000)) * COALESCE(v_commission_rate,4), 2);

  IF v_is_admin THEN
    -- Admin: directly credit user, no agent wallet deduction, no commission
    v_commission := 0;
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
    IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

    INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, 0);

    RETURN jsonb_build_object('success', true, 'agent_balance', 0, 'commission', 0, 'amount', p_amount);
  ELSE
    -- Payment agent: normal flow with balance check and commission
    SELECT balance INTO v_agent_balance FROM public.agent_wallets WHERE user_id = p_agent_id FOR UPDATE;
    IF v_agent_balance IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found'); END IF;
    IF v_agent_balance < p_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance: ৳' || v_agent_balance); END IF;

    UPDATE public.agent_wallets SET balance = balance - p_amount + v_commission, total_deposited = total_deposited + p_amount, total_commission = total_commission + v_commission, updated_at = now() WHERE user_id = p_agent_id RETURNING balance INTO v_new_agent_balance;
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
    IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

    INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, v_commission);

    RETURN jsonb_build_object('success', true, 'agent_balance', v_new_agent_balance, 'commission', v_commission, 'amount', p_amount);
  END IF;
END;
$function$;
