-- Live Color Prediction: shared rounds + public bets

-- 1) Rounds table
CREATE TABLE IF NOT EXISTS public.color_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id text NOT NULL UNIQUE,
  timer_mode numeric NOT NULL DEFAULT 1, -- 0.5, 1, 3, 5 (minutes)
  status text NOT NULL DEFAULT 'settled' CHECK (status IN ('betting', 'locked', 'settled')),
  winning_number integer,
  winning_color text,
  winning_colors text[],
  closing_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.color_rounds ENABLE ROW LEVEL SECURITY;

-- Everyone can read rounds; only service / backend mutates
DROP POLICY IF EXISTS "Anyone can read color rounds" ON public.color_rounds;
CREATE POLICY "Anyone can read color rounds"
ON public.color_rounds FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role manages color rounds" ON public.color_rounds;
CREATE POLICY "Service role manages color rounds"
ON public.color_rounds FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_color_rounds_period_id
  ON public.color_rounds (period_id);


-- 2) Bets table (per player, per round)
CREATE TABLE IF NOT EXISTS public.color_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.color_rounds(id) ON DELETE CASCADE,
  period_id text NOT NULL,
  user_id uuid NOT NULL,
  username_snapshot text,
  bet_type text NOT NULL,   -- 'color' | 'number' | 'bigsmall'
  bet_value text NOT NULL,  -- 'red'/'green'/'violet' or '0'-'9' or 'big'/'small'
  bet_amount numeric NOT NULL,
  payout numeric NOT NULL DEFAULT 0,
  is_win boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.color_bets ENABLE ROW LEVEL SECURITY;

-- Players can insert their own bets
DROP POLICY IF EXISTS "Players insert own color bets" ON public.color_bets;
CREATE POLICY "Players insert own color bets"
ON public.color_bets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- All authenticated users can see live bets (for leaderboard / live feed)
DROP POLICY IF EXISTS "Players can view color bets" ON public.color_bets;
CREATE POLICY "Players can view color bets"
ON public.color_bets FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_color_bets_round_id
  ON public.color_bets (round_id);

CREATE INDEX IF NOT EXISTS idx_color_bets_period_created
  ON public.color_bets (period_id, created_at DESC);

