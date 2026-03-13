
-- Add unique constraint on trx_id to prevent duplicate transaction IDs
CREATE UNIQUE INDEX idx_deposits_trx_id_unique ON public.deposits (trx_id) WHERE trx_id IS NOT NULL AND trx_id != '';
