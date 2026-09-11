'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string
  billing_tier: 'free' | 'starter' | 'pro' | 'enterprise'
  billing_status: 'active' | 'trialing' | 'past_due' | 'canceled'
  role: OrgRole
}

interface WorkspaceContextType {
  activeOrg: Organization | null
  userOrgs: Organization[]
  loading: boolean
  error: string | null
  switchWorkspace: (orgId: string) => void
  createWorkspace: (name: string) => Promise<Organization | null>
  refreshWorkspaces: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeOrg: null,
  userOrgs: [],
  loading: true,
  error: null,
  switchWorkspace: () => {},
  createWorkspace: async () => null,
  refreshWorkspaces: async () => {},
})

const STORAGE_KEY = 'nyaaya_active_org_id'

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null)
  const [userOrgs, setUserOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkspaces = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserOrgs([])
        setActiveOrg(null)
        setLoading(false)
        return
      }

      // 1. Fetch user's internal users.id
      const { data: userRow } = await supabase
        .from('users')
        .select('id, full_name, organisation')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!userRow) {
        setLoading(false)
        return
      }

      // 2. Fetch user's memberships
      const { data: memberships, error: memErr } = await supabase
        .from('organization_members')
        .select('role, org_id, organizations:org_id ( id, name, slug, billing_tier, billing_status )')
        .eq('user_id', userRow.id)

      if (memErr) throw memErr

      let orgsList: Organization[] = []
      if (memberships && memberships.length > 0) {
        orgsList = memberships
          .map(m => {
            const org = (m as any).organizations
            if (!org) return null
            return {
              id: org.id,
              name: org.name,
              slug: org.slug,
              billing_tier: org.billing_tier,
              billing_status: org.billing_status,
              role: m.role as OrgRole,
            }
          })
          .filter((o): o is Organization => o !== null)
      }

      // 3. If no workspace exists yet (e.g. newly registered before migration), create default personal
      if (orgsList.length === 0) {
        const defaultName = (userRow.organisation?.trim() || userRow.full_name?.trim() || 'Personal') + ' Workspace'
        const baseSlug = defaultName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'
        const finalSlug = `${baseSlug}-${userRow.id.slice(0, 8)}`

        const { data: newOrg, error: newOrgErr } = await supabase
          .from('organizations')
          .insert({ name: defaultName, slug: finalSlug, billing_tier: 'free', billing_status: 'active' })
          .select()
          .single()

        if (!newOrgErr && newOrg) {
          await supabase.from('organization_members').insert({ org_id: newOrg.id, user_id: userRow.id, role: 'owner' })
          const created: Organization = {
            id: newOrg.id,
            name: newOrg.name,
            slug: newOrg.slug,
            billing_tier: newOrg.billing_tier,
            billing_status: newOrg.billing_status,
            role: 'owner',
          }
          orgsList = [created]
        }
      }

      setUserOrgs(orgsList)

      // Restore active workspace from localStorage or default to first
      const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const matched = orgsList.find(o => o.id === storedOrgId)
      const selected = matched ?? orgsList[0] ?? null
      setActiveOrg(selected)
      if (selected && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, selected.id)
      }
    } catch (err: unknown) {
      console.error('Workspace fetch error:', err)
      setError(err instanceof Error ? err.message : 'Could not load workspaces')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const switchWorkspace = useCallback((orgId: string) => {
    const target = userOrgs.find(o => o.id === orgId)
    if (target) {
      setActiveOrg(target)
      try { localStorage.setItem(STORAGE_KEY, target.id) } catch {}
    }
  }, [userOrgs])

  const createWorkspace = useCallback(async (name: string): Promise<Organization | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!userRow) return null

      const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'
      const finalSlug = `${baseSlug}-${Date.now().toString(36)}`

      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: name.trim(), slug: finalSlug, billing_tier: 'free', billing_status: 'active' })
        .select()
        .single()

      if (orgErr || !orgData) throw orgErr || new Error('Failed to create organization')

      const { error: memErr } = await supabase
        .from('organization_members')
        .insert({ org_id: orgData.id, user_id: userRow.id, role: 'owner' })

      if (memErr) throw memErr

      const created: Organization = {
        id: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
        billing_tier: orgData.billing_tier,
        billing_status: orgData.billing_status,
        role: 'owner',
      }

      setUserOrgs(prev => [...prev, created])
      setActiveOrg(created)
      try { localStorage.setItem(STORAGE_KEY, created.id) } catch {}
      return created
    } catch (err: unknown) {
      console.error('Create workspace error:', err)
      throw err
    }
  }, [])

  return (
    <WorkspaceContext.Provider
      value={{
        activeOrg,
        userOrgs,
        loading,
        error,
        switchWorkspace,
        createWorkspace,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
