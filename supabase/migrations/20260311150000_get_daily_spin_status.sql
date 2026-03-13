-- RPC: get_daily_spin_status(p_user_id uuid)
-- Returns { can_spin, last_spin_at, next_spin_at } for daily spin eligibility.
-- Used by backend /api/rpc proxy when /api/daily-spin/status is not available.
CREATE OR REPLACE FUNCTION public.get_daily_spin_status(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_last_spin_at timestamptz;
  v_can_spin boolean;
  v_next_spin_at timestamptz;
BEGIN
  SELECT last_spin_at INTO v_last_spin_at
  FROM public.user_vip_data
  WHERE user_id = p_user_id;

  IF v_last_spin_at IS NULL THEN
    v_can_spin := true;
    v_next_spin_at := NULL;
  ELSIF v_last_spin_at > now() - interval '24 hours' THEN
    v_can_spin := false;
    v_next_spin_at := v_last_spin_at + interval '24 hours';
  ELSE
    v_can_spin := true;
    v_next_spin_at := NULL;
  END IF;

  RETURN json_build_object(
    'canSpin', v_can_spin,
    'lastSpinAt', v_last_spin_at,
    'nextSpinAt', v_next_spin_at
  );
END;
$$;
