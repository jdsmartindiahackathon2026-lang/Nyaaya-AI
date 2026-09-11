-- Migration: Organizations, Team Workspaces & Multi-Tenancy Scoping
-- Includes 24-hour expiration for workspace invite links and explicit RLS policies

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  billing_tier TEXT NOT NULL DEFAULT 'free' CHECK (billing_tier IN ('free', 'starter', 'pro', 'enterprise')),
  billing_status TEXT NOT NULL DEFAULT 'active' CHECK (billing_status IN ('active', 'trialing', 'past_due', 'canceled')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

-- 3. Organization Invites Table (24-Hour Expiration per security requirements)
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  accepted_at TIMESTAMPTZ
);

-- 4. Multi-tenancy foreign keys on data entities
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.escalations
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.abs_diagnoses
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Helper function for fast RLS checks: get_user_org_ids
CREATE OR REPLACE FUNCTION public.get_user_org_ids(uid UUID)
RETURNS SETOF UUID AS $$
  SELECT om.org_id
    FROM public.organization_members om
    JOIN public.users u ON om.user_id = u.id
   WHERE u.auth_id = uid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Backfill existing users: create a default personal workspace for every existing user
DO $$
DECLARE
  u RECORD;
  new_org_id UUID;
  org_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
BEGIN
  FOR u IN SELECT id, auth_id, full_name, organisation FROM public.users LOOP
    -- Check if user already has an organization membership
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = u.id) THEN
      org_name := COALESCE(NULLIF(TRIM(u.organisation), ''), NULLIF(TRIM(u.full_name), ''), 'Personal') || ' Workspace';
      base_slug := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(org_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'));
      IF LENGTH(base_slug) = 0 THEN base_slug := 'workspace'; END IF;
      final_slug := base_slug || '-' || SUBSTRING(u.id::text, 1, 8);

      INSERT INTO public.organizations (name, slug, billing_tier, billing_status)
      VALUES (org_name, final_slug, 'free', 'active')
      RETURNING id INTO new_org_id;

      INSERT INTO public.organization_members (org_id, user_id, role)
      VALUES (new_org_id, u.id, 'owner');

      -- Backfill conversations
      UPDATE public.conversations SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      -- Backfill escalations
      UPDATE public.escalations SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      -- Backfill abs_diagnoses
      UPDATE public.abs_diagnoses SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- 7. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 8. Explicit RLS Policies for Organizations
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
  ON public.organizations
  FOR SELECT
  USING (id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Admins and Owners can update their organizations" ON public.organizations;
CREATE POLICY "Admins and Owners can update their organizations"
  ON public.organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT om.org_id
        FROM public.organization_members om
        JOIN public.users u ON om.user_id = u.id
       WHERE u.auth_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT om.org_id
        FROM public.organization_members om
        JOIN public.users u ON om.user_id = u.id
       WHERE u.auth_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can insert organizations" ON public.organizations;
CREATE POLICY "Users can insert organizations"
  ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Explicit RLS Policies for Organization Members
DROP POLICY IF EXISTS "Members can view colleagues in their org" ON public.organization_members;
CREATE POLICY "Members can view colleagues in their org"
  ON public.organization_members
  FOR SELECT
  USING (org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Admins and Owners can manage org members" ON public.organization_members;
CREATE POLICY "Admins and Owners can manage org members"
  ON public.organization_members
  FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id
        FROM public.organization_members om
        JOIN public.users u ON om.user_id = u.id
       WHERE u.auth_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
        FROM public.organization_members om
        JOIN public.users u ON om.user_id = u.id
       WHERE u.auth_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- 10. Explicit RLS Policies for Organization Invites
DROP POLICY IF EXISTS "Members can view invites in their org" ON public.organization_invites;
CREATE POLICY "Members can view invites in their org"
  ON public.organization_invites
  FOR SELECT
  USING (org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Admins and Owners can manage invites" ON public.organization_invites;
CREATE POLICY "Admins and Owners can manage invites"
  ON public.organization_invites
  FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id
        FROM public.organization_members om
        JOIN public.users u ON om.user_id = u.id
       WHERE u.auth_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
        FROM public.organization_members om
        JOIN public.users u ON om.user_id = u.id
       WHERE u.auth_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- 11. Update conversations RLS for workspace scoping
DROP POLICY IF EXISTS "Users can only access own conversations" ON public.conversations;
CREATE POLICY "Users can only access own conversations"
  ON public.conversations
  FOR ALL
  USING (
    (org_id IS NOT NULL AND org_id IN (SELECT public.get_user_org_ids(auth.uid())))
    OR
    (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  )
  WITH CHECK (
    (org_id IS NOT NULL AND org_id IN (SELECT public.get_user_org_ids(auth.uid())))
    OR
    (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  );
