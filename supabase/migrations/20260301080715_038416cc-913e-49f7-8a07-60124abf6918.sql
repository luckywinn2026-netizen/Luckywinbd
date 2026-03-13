
-- Add NID columns to agent_applications
ALTER TABLE public.agent_applications
ADD COLUMN nid_number text,
ADD COLUMN nid_front_url text,
ADD COLUMN nid_back_url text,
ADD COLUMN live_photo_url text;

-- Create storage bucket for agent documents
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-documents', 'agent-documents', true);

-- Storage policies
CREATE POLICY "Anyone can upload agent documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agent-documents');

CREATE POLICY "Anyone can view agent documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-documents');

CREATE POLICY "Admins can delete agent documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'agent-documents' AND has_role(auth.uid(), 'admin'::app_role));
