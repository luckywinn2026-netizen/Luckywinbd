-- Performance indexes for 100k+ users scaling

-- Deposits: frequently queried by user_id and status
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);

-- Withdrawals: frequently queried by user_id and status
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- Game sessions: queried by created_at for charts/reports, and by game_name for per-game stats
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON public.game_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_name ON public.game_sessions(game_name);

-- Chat messages: heavily queried by conversation_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);

-- Chat conversations: queried by status for queue positioning
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent_id ON public.chat_conversations(agent_id);

-- Agent deposits: queried by agent_id
CREATE INDEX IF NOT EXISTS idx_agent_deposits_agent_id ON public.agent_deposits(agent_id);

-- Referrals: queried by referrer_id
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);