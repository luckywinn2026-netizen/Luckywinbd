
-- Update process_agent_deposit to set commission = 0 always
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

  IF v_is_admin THEN
    -- Admin: directly credit user, no agent wallet deduction
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
    IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

    INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, 0);

    RETURN jsonb_build_object('success', true, 'agent_balance', 0, 'commission', 0, 'amount', p_amount);
  ELSE
    -- Payment agent: NO commission, balance += deposit_amount (money agent owes to owner)
    SELECT balance INTO v_agent_balance FROM public.agent_wallets WHERE user_id = p_agent_id FOR UPDATE;
    IF v_agent_balance IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found'); END IF;
    IF v_agent_balance < p_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance: ৳' || v_agent_balance); END IF;

    UPDATE public.agent_wallets SET balance = balance - p_amount, total_deposited = total_deposited + p_amount, updated_at = now() WHERE user_id = p_agent_id RETURNING balance INTO v_new_agent_balance;
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id RETURNING balance INTO v_new_user_balance;
    IF v_new_user_balance IS NULL THEN RAISE EXCEPTION 'User wallet not found'; END IF;

    INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission) VALUES (p_agent_id, v_user_id, p_user_code, p_amount, 0);

    RETURN jsonb_build_object('success', true, 'agent_balance', v_new_agent_balance, 'commission', 0, 'amount', p_amount);
  END IF;
END;
$function$;

-- Create RPC for agent withdrawal approval (deducts withdrawal from agent balance)
CREATE OR REPLACE FUNCTION public.process_agent_withdrawal_approval(p_agent_id uuid, p_withdrawal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_withdrawal RECORD;
  v_user_code text;
BEGIN
  -- Get withdrawal details
  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found or already processed');
  END IF;

  -- Verify agent role
  IF NOT has_role(p_agent_id, 'payment_agent'::app_role) AND NOT has_role(p_agent_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Update withdrawal status to approved
  UPDATE public.withdrawals SET 
    status = 'approved',
    reviewed_by_agent = p_agent_id,
    agent_approved_at = now(),
    updated_at = now()
  WHERE id = p_withdrawal_id AND status = 'pending';

  -- Get user_code for logging
  SELECT user_code INTO v_user_code FROM public.profiles WHERE user_id = v_withdrawal.user_id;

  -- Log agent withdrawal (commission = 0)
  INSERT INTO public.agent_withdrawals (agent_id, user_id, user_code, amount, commission)
  VALUES (p_agent_id, v_withdrawal.user_id, COALESCE(v_user_code, '—'), v_withdrawal.amount, 0);

  RETURN jsonb_build_object('success', true, 'amount', v_withdrawal.amount);
END;
$function$;
