-- ============================================
-- Luxe & Rose - Initial Database Schema
-- ============================================

-- Helper: is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. profiles
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER DEFAULT 25,
  gender TEXT NOT NULL DEFAULT 'Male' CHECK (gender IN ('Male', 'Female')),
  occupation TEXT DEFAULT '',
  income TEXT DEFAULT '',
  education TEXT DEFAULT '',
  location TEXT DEFAULT '',
  height INTEGER DEFAULT 170,
  body_type TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  image_urls TEXT[] DEFAULT ARRAY['https://picsum.photos/seed/default/400/400']::TEXT[],
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Gold', 'Black')),
  subscription TEXT DEFAULT 'Free' CHECK (subscription IN ('Free', 'Standard', 'Premium', 'Platinum')),
  subscription_until TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read approved profiles + AI profiles
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    status IN ('Approved', 'Gold', 'Black')
    OR id = auth.uid()
    OR is_ai_generated = true
    OR public.is_admin()
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Users can insert their own profile (on signup)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR public.is_admin());

-- Admins can update any profile
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- ============================================
-- 2. likes
-- ============================================
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  liked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(liker_id, liked_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select" ON public.likes
  FOR SELECT USING (liker_id = auth.uid() OR liked_id = auth.uid() OR public.is_admin());

CREATE POLICY "likes_insert" ON public.likes
  FOR INSERT WITH CHECK (liker_id = auth.uid());

CREATE POLICY "likes_delete" ON public.likes
  FOR DELETE USING (liker_id = auth.uid());

-- ============================================
-- 3. matches
-- ============================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select" ON public.matches
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid() OR public.is_admin());

CREATE POLICY "matches_insert" ON public.matches
  FOR INSERT WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- ============================================
-- 4. messages
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
    OR public.is_admin()
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- ============================================
-- 5. footprints
-- ============================================
CREATE TABLE public.footprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visited_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.footprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "footprints_select" ON public.footprints
  FOR SELECT USING (visited_id = auth.uid() OR visitor_id = auth.uid() OR public.is_admin());

CREATE POLICY "footprints_insert" ON public.footprints
  FOR INSERT WITH CHECK (visitor_id = auth.uid());

-- ============================================
-- 6. swipe_history
-- ============================================
CREATE TABLE public.swipe_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(swiper_id, swiped_id)
);

ALTER TABLE public.swipe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipe_history_select" ON public.swipe_history
  FOR SELECT USING (swiper_id = auth.uid() OR public.is_admin());

CREATE POLICY "swipe_history_insert" ON public.swipe_history
  FOR INSERT WITH CHECK (swiper_id = auth.uid());

-- ============================================
-- 7. payments
-- ============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('Standard', 'Premium', 'Platinum')),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'jpy',
  status TEXT DEFAULT 'succeeded',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_likes_liker ON public.likes(liker_id);
CREATE INDEX idx_likes_liked ON public.likes(liked_id);
CREATE INDEX idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX idx_matches_user2 ON public.matches(user2_id);
CREATE INDEX idx_messages_match ON public.messages(match_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);
CREATE INDEX idx_footprints_visited ON public.footprints(visited_id);
CREATE INDEX idx_swipe_history_swiper ON public.swipe_history(swiper_id);
CREATE INDEX idx_profiles_ai ON public.profiles(is_ai_generated) WHERE is_ai_generated = true;
CREATE INDEX idx_profiles_gender ON public.profiles(gender);

-- ============================================
-- Enable Realtime for messages
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
