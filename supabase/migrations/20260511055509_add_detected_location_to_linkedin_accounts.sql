ALTER TABLE public.linkedin_accounts ADD COLUMN IF NOT EXISTS last_detected_ip TEXT, ADD COLUMN IF NOT EXISTS last_detected_country TEXT, ADD COLUMN IF NOT EXISTS last_detected_city TEXT;
