
-- Cyber Matches table (admin-managed)
CREATE TABLE public.cyber_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport text NOT NULL DEFAULT 'cyber_football', -- cyber_football or cyber_cricket
  home_team text NOT NULL,
  away_team text NOT NULL,
  odds_home numeric NOT NULL DEFAULT 2.0,
  odds_draw numeric NOT NULL DEFAULT 3.0,
  odds_away numeric NOT NULL DEFAULT 2.5,
  status text NOT NULL DEFAULT 'upcoming', -- upcoming, live, finished, cancelled
  result text, -- home, draw, away (set by admin)
  match_time timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer NOT NULL DEFAULT 5,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cyber Bets table (user bets)
CREATE TABLE public.cyber_bets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  match_id uuid NOT NULL REFERENCES public.cyber_matches(id) ON DELETE CASCADE,
  pick text NOT NULL, -- home, draw, away
  amount numeric NOT NULL DEFAULT 0,
  odds_at_bet numeric NOT NULL DEFAULT 1.0,
  potential_win numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending, won, lost, refunded
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cyber_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cyber_bets ENABLE ROW LEVEL SECURITY;

-- RLS for cyber_matches
CREATE POLICY "Anyone can view matches" ON public.cyber_matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON public.cyber_matches FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage matches" ON public.cyber_matches FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role));

-- RLS for cyber_bets
CREATE POLICY "Users can view own bets" ON public.cyber_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bets" ON public.cyber_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all bets" ON public.cyber_bets FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage all bets" ON public.cyber_bets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for matches
ALTER PUBLICATION supabase_realtime ADD TABLE public.cyber_matches;

-- Settlement RPC: Admin sets result, system pays out winners
CREATE OR REPLACE FUNCTION public.settle_cyber_match(p_match_id uuid, p_result text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match RECORD;
  v_bet RECORD;
  v_total_paid numeric := 0;
  v_winners integer := 0;
  v_losers integer := 0;
BEGIN
  -- Validate result
  IF p_result NOT IN ('home', 'draw', 'away') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result');
  END IF;

  -- Get match
  SELECT * INTO v_match FROM public.cyber_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status = 'finished' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already settled');
  END IF;

  -- Update match
  UPDATE public.cyber_matches SET status = 'finished', result = p_result, updated_at = now() WHERE id = p_match_id;

  -- Settle bets
  FOR v_bet IN SELECT * FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending' LOOP
    IF v_bet.pick = p_result THEN
      -- Winner
      UPDATE public.cyber_bets SET status = 'won', settled_at = now() WHERE id = v_bet.id;
      PERFORM public.adjust_wallet_balance(v_bet.user_id, v_bet.potential_win);
      v_total_paid := v_total_paid + v_bet.potential_win;
      v_winners := v_winners + 1;
    ELSE
      -- Loser
      UPDATE public.cyber_bets SET status = 'lost', settled_at = now() WHERE id = v_bet.id;
      v_losers := v_losers + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'winners', v_winners, 'losers', v_losers, 'total_paid', v_total_paid);
END;
$$;

-- Auto-adjust odds based on bet volume
CREATE OR REPLACE FUNCTION public.recalculate_cyber_odds(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_home_total numeric;
  v_draw_total numeric;
  v_away_total numeric;
  v_total numeric;
  v_margin numeric := 1.10; -- 10% house margin
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN pick = 'home' THEN amount END), 0),
    COALESCE(SUM(CASE WHEN pick = 'draw' THEN amount END), 0),
    COALESCE(SUM(CASE WHEN pick = 'away' THEN amount END), 0)
  INTO v_home_total, v_draw_total, v_away_total
  FROM public.cyber_bets WHERE match_id = p_match_id AND status = 'pending';

  v_total := v_home_total + v_draw_total + v_away_total;
  
  -- Only recalculate if enough bets exist
  IF v_total >= 500 THEN
    UPDATE public.cyber_matches SET
      odds_home = GREATEST(1.10, ROUND((v_total * v_margin / GREATEST(v_home_total, 1))::numeric, 2)),
      odds_draw = GREATEST(1.10, ROUND((v_total * v_margin / GREATEST(v_draw_total, 1))::numeric, 2)),
      odds_away = GREATEST(1.10, ROUND((v_total * v_margin / GREATEST(v_away_total, 1))::numeric, 2)),
      updated_at = now()
    WHERE id = p_match_id AND status IN ('upcoming', 'live');
  END IF;
END;
$$;

-- Trigger to auto-adjust odds after each bet
CREATE OR REPLACE FUNCTION public.trigger_recalc_odds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalculate_cyber_odds(NEW.match_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_odds_after_bet
AFTER INSERT ON public.cyber_bets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_odds();

-- Indexes
CREATE INDEX idx_cyber_matches_status ON public.cyber_matches(status);
CREATE INDEX idx_cyber_bets_match ON public.cyber_bets(match_id);
CREATE INDEX idx_cyber_bets_user ON public.cyber_bets(user_id);
