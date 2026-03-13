
-- Add score columns to cyber_matches
ALTER TABLE public.cyber_matches
ADD COLUMN IF NOT EXISTS home_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS away_score integer NOT NULL DEFAULT 0;
