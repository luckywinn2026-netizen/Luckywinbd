
-- Payment methods table (admin-managed)
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '💰',
  number text NOT NULL,
  color_from text NOT NULL DEFAULT 'hsl(340,80%,40%)',
  color_to text NOT NULL DEFAULT 'hsl(340,80%,55%)',
  bonus text DEFAULT '+2.25%',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Everyone can read active payment methods
CREATE POLICY "Anyone can view active payment methods"
  ON public.payment_methods FOR SELECT
  USING (is_active = true);

-- Admins can manage
CREATE POLICY "Admins can manage payment methods"
  ON public.payment_methods FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Wallets table (per-user balance)
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON public.wallets FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all wallets"
  ON public.wallets FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert wallets"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create wallet on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

-- Function to credit wallet when deposit is approved
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deposit_approved
  AFTER UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deposit_approval();

-- Function to deduct wallet when withdrawal is approved
CREATE OR REPLACE FUNCTION public.handle_withdrawal_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_withdrawal_approved
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_withdrawal_approval();

-- Trigger for updated_at
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default payment methods
INSERT INTO public.payment_methods (name, icon, number, color_from, color_to, bonus, sort_order) VALUES
  ('bKash', '🟠', '01712XXXXXX', 'hsl(340,80%,40%)', 'hsl(340,80%,55%)', '+2.25%', 1),
  ('Nagad', '🟧', '01612XXXXXX', 'hsl(25,90%,45%)', 'hsl(25,90%,60%)', '+2.25%', 2),
  ('Rocket', '🟣', '01512XXXXXX', 'hsl(270,60%,45%)', 'hsl(270,60%,60%)', '+2.25%', 3),
  ('UPay', '🔵', '01812XXXXXX', 'hsl(210,80%,45%)', 'hsl(210,80%,60%)', '+2.25%', 4),
  ('TAP', '🟡', '01912XXXXXX', 'hsl(45,90%,45%)', 'hsl(45,90%,60%)', '+2.25%', 5),
  ('OKWallet', '🟢', '01412XXXXXX', 'hsl(140,60%,40%)', 'hsl(140,60%,55%)', '+2.25%', 6);

-- Create wallets for existing users
INSERT INTO public.wallets (user_id, balance)
SELECT user_id, 0 FROM public.profiles
ON CONFLICT DO NOTHING;
