-- RPC: User can see their bonus turnover progress (required, completed, remaining, locked amount)
CREATE OR REPLACE FUNCTION public.get_user_bonus_turnover(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_required numeric := 0;
  v_completed numeric := 0;
  v_locked numeric := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('required_turnover', 0, 'completed_turnover', 0, 'remaining_turnover', 0, 'locked_amount', 0, 'has_pending', false);
  END IF;

  SELECT
    COALESCE(SUM(required_turnover), 0),
    COALESCE(SUM(completed_turnover), 0),
    COALESCE(SUM(amount), 0)
  INTO v_required, v_completed, v_locked
  FROM public.bonus_awards
  WHERE user_id = p_user_id
    AND status = 'credited'
    AND required_turnover > 0
    AND completed_turnover < required_turnover;

  RETURN jsonb_build_object(
    'required_turnover', ROUND(v_required, 2),
    'completed_turnover', ROUND(v_completed, 2),
    'remaining_turnover', ROUND(GREATEST(0, v_required - v_completed), 2),
    'locked_amount', ROUND(COALESCE(v_locked, 0), 2),
    'has_pending', (v_required > 0 AND v_completed < v_required)
  );
END;
$$;
