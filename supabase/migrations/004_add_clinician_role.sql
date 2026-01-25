-- ============================================
-- PNVGPT: Add Clinician Role
-- Run this in Supabase SQL Editor if database already exists
-- ============================================

-- If the CHECK constraint already exists, we need to drop and recreate it
-- First, drop the existing constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add the new constraint with 'clinician' role included
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('user', 'admin', 'staff', 'clinician'));

-- ============================================
-- To update an existing user to clinician role:
-- UPDATE public.user_profiles SET role = 'clinician' WHERE email = 'doctor@test.com';
-- ============================================
