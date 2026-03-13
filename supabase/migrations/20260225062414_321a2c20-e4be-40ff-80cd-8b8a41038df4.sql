-- Allow moderators to view profiles (for Users page)
CREATE POLICY "Moderators can view all profiles" 
ON public.profiles FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to view deposits
CREATE POLICY "Moderators can view all deposits" 
ON public.deposits FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to update deposits
CREATE POLICY "Moderators can update deposits" 
ON public.deposits FOR UPDATE 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to view withdrawals
CREATE POLICY "Moderators can view all withdrawals" 
ON public.withdrawals FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to update withdrawals
CREATE POLICY "Moderators can update withdrawals" 
ON public.withdrawals FOR UPDATE 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to manage chat conversations
CREATE POLICY "Moderators can manage conversations" 
ON public.chat_conversations FOR ALL 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to manage chat messages
CREATE POLICY "Moderators can manage messages" 
ON public.chat_messages FOR ALL 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to read chat FAQ
CREATE POLICY "Moderators can manage FAQ" 
ON public.chat_faq FOR ALL 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to manage canned responses
CREATE POLICY "Moderators can manage canned responses" 
ON public.chat_canned_responses FOR ALL 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to manage agent settings
CREATE POLICY "Moderators can manage agent settings" 
ON public.agent_settings FOR ALL 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to view user roles
CREATE POLICY "Moderators can view roles" 
ON public.user_roles FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to view wallets (for user details)
CREATE POLICY "Moderators can view all wallets" 
ON public.wallets FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));

-- Allow moderators to view game stats
CREATE POLICY "Moderators can view game stats" 
ON public.game_stats_summary FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));