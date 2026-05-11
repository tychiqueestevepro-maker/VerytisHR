-- Phase 1: LinkedIn Secure Integration Schema

-- Enums for status and types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'linkedin_account_status') THEN
        CREATE TYPE public.linkedin_account_status AS ENUM ('connected', 'disconnected', 'challenge_pending', 'error');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'linkedin_challenge_type') THEN
        CREATE TYPE public.linkedin_challenge_type AS ENUM ('email_code', 'sms_code', 'captcha');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'linkedin_challenge_status') THEN
        CREATE TYPE public.linkedin_challenge_status AS ENUM ('pending', 'solved', 'expired');
    END IF;
END $$;

-- Table: linkedin_accounts
CREATE TABLE IF NOT EXISTS public.linkedin_accounts (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL, 
    password TEXT NOT NULL, 
    proxy_config JSONB DEFAULT '{}'::jsonb,
    status public.linkedin_account_status DEFAULT 'disconnected',
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: linkedin_sessions
CREATE TABLE IF NOT EXISTS public.linkedin_sessions (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_agent TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: linkedin_challenges
CREATE TABLE IF NOT EXISTS public.linkedin_challenges (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
    challenge_type public.linkedin_challenge_type NOT NULL,
    challenge_status public.linkedin_challenge_status DEFAULT 'pending',
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company access to linkedin_accounts" ON public.linkedin_accounts
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "Company access to linkedin_sessions" ON public.linkedin_sessions
    FOR ALL USING (account_id IN (SELECT id FROM public.linkedin_accounts WHERE company_id = public.current_company_id()));

CREATE POLICY "Company access to linkedin_challenges" ON public.linkedin_challenges
    FOR ALL USING (account_id IN (SELECT id FROM public.linkedin_accounts WHERE company_id = public.current_company_id()));

-- Triggers for updated_at
CREATE TRIGGER set_linkedin_accounts_updated_at BEFORE UPDATE ON public.linkedin_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_linkedin_challenges_updated_at BEFORE UPDATE ON public.linkedin_challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexing
CREATE INDEX IF NOT EXISTS linkedin_accounts_company_id_idx ON public.linkedin_accounts(company_id);
CREATE INDEX IF NOT EXISTS linkedin_sessions_account_id_idx ON public.linkedin_sessions(account_id);
CREATE INDEX IF NOT EXISTS linkedin_challenges_account_id_idx ON public.linkedin_challenges(account_id);
