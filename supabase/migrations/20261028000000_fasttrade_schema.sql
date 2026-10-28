-- ============================================================================
-- FastTrade Institutional Quantitative SOR Terminal v2.0
-- Self-Hosted Supabase PostgreSQL Schema & Seed Migration
-- Target: https://fasttrade-sb.propixer.in
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.fasttrade_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'trader' CHECK (role IN ('admin', 'trader', 'analyst')),
    title TEXT NOT NULL DEFAULT 'Quantitative Execution Trader',
    organization TEXT NOT NULL DEFAULT 'FastTrade Institutional Desk',
    preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    simulations_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fasttrade_users_email ON public.fasttrade_users (email);
CREATE INDEX IF NOT EXISTS idx_fasttrade_users_role ON public.fasttrade_users (role);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS public.fasttrade_sessions (
    token TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.fasttrade_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fasttrade_sessions_user_id ON public.fasttrade_sessions (user_id);

-- 3. Immutable Governance Audit Logs Table
CREATE TABLE IF NOT EXISTS public.fasttrade_audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fasttrade_audit_logs_created_at ON public.fasttrade_audit_logs (created_at DESC);

-- 4. Global Institutional Risk Guardrails Config Table
CREATE TABLE IF NOT EXISTS public.fasttrade_system_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    config_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable Row Level Security (RLS) per Supabase Security Best Practices
ALTER TABLE public.fasttrade_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasttrade_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasttrade_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasttrade_system_config ENABLE ROW LEVEL SECURITY;

-- 6. Expose tables to Data API Roles (service_role full access, authenticated/anon read where appropriate)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fasttrade_users TO service_role;
GRANT ALL ON TABLE public.fasttrade_sessions TO service_role;
GRANT ALL ON TABLE public.fasttrade_audit_logs TO service_role;
GRANT ALL ON TABLE public.fasttrade_system_config TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.fasttrade_users TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.fasttrade_sessions TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.fasttrade_audit_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fasttrade_system_config TO anon, authenticated;

-- Policies for backend API access via anon/service_role key
DROP POLICY IF EXISTS "fasttrade_users_api_access" ON public.fasttrade_users;
CREATE POLICY "fasttrade_users_api_access"
    ON public.fasttrade_users
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "fasttrade_sessions_api_access" ON public.fasttrade_sessions;
CREATE POLICY "fasttrade_sessions_api_access"
    ON public.fasttrade_sessions
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "fasttrade_audit_logs_api_access" ON public.fasttrade_audit_logs;
CREATE POLICY "fasttrade_audit_logs_api_access"
    ON public.fasttrade_audit_logs
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "fasttrade_system_config_api_access" ON public.fasttrade_system_config;
CREATE POLICY "fasttrade_system_config_api_access"
    ON public.fasttrade_system_config
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
