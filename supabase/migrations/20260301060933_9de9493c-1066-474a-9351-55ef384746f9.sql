
-- Create match events table for live commentary
CREATE TABLE public.cyber_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.cyber_matches(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'info',
  event_text text NOT NULL,
  minute integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cyber_match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view match events"
  ON public.cyber_match_events FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage match events"
  ON public.cyber_match_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage match events"
  ON public.cyber_match_events FOR ALL
  USING (public.has_role(auth.uid(), 'moderator'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cyber_match_events;

-- Index for fast lookups
CREATE INDEX idx_match_events_match_id ON public.cyber_match_events(match_id, created_at DESC);
