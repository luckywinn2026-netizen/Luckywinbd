ALTER TABLE public.agent_payment_numbers
  ADD COLUMN IF NOT EXISTS rotation_hours integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.agent_payment_numbers
SET rotation_hours = 1
WHERE rotation_hours IS NULL OR rotation_hours <= 0;

CREATE INDEX IF NOT EXISTS idx_agent_payment_numbers_method_order
  ON public.agent_payment_numbers (payment_method, is_active, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.process_agent_assigned_deposit_approval(
  p_agent_id uuid,
  p_deposit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
  v_user_code text;
  v_agent_balance numeric;
  v_new_balance numeric;
  v_commission numeric := 0;
  v_comm_settings RECORD;
BEGIN
  IF NOT has_role(p_agent_id, 'payment_agent'::app_role) AND NOT has_role(p_agent_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT *
  INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
    AND status = 'pending'
  FOR UPDATE;

  IF v_deposit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found or already processed');
  END IF;

  IF v_deposit.assigned_agent_id IS NOT NULL
     AND v_deposit.assigned_agent_id <> p_agent_id
     AND NOT has_role(p_agent_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit is assigned to another agent');
  END IF;

  UPDATE public.deposits
  SET status = 'agent_approved',
      reviewed_by_agent = p_agent_id,
      agent_approved_at = now(),
      updated_at = now()
  WHERE id = p_deposit_id
    AND status = 'pending';

  SELECT user_code
  INTO v_user_code
  FROM public.profiles
  WHERE user_id = v_deposit.user_id;

  IF NOT has_role(p_agent_id, 'admin'::app_role) THEN
    SELECT balance
    INTO v_agent_balance
    FROM public.agent_wallets
    WHERE user_id = p_agent_id
    FOR UPDATE;

    IF v_agent_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found');
    END IF;

    SELECT per_amount, commission
    INTO v_comm_settings
    FROM public.agent_commission_settings
    LIMIT 1;

    IF v_comm_settings IS NOT NULL AND COALESCE(v_comm_settings.per_amount, 0) > 0 THEN
      v_commission := ROUND((v_deposit.amount / v_comm_settings.per_amount) * v_comm_settings.commission, 2);
    END IF;

    UPDATE public.agent_wallets
    SET balance = balance + v_deposit.amount,
        total_deposited = total_deposited + v_deposit.amount,
        total_commission = total_commission + v_commission,
        updated_at = now()
    WHERE user_id = p_agent_id
    RETURNING balance INTO v_new_balance;
  ELSE
    v_new_balance := 0;
    v_commission := 0;
  END IF;

  INSERT INTO public.agent_deposits (agent_id, user_id, user_code, amount, commission)
  VALUES (p_agent_id, v_deposit.user_id, COALESCE(v_user_code, '—'), v_deposit.amount, v_commission);

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_deposit.amount,
    'commission', v_commission,
    'agent_balance', COALESCE(v_new_balance, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_agent_withdrawal_approval(
  p_agent_id uuid,
  p_withdrawal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
  v_user_code text;
  v_agent_balance numeric;
  v_new_agent_balance numeric;
  v_commission numeric := 0;
  v_comm_settings RECORD;
BEGIN
  SELECT *
  INTO v_withdrawal
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
    AND status = 'pending'
  FOR UPDATE;

  IF v_withdrawal.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found or already processed');
  END IF;

  IF NOT has_role(p_agent_id, 'payment_agent'::app_role) AND NOT has_role(p_agent_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_withdrawal.assigned_agent_id IS NOT NULL
     AND v_withdrawal.assigned_agent_id <> p_agent_id
     AND NOT has_role(p_agent_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is assigned to another agent');
  END IF;

  IF NOT has_role(p_agent_id, 'admin'::app_role) THEN
    SELECT balance
    INTO v_agent_balance
    FROM public.agent_wallets
    WHERE user_id = p_agent_id
    FOR UPDATE;

    IF v_agent_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Agent wallet not found');
    END IF;

    IF v_agent_balance < v_withdrawal.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient agent balance');
    END IF;

    SELECT per_amount, commission
    INTO v_comm_settings
    FROM public.agent_withdraw_commission_settings
    LIMIT 1;

    IF v_comm_settings IS NOT NULL AND COALESCE(v_comm_settings.per_amount, 0) > 0 THEN
      v_commission := ROUND((v_withdrawal.amount / v_comm_settings.per_amount) * v_comm_settings.commission, 2);
    END IF;

    UPDATE public.agent_wallets
    SET balance = balance - v_withdrawal.amount,
        total_commission = total_commission + v_commission,
        updated_at = now()
    WHERE user_id = p_agent_id
    RETURNING balance INTO v_new_agent_balance;
  ELSE
    v_new_agent_balance := 0;
    v_commission := 0;
  END IF;

  UPDATE public.withdrawals
  SET status = 'approved',
      reviewed_by_agent = p_agent_id,
      agent_approved_at = now(),
      updated_at = now()
  WHERE id = p_withdrawal_id
    AND status = 'pending';

  SELECT user_code
  INTO v_user_code
  FROM public.profiles
  WHERE user_id = v_withdrawal.user_id;

  INSERT INTO public.agent_withdrawals (agent_id, user_id, user_code, amount, commission)
  VALUES (p_agent_id, v_withdrawal.user_id, COALESCE(v_user_code, '—'), v_withdrawal.amount, v_commission);

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_withdrawal.amount,
    'commission', v_commission,
    'agent_balance', COALESCE(v_new_agent_balance, 0)
  );
END;
$$;
