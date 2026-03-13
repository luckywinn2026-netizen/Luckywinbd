
-- Drop all existing restrictive policies on active_players
DROP POLICY IF EXISTS "Admins can manage all active players" ON public.active_players;
DROP POLICY IF EXISTS "Admins can view all active players" ON public.active_players;
DROP POLICY IF EXISTS "Users can delete own active session" ON public.active_players;
DROP POLICY IF EXISTS "Users can insert own active session" ON public.active_players;
DROP POLICY IF EXISTS "Users can update own active session" ON public.active_players;

-- Recreate as PERMISSIVE policies so they actually work
CREATE POLICY "Admins can manage all active players"
  ON public.active_players FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own active session"
  ON public.active_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active session"
  ON public.active_players FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own active session"
  ON public.active_players FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own active session"
  ON public.active_players FOR SELECT
  USING (auth.uid() = user_id);
