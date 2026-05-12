ALTER TABLE public.linkedin_challenges
  ADD COLUMN IF NOT EXISTS challenge_hint TEXT;
