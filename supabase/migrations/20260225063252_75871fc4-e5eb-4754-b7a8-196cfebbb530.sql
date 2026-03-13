
-- Table to store per-sub-admin module permissions
CREATE TABLE public.sub_admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

ALTER TABLE public.sub_admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sub_admin_permissions"
ON public.sub_admin_permissions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view own permissions"
ON public.sub_admin_permissions FOR SELECT
USING (auth.uid() = user_id);
