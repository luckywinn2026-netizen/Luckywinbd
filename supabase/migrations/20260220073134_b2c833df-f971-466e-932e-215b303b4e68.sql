
-- Create storage bucket for payment method icons
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-icons', 'payment-icons', true);

-- Allow anyone to view payment icons
CREATE POLICY "Anyone can view payment icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-icons');

-- Only admins can upload/update/delete payment icons
CREATE POLICY "Admins can upload payment icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payment icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'payment-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payment icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-icons' AND public.has_role(auth.uid(), 'admin'));

-- Add icon_url column to payment_methods
ALTER TABLE public.payment_methods ADD COLUMN icon_url text;
