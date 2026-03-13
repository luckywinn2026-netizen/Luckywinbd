
-- Markets table: admin creates markets per match
CREATE TABLE public.cyber_match_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.cyber_matches(id) ON DELETE CASCADE,
  market_type text NOT NULL, -- 'over_under', 'next_event', 'odd_even', 'half_winner'
  title text NOT NULL, -- e.g. "Total Runs Over/Under 150.5"
  options jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{key: "over", label: "Over 150.5", odds: 1.85}, ...]
  status text NOT NULL DEFAULT 'open', -- 'open', 'suspended', 'settled'
  result_key text, -- winning option key after settlement
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cyber_match_markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view markets" ON public.cyber_match_markets FOR SELECT USING (true);
CREATE POLICY "Admins can manage markets" ON public.cyber_match_markets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage markets" ON public.cyber_match_markets FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role));

-- Market bets table
CREATE TABLE public.cyber_market_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  market_id uuid NOT NULL REFERENCES public.cyber_match_markets(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.cyber_matches(id),
  pick_key text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  odds_at_bet numeric NOT NULL DEFAULT 1.0,
  potential_win numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'won', 'lost'
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cyber_market_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own market bets" ON public.cyber_market_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own market bets" ON public.cyber_market_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all market bets" ON public.cyber_market_bets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Settle market function
CREATE OR REPLACE FUNCTION public.settle_cyber_market(p_market_id uuid, p_result_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bet RECORD;
  v_total_paid numeric := 0;
  v_winners integer := 0;
  v_losers integer := 0;
BEGIN
  -- Update market
  UPDATE public.cyber_match_markets SET status = 'settled', result_key = p_result_key, updated_at = now() WHERE id = p_market_id;

  -- Settle bets
  FOR v_bet IN SELECT * FROM public.cyber_market_bets WHERE market_id = p_market_id AND status = 'pending' LOOP
    IF v_bet.pick_key = p_result_key THEN
      UPDATE public.cyber_market_bets SET status = 'won', settled_at = now() WHERE id = v_bet.id;
      PERFORM public.adjust_wallet_balance(v_bet.user_id, v_bet.potential_win);
      v_total_paid := v_total_paid + v_bet.potential_win;
      v_winners := v_winners + 1;
    ELSE
      UPDATE public.cyber_market_bets SET status = 'lost', settled_at = now() WHERE id = v_bet.id;
      v_losers := v_losers + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'winners', v_winners, 'losers', v_losers, 'total_paid', v_total_paid);
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cyber_match_markets;
