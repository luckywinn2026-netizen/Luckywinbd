
-- Table to track currently active/online players in games
CREATE TABLE public.active_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  game_type text NOT NULL, -- 'slot' or 'crash'
  game_name text NOT NULL, -- e.g. 'super-ace', 'lucky-777', 'aviator'
  game_display_name text, -- e.g. 'Super Ace', 'Lucky 777'
  bet_amount numeric NOT NULL DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.active_players ENABLE ROW LEVEL SECURITY;

-- Admins can view all active players
CREATE POLICY "Admins can view all active players"
ON public.active_players
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage active players (for manual win/loss)
CREATE POLICY "Admins can manage all active players"
ON public.active_players
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can manage their own active session
CREATE POLICY "Users can insert own active session"
ON public.active_players
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active session"
ON public.active_players
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own active session"
ON public.active_players
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_players;
