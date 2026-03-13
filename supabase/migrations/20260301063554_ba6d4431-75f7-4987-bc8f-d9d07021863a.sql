-- =============================================
-- PERFORMANCE INDEXES - High Impact Tables
-- =============================================

-- 1. withdrawals: 13,155 seq scans, 0% idx hit
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals (status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals (user_id, status);

-- 2. profiles: 8,377 seq scans, 40% idx hit  
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_code ON public.profiles (user_code);
CREATE INDEX IF NOT EXISTS idx_profiles_refer_code ON public.profiles (refer_code);

-- 3. deposits: 6,166 seq scans, 15% idx hit
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits (user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits (status);
CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON public.deposits (user_id, status);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_agent ON public.deposits (assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;

-- 4. game_sessions: 5,955 seq scans, 50% idx hit (leaderboard, profit charts, per-game stats)
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON public.game_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON public.game_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_created ON public.game_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_name ON public.game_sessions (game_name);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_created ON public.game_sessions (game_name, created_at DESC);

-- 5. active_players: 24,424 seq scans (cleanup + admin queries)
CREATE INDEX IF NOT EXISTS idx_active_players_last_active ON public.active_players (last_active_at);

-- 6. games: 2,116 seq scans
CREATE INDEX IF NOT EXISTS idx_games_is_active ON public.games (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_games_game_id ON public.games (game_id);

-- 7. cyber_market_bets: settlement queries
CREATE INDEX IF NOT EXISTS idx_cyber_market_bets_market_status ON public.cyber_market_bets (market_id, status);
CREATE INDEX IF NOT EXISTS idx_cyber_market_bets_user ON public.cyber_market_bets (user_id);

-- 8. cyber_match_markets: match filtering
CREATE INDEX IF NOT EXISTS idx_cyber_match_markets_match ON public.cyber_match_markets (match_id, status);

-- 9. crash_settings & multiplier_settings: single-row tables with high seq scans
-- These are tiny tables but queried very often - no index needed, but ensure caching in app

-- 10. referrals: lookup by referred_id
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals (referrer_id);

-- 11. game_assets: lookup by game_id
CREATE INDEX IF NOT EXISTS idx_game_assets_game_id ON public.game_assets (game_id);

-- 12. payment_methods: active filter
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods (is_active, sort_order);

-- 13. super_ace_spin_logs: user lookup
CREATE INDEX IF NOT EXISTS idx_super_ace_spin_logs_user ON public.super_ace_spin_logs (user_id, created_at DESC);