-- ============================================
-- PNVGPT User Chats Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create user_chats table
CREATE TABLE IF NOT EXISTS public.user_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS user_chats_user_id_idx ON public.user_chats(user_id);
CREATE INDEX IF NOT EXISTS user_chats_updated_at_idx ON public.user_chats(updated_at DESC);

-- Step 3: Enable Row Level Security
ALTER TABLE public.user_chats ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies

-- Users can read their own chats
CREATE POLICY "Users can view own chats"
  ON public.user_chats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chats
CREATE POLICY "Users can create own chats"
  ON public.user_chats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own chats
CREATE POLICY "Users can update own chats"
  ON public.user_chats
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own chats
CREATE POLICY "Users can delete own chats"
  ON public.user_chats
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 5: Create updated_at trigger
CREATE TRIGGER update_user_chats_updated_at
  BEFORE UPDATE ON public.user_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE! User Chats table is ready.
-- ============================================
