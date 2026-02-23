-- ============================================
-- Add verification_image_url to profiles
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_image_url TEXT;

-- ============================================
-- Storage bucket for verification documents
-- ============================================
-- NOTE: Supabase Storage buckets are typically created via the Dashboard.
-- Go to Supabase Dashboard > Storage > New Bucket:
--   Name: verification-docs
--   Public: false (private)
--
-- Then add the following RLS policies in the Dashboard:
--
-- Policy 1: Users can upload their own documents
--   Operation: INSERT
--   Policy: (bucket_id = 'verification-docs') AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 2: Users can view their own documents
--   Operation: SELECT
--   Policy: (bucket_id = 'verification-docs') AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 3: Admins can view all documents
--   Operation: SELECT
--   Policy: (bucket_id = 'verification-docs') AND public.is_admin()

-- If your Supabase version supports it, you can also run:
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "verification_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "verification_select_own" ON storage.objects
  FOR SELECT USING (bucket_id = 'verification-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
