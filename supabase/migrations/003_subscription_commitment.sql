-- ============================================
-- 003: Subscription commitment tracking
-- 3ヶ月最低契約期間の管理に必要なカラム追加
-- ============================================

-- profiles テーブルにサブスク管理カラム追加
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

-- subscription の CHECK 制約を現行プラン名に更新
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_check
  CHECK (subscription IN ('Free', 'Gold', 'Platinum', 'VVIP'));

-- payments テーブルの plan CHECK 制約も更新
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_plan_check
  CHECK (plan IN ('Gold', 'Platinum', 'VVIP'));
