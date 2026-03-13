
-- Free spin session tracking for Super Ace
CREATE TABLE public.super_ace_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  spins_remaining INTEGER NOT NULL DEFAULT 0,
  total_spins_awarded INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.super_ace_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
ON public.super_ace_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions via service role"
ON public.super_ace_sessions FOR ALL
USING (auth.uid() = user_id);

-- Spin log table for RTP auditing
CREATE TABLE public.super_ace_spin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bet_amount NUMERIC NOT NULL,
  total_win NUMERIC NOT NULL DEFAULT 0,
  cascades INTEGER NOT NULL DEFAULT 0,
  free_spin_mode BOOLEAN NOT NULL DEFAULT false,
  grid_result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.super_ace_spin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spin logs"
ON public.super_ace_spin_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all spin logs"
ON public.super_ace_spin_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
