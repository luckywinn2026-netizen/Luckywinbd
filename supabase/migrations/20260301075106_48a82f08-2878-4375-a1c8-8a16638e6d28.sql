
-- Agent applications table
CREATE TABLE public.agent_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  location text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application (no auth required)
CREATE POLICY "Anyone can insert agent applications"
ON public.agent_applications FOR INSERT
WITH CHECK (true);

-- Admins can manage all applications
CREATE POLICY "Admins can manage agent applications"
ON public.agent_applications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can view applications
CREATE POLICY "Moderators can view agent applications"
ON public.agent_applications FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role));
