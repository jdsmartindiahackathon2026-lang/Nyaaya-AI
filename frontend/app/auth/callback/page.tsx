'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AuthCallbackWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#060b0a' }} />}>
      <AuthCallback />
    </Suspense>
  )
}

function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()
  const [msg, setMsg] = useState('Completing sign-in…')

  useEffect(() => {
    ;(async () => {
      // Supabase JS auto-processes the URL hash / code param on load.
      const { data: { session } } = await supabase.auth.getSession()
      const errorDesc = params?.get('error_description') || params?.get('error')
      if (errorDesc) {
        router.replace(`/login?error_description=${encodeURIComponent(errorDesc)}`)
        return
      }
      if (!session) {
        setMsg('Waiting for session…')
        // Give the SDK a beat to hydrate from URL, then re-check
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          if (!s2) { router.replace('/login'); return }
          await routeUser(s2.user.id)
        }, 400)
        return
      }
      await routeUser(session.user.id)
    })()

    async function routeUser(userId: string) {
      try {
        const inviteToken = params?.get('invite')
        if (inviteToken) {
          try {
            const { data: invRes } = await supabase.rpc('accept_workspace_invite', { p_token: inviteToken })
            if (invRes && (invRes as any).success && (invRes as any).org_id) {
              localStorage.setItem('nyaaya_active_org_id', (invRes as any).org_id)
            }
          } catch (invErr) {
            console.error('Failed to auto-accept invite during callback:', invErr)
          }
        }

        const { data: profile } = await supabase
          .from('users').select('id, full_name, avatar_url').eq('auth_id', userId).maybeSingle()

        // Sync Google OAuth metadata to public.users if not present
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser?.user_metadata) {
          const meta = currentUser.user_metadata
          const fullName = meta.full_name || meta.name || ''
          const avatarUrl = meta.avatar_url || meta.picture || ''
          if (profile && (!profile.full_name || !profile.avatar_url) && (fullName || avatarUrl)) {
            await supabase.from('users').update({
              ...(fullName && !profile.full_name ? { full_name: fullName } : {}),
              ...(avatarUrl && !profile.avatar_url ? { avatar_url: avatarUrl } : {}),
            }).eq('id', profile.id)
          }
        }

        if (profile) {
          try { localStorage.setItem('nyaaya_onboarded', '1') } catch {}
          router.replace('/app/ask')
        } else {
          router.replace(inviteToken ? `/onboarding?invite=${encodeURIComponent(inviteToken)}` : '/onboarding')
        }
      } catch {
        router.replace('/onboarding')
      }
    }
  }, [router, params])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060b0a', color: '#b7d4c5',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14,
    }}>
      {msg}
    </div>
  )
}
