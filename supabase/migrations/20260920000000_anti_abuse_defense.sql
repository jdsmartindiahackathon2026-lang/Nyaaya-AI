-- Migration: 20260920000000_anti_abuse_defense.sql
-- Description: Multi-layer Anti-Abuse Defense (Hardware Device Fingerprinting, IP Velocity Limiting, and Multi-account Sybil defense)

-- 1. Device Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.device_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    period_month TEXT NOT NULL, -- Format: YYYY-MM
    free_queries_used INT NOT NULL DEFAULT 1,
    last_seen_ip TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_device_user_month UNIQUE (device_id, user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_device_usage_device_month ON public.device_usage (device_id, period_month);
CREATE INDEX IF NOT EXISTS idx_device_usage_user_id ON public.device_usage (user_id);

-- Enable RLS (Service role and internal security definer functions only)
ALTER TABLE public.device_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages device usage" ON public.device_usage;
CREATE POLICY "Service role manages device usage"
    ON public.device_usage
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. IP Activity Table (Short-term sliding window tracking)
CREATE TABLE IF NOT EXISTS public.ip_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'signup' | 'query'
    user_id UUID,
    device_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_activity_ip_action_created ON public.ip_activity (ip_address, action_type, created_at);

ALTER TABLE public.ip_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages ip activity" ON public.ip_activity;
CREATE POLICY "Service role manages ip activity"
    ON public.ip_activity
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- 3. Function to check and guard against multi-account quota bypass and IP bursts
CREATE OR REPLACE FUNCTION public.check_anti_abuse_guard(
    p_user_id UUID,
    p_device_id TEXT,
    p_client_ip TEXT,
    p_function TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    device_count INT,
    ip_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT := 'free';
    v_current_month TEXT;
    v_device_total INT := 0;
    v_ip_burst_count INT := 0;
    v_distinct_accounts_on_device INT := 0;
    v_is_service_role BOOLEAN := false;
BEGIN
    -- Determine current month in UTC
    v_current_month := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');

    -- 1. Check user billing tier
    SELECT COALESCE(tier, 'free') INTO v_tier
    FROM public.users
    WHERE auth_id = p_user_id
    LIMIT 1;

    -- Paid tiers strictly bypass hardware & IP velocity constraints
    IF v_tier IN ('starter', 'pro', 'enterprise') THEN
        RETURN QUERY SELECT true, 'paid_tier_bypass', 0, 0;
        RETURN;
    END IF;

    -- Record IP query activity for rate limiting
    IF p_client_ip IS NOT NULL AND length(trim(p_client_ip)) > 0 THEN
        INSERT INTO public.ip_activity (ip_address, action_type, user_id, device_id, created_at)
        VALUES (p_client_ip, 'query', p_user_id, p_device_id, now());

        -- Clean up old IP activity (> 24 hours) opportunistically
        DELETE FROM public.ip_activity
        WHERE created_at < now() - INTERVAL '24 hours';

        -- IP burst check: Max 30 queries per 5 minutes from a single IP for free tier
        SELECT count(*) INTO v_ip_burst_count
        FROM public.ip_activity
        WHERE ip_address = p_client_ip
          AND action_type = 'query'
          AND created_at > now() - INTERVAL '5 minutes';

        IF v_ip_burst_count > 30 THEN
            RETURN QUERY SELECT false, 'ip_rate_limit_exceeded', 0, v_ip_burst_count;
            RETURN;
        END IF;
    END IF;

    -- Device Fingerprint verification
    IF p_device_id IS NOT NULL AND length(trim(p_device_id)) > 0 THEN
        -- Check how many distinct user accounts have used this physical device in the current month
        SELECT count(DISTINCT user_id) INTO v_distinct_accounts_on_device
        FROM public.device_usage
        WHERE device_id = p_device_id
          AND period_month = v_current_month;

        -- Sybil check: If 3 or more distinct free accounts have used this device, block multi-account evasion
        IF v_distinct_accounts_on_device >= 3 AND NOT EXISTS (
            SELECT 1 FROM public.device_usage
            WHERE device_id = p_device_id
              AND user_id = p_user_id
              AND period_month = v_current_month
        ) THEN
            RETURN QUERY SELECT false, 'device_account_limit_exceeded', v_distinct_accounts_on_device, v_ip_burst_count;
            RETURN;
        END IF;

        -- Sum total queries across all accounts on this device in the current month
        SELECT COALESCE(sum(free_queries_used), 0) INTO v_device_total
        FROM public.device_usage
        WHERE device_id = p_device_id
          AND period_month = v_current_month;

        -- Cap pooled device queries to 25/month across free accounts (preventing 10 accounts * 10 queries = 100 free queries)
        IF v_device_total >= 25 THEN
            RETURN QUERY SELECT false, 'device_monthly_quota_exceeded', v_device_total, v_ip_burst_count;
            RETURN;
        END IF;

        -- Upsert record for current user + device + month
        INSERT INTO public.device_usage (device_id, user_id, period_month, free_queries_used, last_seen_ip, last_seen_at)
        VALUES (p_device_id, p_user_id, v_current_month, 1, p_client_ip, now())
        ON CONFLICT (device_id, user_id, period_month)
        DO UPDATE SET
            free_queries_used = public.device_usage.free_queries_used + 1,
            last_seen_ip = p_client_ip,
            last_seen_at = now();
    END IF;

    RETURN QUERY SELECT true, 'allowed', v_device_total + 1, v_ip_burst_count;
END;
$$;


-- 4. Function to check signup velocity per IP (Max 5 signups per 24 hours per IP)
CREATE OR REPLACE FUNCTION public.check_signup_velocity(
    p_client_ip TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    signup_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    IF p_client_ip IS NULL OR length(trim(p_client_ip)) = 0 THEN
        RETURN QUERY SELECT true, 'ip_unknown', 0;
        RETURN;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.ip_activity
    WHERE ip_address = p_client_ip
      AND action_type = 'signup'
      AND created_at > now() - INTERVAL '24 hours';

    IF v_count >= 5 THEN
        RETURN QUERY SELECT false, 'ip_signup_velocity_exceeded', v_count;
        RETURN;
    END IF;

    -- Record signup event
    INSERT INTO public.ip_activity (ip_address, action_type, created_at)
    VALUES (p_client_ip, 'signup', now());

    RETURN QUERY SELECT true, 'allowed', v_count + 1;
END;
$$;
