'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function RootPage() {
  const router = useRouter()
  const [msg, setMsg] = useState('Loading Nyaaya AI…')

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      try {
        const { data: profile } = await supabase
          .from('users').select('id').eq('auth_id', session.user.id).maybeSingle()
        if (profile) {
          try { localStorage.setItem('nyaaya_onboarded', '1') } catch {}
          router.replace('/app/ask')
        } else {
          router.replace('/onboarding')
        }
      } catch {
        setMsg('Something went wrong. Retrying…')
        router.replace('/onboarding')
      }
    })()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060b0a', color: '#b7d4c5',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14,
    }}>{msg}</div>
  )
}
