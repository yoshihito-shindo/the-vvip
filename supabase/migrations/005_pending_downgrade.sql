-- ============================================
-- 005: Add pending_downgrade to profiles
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_downgrade TEXT DEFAULT NULL;
