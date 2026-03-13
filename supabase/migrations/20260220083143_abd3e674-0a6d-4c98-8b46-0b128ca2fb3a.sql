
-- Allow all authenticated users to read all game sessions (for live bet feed)
CREATE POLICY "Authenticated users can view all sessions"
ON public.game_sessions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to read all usernames (for bet feed display)
CREATE POLICY "Authenticated users can view all usernames"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);
