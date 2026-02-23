-- ============================================
-- 006: Add payment_failed flag to profiles
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT FALSE;
