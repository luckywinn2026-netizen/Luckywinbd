-- Add game_id column to game_sessions for accurate per-game profit tracking
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS game_id text;

-- Create index for fast lookups by game_id
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON public.game_sessions(game_id);

-- Backfill existing rows: derive game_id from game_name by slugifying
UPDATE public.game_sessions 
SET game_id = CASE 
  WHEN game_name = 'Boxing King' THEN 'sweet-bonanza'
  WHEN game_name = 'Super Ace' THEN 'super-ace'
  WHEN game_name = 'F.Party' THEN 'fruit-party'
  WHEN game_name = 'T.Fruits' THEN 'tropical-fruits'
  ELSE LOWER(REPLACE(TRIM(game_name), ' ', '-'))
END
WHERE game_id IS NULL AND game_name IS NOT NULL;