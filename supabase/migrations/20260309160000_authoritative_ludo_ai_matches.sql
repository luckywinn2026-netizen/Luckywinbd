CREATE TABLE IF NOT EXISTS public.ludo_ai_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id text NOT NULL DEFAULT 'ludo-king',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  level_idx integer NOT NULL,
  bet_amount numeric NOT NULL CHECK (bet_amount > 0),
  target_outcome text NOT NULL DEFAULT 'natural' CHECK (target_outcome IN ('force_loss', 'force_win', 'natural')),
  target_max_win numeric NOT NULL DEFAULT 0,
  opponent_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  board_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ludo_ai_matches_user_status
  ON public.ludo_ai_matches (user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ludo_ai_matches_active_user
  ON public.ludo_ai_matches (user_id)
  WHERE status = 'active';

ALTER TABLE public.ludo_ai_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own ludo matches" ON public.ludo_ai_matches;
CREATE POLICY "Authenticated users can read own ludo matches"
ON public.ludo_ai_matches FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_ludo_ai_matches_updated_at ON public.ludo_ai_matches;
CREATE TRIGGER update_ludo_ai_matches_updated_at
BEFORE UPDATE ON public.ludo_ai_matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
