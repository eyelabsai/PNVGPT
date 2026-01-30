-- ============================================
-- PNVGPT: Clinician Coaching Sessions
-- Stores transcripts and AI feedback for clinician coaching
-- ============================================

-- Create coaching sessions table
CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  analysis_result JSONB NOT NULL,
  rubric_id TEXT,
  score_overall INTEGER,
  score_coverage INTEGER,
  score_safety INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS coaching_sessions_user_id_idx ON public.coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS coaching_sessions_created_at_idx ON public.coaching_sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own coaching sessions
CREATE POLICY "Users can view own coaching sessions"
  ON public.coaching_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own coaching sessions
CREATE POLICY "Users can insert own coaching sessions"
  ON public.coaching_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all coaching sessions
CREATE POLICY "Admins can view all coaching sessions"
  ON public.coaching_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
