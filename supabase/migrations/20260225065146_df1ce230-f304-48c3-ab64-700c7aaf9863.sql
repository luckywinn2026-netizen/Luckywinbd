
-- Junction table: each payment method can have different numbers per transaction type
CREATE TABLE public.payment_method_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  transaction_type_id UUID NOT NULL REFERENCES public.transaction_types(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(payment_method_id, transaction_type_id)
);

ALTER TABLE public.payment_method_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment method numbers"
ON public.payment_method_numbers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view payment method numbers"
ON public.payment_method_numbers FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_payment_method_numbers_updated_at
BEFORE UPDATE ON public.payment_method_numbers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
