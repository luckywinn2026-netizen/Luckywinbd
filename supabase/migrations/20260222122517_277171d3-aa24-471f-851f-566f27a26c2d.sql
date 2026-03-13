
-- Table for VIP points, total bet, cashback tracking per user
CREATE TABLE public.user_vip_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  vip_points integer NOT NULL DEFAULT 0,
  total_bet_amount numeric NOT NULL DEFAULT 0,
  last_cashback_at timestamp with time zone,
  last_spin_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_vip_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own VIP data" ON public.user_vip_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own VIP data" ON public.user_vip_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own VIP data" ON public.user_vip_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage VIP data" ON public.user_vip_data FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_user_vip_data_updated_at
BEFORE UPDATE ON public.user_vip_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create vip_data row when user is created (add to handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, phone, refer_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email, '@', 1)),
    public.generate_refer_code()
  );
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_vip_data (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

-- DB function for leaderboard: top players by total winnings this week
CREATE OR REPLACE FUNCTION public.get_leaderboard(time_range text DEFAULT 'weekly')
RETURNS TABLE(
  user_id uuid,
  username text,
  total_winnings numeric,
  total_games bigint,
  top_game text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH player_stats AS (
    SELECT
      gs.user_id,
      SUM(gs.win_amount) as total_winnings,
      COUNT(*) as total_games,
      (SELECT gs2.game_name FROM public.game_sessions gs2 
       WHERE gs2.user_id = gs.user_id 
       GROUP BY gs2.game_name 
       ORDER BY SUM(gs2.win_amount) DESC 
       LIMIT 1) as top_game
    FROM public.game_sessions gs
    WHERE 
      CASE WHEN time_range = 'weekly' 
        THEN gs.created_at >= now() - interval '7 days'
        ELSE true
      END
    GROUP BY gs.user_id
    HAVING SUM(gs.win_amount) > 0
    ORDER BY SUM(gs.win_amount) DESC
    LIMIT 20
  )
  SELECT 
    ps.user_id,
    COALESCE(p.username, 'Player') as username,
    ps.total_winnings,
    ps.total_games,
    COALESCE(ps.top_game, '-') as top_game
  FROM player_stats ps
  LEFT JOIN public.profiles p ON p.user_id = ps.user_id;
$function$;

-- RPC to atomically update VIP data
CREATE OR REPLACE FUNCTION public.add_vip_points(p_user_id uuid, p_points integer, p_bet_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_vip_data (user_id, vip_points, total_bet_amount)
  VALUES (p_user_id, p_points, p_bet_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET vip_points = user_vip_data.vip_points + p_points,
      total_bet_amount = user_vip_data.total_bet_amount + p_bet_amount,
      updated_at = now();
END;
$function$;

-- RPC to claim cashback atomically
CREATE OR REPLACE FUNCTION public.claim_cashback(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  vip_data RECORD;
  cashback_rate numeric;
  cashback_amount numeric;
  vip_pts integer;
BEGIN
  SELECT * INTO vip_data FROM public.user_vip_data WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  
  -- Check 24h cooldown
  IF vip_data.last_cashback_at IS NOT NULL AND vip_data.last_cashback_at > now() - interval '24 hours' THEN
    RETURN 0;
  END IF;
  
  -- Determine cashback rate from VIP points
  vip_pts := vip_data.vip_points;
  IF vip_pts >= 15000 THEN cashback_rate := 8;
  ELSIF vip_pts >= 5000 THEN cashback_rate := 5;
  ELSIF vip_pts >= 2000 THEN cashback_rate := 3;
  ELSIF vip_pts >= 500 THEN cashback_rate := 2;
  ELSE cashback_rate := 1;
  END IF;
  
  cashback_amount := ROUND(vip_data.total_bet_amount * (cashback_rate / 100));
  IF cashback_amount <= 0 THEN RETURN 0; END IF;
  
  -- Reset total_bet_amount and set last_cashback_at
  UPDATE public.user_vip_data 
  SET total_bet_amount = 0, last_cashback_at = now(), updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Credit wallet
  PERFORM public.adjust_wallet_balance(p_user_id, cashback_amount);
  
  RETURN cashback_amount;
END;
$function$;

-- RPC to check and record spin
CREATE OR REPLACE FUNCTION public.try_daily_spin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  vip_data RECORD;
BEGIN
  SELECT * INTO vip_data FROM public.user_vip_data WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_vip_data (user_id, last_spin_at) VALUES (p_user_id, now());
    RETURN true;
  END IF;
  
  IF vip_data.last_spin_at IS NOT NULL AND vip_data.last_spin_at > now() - interval '24 hours' THEN
    RETURN false;
  END IF;
  
  UPDATE public.user_vip_data SET last_spin_at = now(), updated_at = now() WHERE user_id = p_user_id;
  RETURN true;
END;
$function$;
