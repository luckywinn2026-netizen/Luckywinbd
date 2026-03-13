
-- Add cricket-specific score fields to cyber_matches
ALTER TABLE public.cyber_matches
  ADD COLUMN home_wickets integer NOT NULL DEFAULT 0,
  ADD COLUMN away_wickets integer NOT NULL DEFAULT 0,
  ADD COLUMN home_overs text NOT NULL DEFAULT '0.0',
  ADD COLUMN away_overs text NOT NULL DEFAULT '0.0';
