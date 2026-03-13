
-- Transaction types for deposit flow
CREATE TABLE public.transaction_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '💳',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage transaction types"
ON public.transaction_types FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active transaction types"
ON public.transaction_types FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Seed default types
INSERT INTO public.transaction_types (type_id, label, icon, description, sort_order) VALUES
  ('agent-cashout', 'Agent Cashout', '🏪', 'Agent এর কাছ থেকে Cashout', 1),
  ('send-money', 'Send Money', '📤', 'সরাসরি Send Money করুন', 2),
  ('payment', 'Payment', '💳', 'Payment অপশন ব্যবহার করুন', 3);
