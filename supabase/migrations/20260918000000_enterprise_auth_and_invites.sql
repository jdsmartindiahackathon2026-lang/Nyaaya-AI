-- Migration: Enterprise Authentication, Team Workspace Invites & Domain Matching
-- Provides secure RPCs for 24-hour invite verification, atomic redemption, and enterprise domain lookup

-- 1. Ensure indexes on tokens and auth lookups
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON public.organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_organization_invites_org_id ON public.organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- 2. Function: get_invite_details(p_token TEXT)
-- Allows unauthenticated visitors or invited users to inspect invite context (Org name, role, email)
-- without granting broad SELECT privileges on organization_invites or organizations
CREATE OR REPLACE FUNCTION public.get_invite_details(p_token TEXT)
RETURNS TABLE (
  invite_id UUID,
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  invited_email TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN,
  is_expired BOOLEAN,
  is_accepted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id AS invite_id,
    oi.org_id,
    o.name AS org_name,
    o.slug AS org_slug,
    oi.email AS invited_email,
    oi.role,
    oi.expires_at,
    (oi.accepted_at IS NULL AND oi.expires_at > NOW()) AS is_valid,
    (oi.expires_at <= NOW()) AS is_expired,
    (oi.accepted_at IS NOT NULL) AS is_accepted
  FROM public.organization_invites oi
  JOIN public.organizations o ON oi.org_id = o.id
  WHERE oi.token = p_token
  LIMIT 1;
END;
$$;

-- Grant public execute on get_invite_details so invite landing page can show context
GRANT EXECUTE ON FUNCTION public.get_invite_details(TEXT) TO anon, authenticated, service_role;

-- 3. Function: accept_workspace_invite(p_token TEXT)
-- Atomically redeems a 24-hour workspace invite for the currently authenticated user
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_user_row_id UUID;
  v_invite RECORD;
  v_org RECORD;
  v_existing_role TEXT;
BEGIN
  -- Verify caller is authenticated
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required to accept invite.');
  END IF;

  -- Lookup internal users row ID
  SELECT id INTO v_user_row_id FROM public.users WHERE auth_id = v_uid LIMIT 1;
  IF v_user_row_id IS NULL THEN
    -- If user profile is not yet created in public.users, create one using auth email
    INSERT INTO public.users (id, auth_id, language, user_type, jurisdiction)
    VALUES (
      v_uid,
      v_uid,
      'en',
      'startup',
      'india'
    )
    ON CONFLICT (auth_id) DO UPDATE SET last_active = NOW()
    RETURNING id INTO v_user_row_id;
  END IF;

  -- Lock and fetch the invite
  SELECT * INTO v_invite
    FROM public.organization_invites
   WHERE token = p_token
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Invalid invitation token.');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ACCEPTED', 'message', 'This invitation has already been accepted.');
  END IF;

  IF v_invite.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'EXPIRED', 'message', 'This 24-hour invitation link has expired. Please request a new invite from your workspace admin.');
  END IF;

  -- Fetch organization
  SELECT * INTO v_org FROM public.organizations WHERE id = v_invite.org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NOT_FOUND', 'message', 'Organization no longer exists.');
  END IF;

  -- Add user as organization member
  INSERT INTO public.organization_members (org_id, user_id, role, joined_at)
  VALUES (v_invite.org_id, v_user_row_id, v_invite.role, NOW())
  ON CONFLICT (org_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invite accepted
  UPDATE public.organization_invites
     SET accepted_at = NOW()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'org_id', v_org.id,
    'org_name', v_org.name,
    'org_slug', v_org.slug,
    'role', v_invite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated, service_role;

-- 4. Function: revoke_workspace_invite(p_invite_id UUID)
-- Allows owners and admins to cancel an active pending invite
CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_org_id UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT org_id INTO v_org_id FROM public.organization_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT om.role INTO v_caller_role
    FROM public.organization_members om
    JOIN public.users u ON om.user_id = u.id
   WHERE u.auth_id = v_uid AND om.org_id = v_org_id;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.organization_invites WHERE id = p_invite_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(UUID) TO authenticated, service_role;
