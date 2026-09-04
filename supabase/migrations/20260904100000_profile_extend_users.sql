-- Migration: extend public.users for profile screen
-- Adds profile fields and relaxes language CHECK to include Tamil

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS organisation text,
  ADD COLUMN IF NOT EXISTS role_in_org text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS languages_spoken text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_active timestamptz DEFAULT now();

-- Relax language CHECK to include Tamil ('ta')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_language_check;
ALTER TABLE public.users ADD CONSTRAINT users_language_check
  CHECK (language IN ('en', 'hi', 'bn', 'ta'));
