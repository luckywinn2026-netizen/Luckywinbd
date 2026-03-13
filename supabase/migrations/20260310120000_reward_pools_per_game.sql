-- Per-game reward pools: each slot has its own small_win, medium_win, big_win, jackpot.
-- Existing rows become game_id = 'global' for backward compatibility.

ALTER TABLE public.reward_pools
  ADD COLUMN IF NOT EXISTS game_id text NOT NULL DEFAULT 'global';

UPDATE public.reward_pools SET game_id = 'global' WHERE game_id IS NULL;

ALTER TABLE public.reward_pools DROP CONSTRAINT IF EXISTS reward_pools_pool_type_key;
ALTER TABLE public.reward_pools DROP CONSTRAINT IF EXISTS reward_pools_pool_type_unique;
ALTER TABLE public.reward_pools ADD CONSTRAINT reward_pools_game_id_pool_type_key UNIQUE (game_id, pool_type);

CREATE INDEX IF NOT EXISTS idx_reward_pools_game_id ON public.reward_pools (game_id);

-- Ensure pools exist for (game_id, pool_type) then add contribution
CREATE OR REPLACE FUNCTION public.distribute_bet_to_pools(
  p_game_id text,
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
DECLARE
  v_small numeric := ROUND(p_bet_amount * p_small_pct / 100, 2);
  v_medium numeric := ROUND(p_bet_amount * p_medium_pct / 100, 2);
  v_big numeric := ROUND(p_bet_amount * p_big_pct / 100, 2);
  v_jackpot numeric := ROUND(p_bet_amount * p_jackpot_pct / 100, 2);
BEGIN
  INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
  VALUES (p_game_id, 'small_win', v_small, v_small, 0, now())
  ON CONFLICT (game_id, pool_type) DO UPDATE SET
    balance = public.reward_pools.balance + v_small,
    total_contributed = public.reward_pools.total_contributed + v_small,
    updated_at = now();

  INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
  VALUES (p_game_id, 'medium_win', v_medium, v_medium, 0, now())
  ON CONFLICT (game_id, pool_type) DO UPDATE SET
    balance = public.reward_pools.balance + v_medium,
    total_contributed = public.reward_pools.total_contributed + v_medium,
    updated_at = now();

  INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
  VALUES (p_game_id, 'big_win', v_big, v_big, 0, now())
  ON CONFLICT (game_id, pool_type) DO UPDATE SET
    balance = public.reward_pools.balance + v_big,
    total_contributed = public.reward_pools.total_contributed + v_big,
    updated_at = now();

  INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
  VALUES (p_game_id, 'jackpot', v_jackpot, v_jackpot, 0, now())
  ON CONFLICT (game_id, pool_type) DO UPDATE SET
    balance = public.reward_pools.balance + v_jackpot,
    total_contributed = public.reward_pools.total_contributed + v_jackpot,
    updated_at = now();
END;
$$;

-- Deduct from a specific game's pool
CREATE OR REPLACE FUNCTION public.deduct_from_pool(
  p_game_id text,
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
  INSERT INTO public.reward_pools (game_id, pool_type, balance, total_contributed, total_paid_out, updated_at)
  VALUES (p_game_id, p_pool_type, 0, 0, 0, now())
  ON CONFLICT (game_id, pool_type) DO NOTHING;

  UPDATE public.reward_pools SET
    balance = GREATEST(0, balance - p_amount),
    total_paid_out = total_paid_out + p_amount,
    updated_at = now()
  WHERE game_id = p_game_id AND pool_type = p_pool_type
  RETURNING balance INTO v_balance;

  RETURN COALESCE(v_balance, 0);
END;
$$;
