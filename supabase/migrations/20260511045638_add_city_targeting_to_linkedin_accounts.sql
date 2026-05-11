-- Add city targeting to LinkedIn accounts
ALTER TABLE public.linkedin_accounts ADD COLUMN IF NOT EXISTS preferred_city TEXT;
