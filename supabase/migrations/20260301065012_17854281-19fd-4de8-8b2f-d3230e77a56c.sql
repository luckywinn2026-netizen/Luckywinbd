
-- Auto-settle function: picks the result that maximizes owner profit
CREATE OR REPLACE FUNCTION public.auto_settle_cyber_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_home_payout numeric := 0;
  v_draw_payout numeric := 0;
  v_away_payout numeric := 0;
  v_total_bets numeric := 0;
  v_best_result text;
  v_min_payout numeric;
  v_settlement jsonb;
BEGIN
  -- Get match
  SELECT * INTO v_match FROM public.cyber_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status = 'finished' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already settled');
  END IF;

  -- Calculate total bets collected
  SELECT COALESCE(SUM(amount), 0) INTO v_total_bets
  FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending';

  IF v_total_bets = 0 THEN
    -- No bets, just finish the match with home win
    UPDATE public.cyber_matches SET status = 'finished', result = 'home', updated_at = now() WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'result', 'home', 'total_bets', 0, 'total_payout', 0, 'profit', 0, 'note', 'No bets placed');
  END IF;

  -- Calculate payout for each possible result
  SELECT COALESCE(SUM(potential_win), 0) INTO v_home_payout
  FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending' AND pick = 'home';

  SELECT COALESCE(SUM(potential_win), 0) INTO v_draw_payout
  FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending' AND pick = 'draw';

  SELECT COALESCE(SUM(potential_win), 0) INTO v_away_payout
  FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending' AND pick = 'away';

  -- Pick result with minimum payout (max profit for owner)
  v_min_payout := v_home_payout;
  v_best_result := 'home';

  IF v_draw_payout < v_min_payout THEN
    v_min_payout := v_draw_payout;
    v_best_result := 'draw';
  END IF;

  IF v_away_payout < v_min_payout THEN
    v_min_payout := v_away_payout;
    v_best_result := 'away';
  END IF;

  -- Settle using existing function
  v_settlement := public.settle_cyber_match(p_match_id, v_best_result);

  -- Return detailed profit breakdown
  RETURN jsonb_build_object(
    'success', true,
    'result', v_best_result,
    'total_bets', v_total_bets,
    'total_payout', v_min_payout,
    'profit', v_total_bets - v_min_payout,
    'breakdown', jsonb_build_object(
      'home_payout', v_home_payout,
      'draw_payout', v_draw_payout,
      'away_payout', v_away_payout
    ),
    'settlement', v_settlement
  );
END;
$$;

-- Auto-settle market: picks the result that maximizes owner profit
CREATE OR REPLACE FUNCTION public.auto_settle_cyber_market(p_market_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market RECORD;
  v_option RECORD;
  v_best_key text;
  v_min_payout numeric := 999999999;
  v_total_bets numeric := 0;
  v_payout numeric;
  v_settlement jsonb;
  v_breakdown jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_market FROM public.cyber_match_markets WHERE id = p_market_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  IF v_market.status = 'settled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market already settled');
  END IF;

  -- Get total bets
  SELECT COALESCE(SUM(amount), 0) INTO v_total_bets
  FROM public.cyber_market_bets WHERE market_id = p_market_id AND status = 'pending';

  IF v_total_bets = 0 THEN
    -- Settle with first option key
    SELECT (opt->>'key') INTO v_best_key FROM jsonb_array_elements(v_market.options) AS opt LIMIT 1;
    v_settlement := public.settle_cyber_market(p_market_id, COALESCE(v_best_key, 'none'));
    RETURN jsonb_build_object('success', true, 'result_key', v_best_key, 'total_bets', 0, 'profit', 0, 'note', 'No bets');
  END IF;

  -- Calculate payout for each option key
  FOR v_option IN SELECT opt->>'key' as key FROM jsonb_array_elements(v_market.options) AS opt LOOP
    SELECT COALESCE(SUM(potential_win), 0) INTO v_payout
    FROM public.cyber_market_bets WHERE market_id = p_market_id AND status = 'pending' AND pick_key = v_option.key;

    v_breakdown := v_breakdown || jsonb_build_object(v_option.key, v_payout);

    IF v_payout < v_min_payout THEN
      v_min_payout := v_payout;
      v_best_key := v_option.key;
    END IF;
  END LOOP;

  v_settlement := public.settle_cyber_market(p_market_id, v_best_key);

  RETURN jsonb_build_object(
    'success', true,
    'result_key', v_best_key,
    'total_bets', v_total_bets,
    'total_payout', v_min_payout,
    'profit', v_total_bets - v_min_payout,
    'breakdown', v_breakdown,
    'settlement', v_settlement
  );
END;
$$;
