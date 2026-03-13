
-- Reward pools table for pool-based payouts
CREATE TABLE public.reward_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_type text NOT NULL UNIQUE, -- 'small_win', 'medium_win', 'big_win', 'jackpot'
  balance numeric NOT NULL DEFAULT 0,
  total_contributed numeric NOT NULL DEFAULT 0,
  total_paid_out numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default pools
INSERT INTO public.reward_pools (pool_type, balance) VALUES
  ('small_win', 0),
  ('medium_win', 0),
  ('big_win', 0),
  ('jackpot', 0);

ALTER TABLE public.reward_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reward pools" ON public.reward_pools
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Edge functions can manage pools" ON public.reward_pools
  FOR ALL TO service_role
  USING (true);

-- User win cooldowns for preventing repeat jackpots
CREATE TABLE public.user_win_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  win_type text NOT NULL, -- 'big_win', 'jackpot'
  last_win_at timestamptz NOT NULL DEFAULT now(),
  win_amount numeric NOT NULL DEFAULT 0,
  game_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_win_cooldowns_user ON public.user_win_cooldowns (user_id, win_type);
CREATE INDEX idx_user_win_cooldowns_time ON public.user_win_cooldowns (last_win_at);

ALTER TABLE public.user_win_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cooldowns" ON public.user_win_cooldowns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Edge functions can manage cooldowns" ON public.user_win_cooldowns
  FOR ALL TO service_role
  USING (true);

-- Add new columns to game_profit_settings for pool percentages and cooldowns
ALTER TABLE public.game_profit_settings
  ADD COLUMN IF NOT EXISTS small_win_pool_pct numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS medium_win_pool_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS big_win_pool_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS jackpot_pool_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_win_cap numeric NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS jackpot_cooldown_hours numeric NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS big_win_cooldown_hours numeric NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS small_win_pct numeric NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS medium_win_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS big_win_pct numeric NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS jackpot_win_pct numeric NOT NULL DEFAULT 1;

-- RPC to distribute bet into pools (called from edge function)
CREATE OR REPLACE FUNCTION public.distribute_bet_to_pools(
  p_bet_amount numeric,
  p_small_pct numeric DEFAULT 30,
  p_medium_pct numeric DEFAULT 20,
  p_big_pct numeric DEFAULT 10,
  p_jackpot_pct numeric DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.reward_pools SET
    balance = balance + ROUND(p_bet_amount * p_small_pct / 100, 2),
    total_contributed = total_contributed + ROUND(p_bet_amount * p_small_pct / 100, 2),
    updated_at = now()
  WHERE pool_type = 'small_win';

  UPDATE public.reward_pools SET
    balance = balance + ROUND(p_bet_amount * p_medium_pct / 100, 2),
    total_contributed = total_contributed + ROUND(p_bet_amount * p_medium_pct / 100, 2),
    updated_at = now()
  WHERE pool_type = 'medium_win';

  UPDATE public.reward_pools SET
    balance = balance + ROUND(p_bet_amount * p_big_pct / 100, 2),
    total_contributed = total_contributed + ROUND(p_bet_amount * p_big_pct / 100, 2),
    updated_at = now()
  WHERE pool_type = 'big_win';

  UPDATE public.reward_pools SET
    balance = balance + ROUND(p_bet_amount * p_jackpot_pct / 100, 2),
    total_contributed = total_contributed + ROUND(p_bet_amount * p_jackpot_pct / 100, 2),
    updated_at = now()
  WHERE pool_type = 'jackpot';
END;
$$;

-- RPC to deduct from pool on win
CREATE OR REPLACE FUNCTION public.deduct_from_pool(
  p_pool_type text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  UPDATE public.reward_pools SET
    balance = GREATEST(0, balance - p_amount),
    total_paid_out = total_paid_out + p_amount,
    updated_at = now()
  WHERE pool_type = p_pool_type
  RETURNING balance INTO v_balance;

  RETURN COALESCE(v_balance, 0);
END;
$$;
