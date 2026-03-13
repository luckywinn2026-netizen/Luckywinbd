
-- Add check constraint to prevent negative balance
ALTER TABLE public.wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);
