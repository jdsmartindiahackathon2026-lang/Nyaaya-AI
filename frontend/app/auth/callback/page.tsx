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
        const { data: profile } = await supabase
          .from('users').select('id').eq('auth_id', userId).maybeSingle()
        if (profile) {
          try { localStorage.setItem('nyaaya_onboarded', '1') } catch {}
          router.replace('/app/ask')
        } else {
          router.replace('/onboarding')
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
