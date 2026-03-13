
-- Update settle_cyber_match to also insert into game_sessions for analytics
CREATE OR REPLACE FUNCTION public.settle_cyber_match(p_match_id uuid, p_result text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match RECORD;
  v_bet RECORD;
  v_total_paid numeric := 0;
  v_winners integer := 0;
  v_losers integer := 0;
  v_match_label text;
BEGIN
  IF p_result NOT IN ('home', 'draw', 'away') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result');
  END IF;

  SELECT * INTO v_match FROM public.cyber_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status = 'finished' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already settled');
  END IF;

  v_match_label := v_match.home_team || ' vs ' || v_match.away_team;

  UPDATE public.cyber_matches SET status = 'finished', result = p_result, updated_at = now() WHERE id = p_match_id;

  FOR v_bet IN SELECT * FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending' LOOP
    IF v_bet.pick = p_result THEN
      UPDATE public.cyber_bets SET status = 'won', settled_at = now() WHERE id = v_bet.id;
      PERFORM public.adjust_wallet_balance(v_bet.user_id, v_bet.potential_win);
      v_total_paid := v_total_paid + v_bet.potential_win;
      v_winners := v_winners + 1;
      -- Track in game_sessions for analytics
      INSERT INTO public.game_sessions (user_id, game_type, game_name, game_id, bet_amount, win_amount, result, multiplier)
      VALUES (v_bet.user_id, 'sports', v_match_label, 'cyber-' || v_match.sport, v_bet.amount, v_bet.potential_win, 'win', v_bet.odds_at_bet);
    ELSE
      UPDATE public.cyber_bets SET status = 'lost', settled_at = now() WHERE id = v_bet.id;
      v_losers := v_losers + 1;
      -- Track losses in game_sessions too
      INSERT INTO public.game_sessions (user_id, game_type, game_name, game_id, bet_amount, win_amount, result, multiplier)
      VALUES (v_bet.user_id, 'sports', v_match_label, 'cyber-' || v_match.sport, v_bet.amount, 0, 'loss', v_bet.odds_at_bet);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'winners', v_winners, 'losers', v_losers, 'total_paid', v_total_paid);
END;
$function$;

-- Update settle_cyber_market to also insert into game_sessions
CREATE OR REPLACE FUNCTION public.settle_cyber_market(p_market_id uuid, p_result_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_market RECORD;
  v_match RECORD;
  v_bet RECORD;
  v_total_paid numeric := 0;
  v_winners integer := 0;
  v_losers integer := 0;
  v_game_label text;
BEGIN
  SELECT * INTO v_market FROM public.cyber_match_markets WHERE id = p_market_id;

  -- Get match info for labeling
  SELECT * INTO v_match FROM public.cyber_matches WHERE id = v_market.match_id;
  v_game_label := COALESCE(v_match.home_team || ' vs ' || v_match.away_team, 'Market Bet') || ' - ' || v_market.title;

  UPDATE public.cyber_match_markets SET status = 'settled', result_key = p_result_key, updated_at = now() WHERE id = p_market_id;

  FOR v_bet IN SELECT * FROM public.cyber_market_bets WHERE market_id = p_market_id AND status = 'pending' LOOP
    IF v_bet.pick_key = p_result_key THEN
      UPDATE public.cyber_market_bets SET status = 'won', settled_at = now() WHERE id = v_bet.id;
      PERFORM public.adjust_wallet_balance(v_bet.user_id, v_bet.potential_win);
      v_total_paid := v_total_paid + v_bet.potential_win;
      v_winners := v_winners + 1;
      INSERT INTO public.game_sessions (user_id, game_type, game_name, game_id, bet_amount, win_amount, result, multiplier)
      VALUES (v_bet.user_id, 'sports', v_game_label, 'cyber-market', v_bet.amount, v_bet.potential_win, 'win', v_bet.odds_at_bet);
    ELSE
      UPDATE public.cyber_market_bets SET status = 'lost', settled_at = now() WHERE id = v_bet.id;
      v_losers := v_losers + 1;
      INSERT INTO public.game_sessions (user_id, game_type, game_name, game_id, bet_amount, win_amount, result, multiplier)
      VALUES (v_bet.user_id, 'sports', v_game_label, 'cyber-market', v_bet.amount, 0, 'loss', v_bet.odds_at_bet);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'winners', v_winners, 'losers', v_losers, 'total_paid', v_total_paid);
END;
$function$;
