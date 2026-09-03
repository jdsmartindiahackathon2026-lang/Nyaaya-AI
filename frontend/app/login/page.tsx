'use client'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Mode = 'login' | 'signup'

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#060b0a' }} />}>
      <LoginPage />
    </Suspense>
  )
}

// ─── Deterministic random particle sets (built once) ─────────────────────────
function makeLeaves() {
  return Array.from({ length: 16 }, () => ({
    size: 12 + Math.round(Math.random() * 10),
    left: Math.round(Math.random() * 100) + '%',
    opacity: (0.2 + Math.random() * 0.3).toFixed(2),
    duration: (14 + Math.random() * 10).toFixed(1) + 's',
    delay: (-Math.random() * 20).toFixed(1) + 's',
    dx: Math.round((Math.random() - 0.5) * 200) + 'px',
    rot: Math.round(180 + Math.random() * 360) + 'deg',
  }))
}
function makeFireflies() {
  return Array.from({ length: 14 }, () => ({
    left: Math.round(Math.random() * 100) + '%',
    top: Math.round(Math.random() * 100) + '%',
    size: (3 + Math.random() * 3).toFixed(1) + 'px',
    duration: (8 + Math.random() * 6).toFixed(1) + 's',
    flickerDuration: (1.5 + Math.random() * 2).toFixed(1) + 's',
    delay: (-Math.random() * 12).toFixed(1) + 's',
    fx: Math.round((Math.random() - 0.5) * 120) + 'px',
    fy: Math.round((Math.random() - 0.5) * 120) + 'px',
    fx2: Math.round((Math.random() - 0.5) * 160) + 'px',
    fy2: Math.round((Math.random() - 0.5) * 160) + 'px',
  }))
}
function makeParticles() {
  return Array.from({ length: 20 }, () => ({
    left: Math.round(Math.random() * 100) + '%',
    bottom: Math.round(Math.random() * 20) + '%',
    size: (2 + Math.random() * 3).toFixed(1) + 'px',
    duration: (5 + Math.random() * 5).toFixed(1) + 's',
    delay: (-Math.random() * 10).toFixed(1) + 's',
    rise: '-' + Math.round(300 + Math.random() * 300) + 'px',
  }))
}
function makeButterflies() {
  return Array.from({ length: 10 }, () => ({
    left: Math.round(5 + Math.random() * 90) + '%',
    top: Math.round(5 + Math.random() * 90) + '%',
    size: (22 + Math.random() * 10).toFixed(0) + 'px',
    duration: (14 + Math.random() * 10).toFixed(1) + 's',
    flapDuration: (0.3 + Math.random() * 0.2).toFixed(2) + 's',
    delay: (-Math.random() * 14).toFixed(1) + 's',
    bx1: Math.round((Math.random() - 0.5) * 500) + 'px',
    by1: Math.round((Math.random() - 0.5) * 400) + 'px',
    bx2: Math.round((Math.random() - 0.5) * 600) + 'px',
    by2: Math.round((Math.random() - 0.5) * 500) + 'px',
    bx3: Math.round((Math.random() - 0.5) * 500) + 'px',
    by3: Math.round((Math.random() - 0.5) * 400) + 'px',
  }))
}
function makeStreaks() {
  return Array.from({ length: 6 }, () => {
    const startX = Math.round(20 + Math.random() * 60)
    const endX = startX + Math.round((Math.random() - 0.5) * 30)
    const midX = (startX + endX) / 2 + Math.round((Math.random() - 0.5) * 20)
    return {
      d: `M ${startX}% 92% Q ${midX}% 55%, ${endX}% 15%`,
      width: (1 + Math.random() * 1.5).toFixed(1),
      duration: (6 + Math.random() * 4).toFixed(1) + 's',
      delay: (-Math.random() * 10).toFixed(1) + 's',
    }
  })
}

function passwordStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showEmailError, setShowEmailError] = useState(false)
  const [showPasswordError, setShowPasswordError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'error' | 'info' | 'success'; text: string } | null>(null)
  const [mx, setMx] = useState(0)
  const [my, setMy] = useState(0)

  // Build particle sets once
  const leaves = useMemo(makeLeaves, [])
  const fireflies = useMemo(makeFireflies, [])
  const particles = useMemo(makeParticles, [])
  const butterflies = useMemo(makeButterflies, [])
  const streaks = useMemo(makeStreaks, [])

  const bgRef = useRef<HTMLDivElement | null>(null)

  // If already signed in, bounce out based on profile
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || !session) return
      await routeAuthedUser(session.user.id)
    })()
    return () => { cancelled = true }
  }, [])

  // Surface OAuth-callback errors, if any
  useEffect(() => {
    const err = searchParams?.get('error_description') || searchParams?.get('error')
    if (err) setBanner({ tone: 'error', text: decodeURIComponent(err) })
  }, [searchParams])

  async function routeAuthedUser(userId: string) {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .maybeSingle()
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

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = bgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMx((e.clientX - rect.left) / rect.width - 0.5)
    setMy((e.clientY - rect.top) / rect.height - 0.5)
  }

  const isSignup = mode === 'signup'
  const strength = passwordStrength(password)
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['#e2836a', '#e2836a', '#d9b25a', '#8fbf7a', '#5ac9a8']

  const parallaxBack = `${mx * 14}px, ${my * 14}px`
  const parallaxMid = `${mx * -20}px, ${my * -20}px`
  const parallaxFront = `${mx * -32}px, ${my * -32}px`

  async function onGoogle() {
    setBanner(null)
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) setBanner({ tone: 'error', text: error.message })
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message ?? 'Google sign-in failed' })
    }
  }

  async function onForgot(e: React.MouseEvent) {
    e.preventDefault()
    setBanner(null)
    const validEmail = /\S+@\S+\.\S+/.test(email)
    if (!validEmail) {
      setShowEmailError(true)
      setBanner({ tone: 'info', text: 'Enter your email above, then click Forgot password again.' })
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?reset=1`,
      })
      if (error) setBanner({ tone: 'error', text: error.message })
      else setBanner({ tone: 'success', text: 'Password reset link sent. Check your inbox.' })
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message ?? 'Could not send reset email' })
    }
  }

  async function submit() {
    if (submitting) return
    setBanner(null)
    const validEmail = /\S+@\S+\.\S+/.test(email)
    if (!validEmail) { setShowEmailError(true); return }

    if (isSignup) {
      if (password.length < 8) {
        setShowPasswordError(true)
        setTimeout(() => setShowPasswordError(false), 500)
        setBanner({ tone: 'error', text: 'Password must be at least 8 characters.' })
        return
      }
      if (password !== confirmPassword) {
        setBanner({ tone: 'error', text: 'Passwords do not match.' })
        return
      }
      if (!termsAccepted) {
        setBanner({ tone: 'error', text: 'Please accept the Terms & Privacy Policy.' })
        return
      }
      setSubmitting(true)
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: name ? { full_name: name } : undefined,
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) { setBanner({ tone: 'error', text: error.message }); return }
        if (data.session) {
          await routeAuthedUser(data.session.user.id)
        } else {
          setBanner({ tone: 'success', text: 'Check your inbox to confirm your email, then sign in.' })
          setMode('login')
        }
      } finally {
        setSubmitting(false)
      }
    } else {
      if (password.length < 4) {
        setShowPasswordError(true)
        setTimeout(() => setShowPasswordError(false), 500)
        return
      }
      setSubmitting(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setShowPasswordError(true)
          setTimeout(() => setShowPasswordError(false), 500)
          setBanner({ tone: 'error', text: error.message })
          return
        }
        if (data.session) await routeAuthedUser(data.session.user.id)
      } finally {
        setSubmitting(false)
      }
    }
  }

  const emailBorder = showEmailError ? '#e2836a' : 'rgba(90,201,168,0.25)'
  const passwordBorder = showPasswordError ? '#e2836a' : 'rgba(90,201,168,0.25)'
  const confirmBorder = (confirmPassword && confirmPassword !== password) ? '#e2836a' : 'rgba(90,201,168,0.25)'
  const passwordInputType = passwordVisible ? 'text' : 'password'
  const passwordToggleLabel = passwordVisible ? 'HIDE' : 'SHOW'

  return (
    <>
      <style jsx global>{`
        @keyframes loginRiseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes loginLeafDrift { from { transform: translate(0, -10vh) rotate(0deg); } to { transform: translate(var(--dx), 110vh) rotate(var(--rot)); } }
        @keyframes loginShake { 10%,90% { transform: translateX(-1px); } 20%,80% { transform: translateX(2px); } 30%,50%,70% { transform: translateX(-4px); } 40%,60% { transform: translateX(4px); } }
        @keyframes loginFireflyDrift { 0% { transform: translate(0,0) scale(0.8); opacity: 0; } 15% { opacity: 1; } 50% { transform: translate(var(--fx), var(--fy)) scale(1.2); } 85% { opacity: 1; } 100% { transform: translate(var(--fx2), var(--fy2)) scale(0.8); opacity: 0; } }
        @keyframes loginFlicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes loginBgBreathe { 0%, 100% { transform: scale(1.02); } 50% { transform: scale(1.06); } }
        @keyframes loginTreeGlow { 0%, 100% { filter: brightness(1.18) saturate(1.3); } 50% { filter: brightness(1.32) saturate(1.45); } }
        @keyframes loginTreeAura { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes loginParticleRise { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(var(--rise)) scale(1); opacity: 0; } }
        @keyframes loginButterflyFlutter { 0% { transform: translate(0,0) rotate(0deg); } 25% { transform: translate(var(--bx1), var(--by1)) rotate(-8deg); } 50% { transform: translate(var(--bx2), var(--by2)) rotate(6deg); } 75% { transform: translate(var(--bx3), var(--by3)) rotate(-4deg); } 100% { transform: translate(0,0) rotate(0deg); } }
        @keyframes loginWingFlap { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.35); } }
        @keyframes loginStreakRise { 0% { opacity: 0; stroke-dashoffset: 400; } 20% { opacity: 0.9; } 80% { opacity: 0.6; } 100% { opacity: 0; stroke-dashoffset: 0; } }
        .login-input::placeholder { color: #6a8a7e; }
        .login-input:focus { outline: none; }
        html, body { background: #060b0a !important; overscroll-behavior: none; }
      `}</style>

      <div
        ref={bgRef}
        onMouseMove={handleMouseMove}
        style={{
          position: 'relative', minHeight: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          color: '#eaf3ee', overflow: 'hidden', padding: '48px 24px',
          background: '#060b0a',
        }}
      >
        {/* BG image */}
        <div style={{ position: 'absolute', inset: '-6%', zIndex: 0, transform: `translate(${parallaxBack})`, transition: 'transform 400ms ease-out' }}>
          <img
            src="/yggdrasil-bg.png"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(1.18) saturate(1.3)', animation: 'loginBgBreathe 30s ease-in-out infinite, loginTreeGlow 6s ease-in-out infinite' }}
          />
        </div>

        {/* Vertical gradient */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(5,10,9,0.7) 0%, rgba(5,10,9,0.45) 40%, rgba(4,9,8,0.85) 100%)' }} />

        {/* Radial aura */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse 55% 45% at 50% 32%, rgba(95,240,196,0.22), transparent 70%)', animation: 'loginTreeAura 6s ease-in-out infinite' }} />

        {/* Falling leaves */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, transform: `translate(${parallaxMid})`, transition: 'transform 400ms ease-out' }}>
          {leaves.map((leaf, i) => (
            <svg key={i} width={leaf.size} height={leaf.size} viewBox="0 0 24 24"
              style={{ position: 'absolute', left: leaf.left, top: -40, opacity: Number(leaf.opacity), animation: `loginLeafDrift ${leaf.duration} linear ${leaf.delay} infinite`, ['--dx' as any]: leaf.dx, ['--rot' as any]: leaf.rot }}>
              <path d="M12 2C7 6 3 10 3 15a9 9 0 0 0 9 7 9 9 0 0 0 9-7c0-5-4-9-9-13z" fill="#4fd6b5" />
            </svg>
          ))}
        </div>

        {/* Fireflies */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, transform: `translate(${parallaxFront})`, transition: 'transform 400ms ease-out' }}>
          {fireflies.map((fly, i) => (
            <div key={i} style={{
              position: 'absolute', left: fly.left, top: fly.top,
              width: fly.size, height: fly.size, borderRadius: '50%',
              background: '#a6f5db', boxShadow: '0 0 8px 2px rgba(166,245,219,0.85)',
              animation: `loginFireflyDrift ${fly.duration} ease-in-out ${fly.delay} infinite, loginFlicker ${fly.flickerDuration} ease-in-out ${fly.delay} infinite`,
              ['--fx' as any]: fly.fx, ['--fy' as any]: fly.fy,
              ['--fx2' as any]: fly.fx2, ['--fy2' as any]: fly.fy2,
            }} />
          ))}
        </div>

        {/* Streaks */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, transform: `translate(${parallaxMid})`, transition: 'transform 400ms ease-out' }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {streaks.map((st, i) => (
              <path key={i} d={st.d} stroke="#5ff0c4" strokeWidth={st.width} fill="none" opacity={0}
                style={{ filter: 'drop-shadow(0 0 4px #5ff0c4)', strokeDasharray: 400, animation: `loginStreakRise ${st.duration} ease-in ${st.delay} infinite` }} />
            ))}
          </svg>
        </div>

        {/* Rising particles */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, transform: `translate(${parallaxFront})`, transition: 'transform 400ms ease-out' }}>
          {particles.map((pt, i) => (
            <div key={i} style={{
              position: 'absolute', left: pt.left, bottom: pt.bottom,
              width: pt.size, height: pt.size, borderRadius: '50%',
              background: '#6ff5c8', boxShadow: '0 0 10px 3px rgba(111,245,200,0.9)',
              animation: `loginParticleRise ${pt.duration} ease-in-out ${pt.delay} infinite`,
              ['--rise' as any]: pt.rise,
            }} />
          ))}
        </div>

        {/* Butterflies */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          {butterflies.map((b, i) => (
            <div key={i} style={{
              position: 'absolute', left: b.left, top: b.top,
              width: b.size, height: b.size,
              animation: `loginButterflyFlutter ${b.duration} ease-in-out ${b.delay} infinite`,
              ['--bx1' as any]: b.bx1, ['--by1' as any]: b.by1,
              ['--bx2' as any]: b.bx2, ['--by2' as any]: b.by2,
              ['--bx3' as any]: b.bx3, ['--by3' as any]: b.by3,
            }}>
              <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 6px #34d399)' }}>
                <g style={{ animation: `loginWingFlap ${b.flapDuration} ease-in-out infinite`, transformOrigin: '12px 12px' }}>
                  <path d="M12 12C10 6 4 4 3 7c-1 3 3 6 9 5z" fill="#34d399" />
                  <path d="M12 12C14 6 20 4 21 7c1 3-3 6-9 5z" fill="#34d399" />
                  <path d="M12 12C10 16 5 18 4 16c-1-2 2-5 8-4z" fill="#2bb583" />
                  <path d="M12 12C14 16 19 18 20 16c1-2-2-5-8-4z" fill="#2bb583" />
                </g>
                <rect x="11.3" y="9" width="1.4" height="7" rx="0.7" fill="#0b1512" />
              </svg>
            </div>
          ))}
        </div>

        {/* Vignette */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, boxShadow: 'inset 0 0 400px 120px rgba(0,0,0,0.75)' }} />

        {/* Card */}
        <div style={{ position: 'relative', zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, maxWidth: 400, width: '100%', animation: 'loginRiseIn 500ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', color: '#f2f6f3', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
              {isSignup ? 'Create your account' : 'Welcome back'}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: '#b7d4c5', textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}>
              {isSignup ? 'Set up access to Nyaaya AI' : 'Sign in to continue to Nyaaya AI'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', padding: 28, borderRadius: 16, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(8,18,16,0.72)', backdropFilter: 'blur(10px)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>

            <button type="button" onClick={onGoogle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid #2c5040', background: '#0e1f18', color: '#e7ede9', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background 180ms, border-color 180ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#163727'; e.currentTarget.style.borderColor = '#3a6c53' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0e1f18'; e.currentTarget.style.borderColor = '#2c5040' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#7fd9ae" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.26h2.92C16.68 14.2 17.64 11.9 17.64 9.2z" />
                <path fill="#a8c9b8" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.55-1.85.87-3.04.87-2.34 0-4.32-1.58-5.03-3.7H.96v2.33C2.44 15.98 5.48 18 9 18z" />
                <path fill="#6f9683" d="M3.97 10.73A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.19.29-1.73V4.94H.96A8.97 8.97 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.33z" />
                <path fill="#c8e4d5" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6a8a7e', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(90,201,168,0.2)' }} />OR<div style={{ flex: 1, height: 1, background: 'rgba(90,201,168,0.2)' }} />
            </div>

            {isSignup && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fb0a0' }}>Full name</label>
                <input className="login-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14 }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fb0a0' }}>Email</label>
              <input className="login-input" type="email" value={email} onChange={e => { setEmail(e.target.value); setShowEmailError(false) }} placeholder="you@example.com"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1px solid ${emailBorder}`, background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14 }} />
              {showEmailError && <div style={{ fontSize: 12, color: '#e2836a' }}>Enter a valid email address</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fb0a0' }}>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input className="login-input" type={passwordInputType} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  onKeyDown={e => { if (e.key === 'Enter') submit() }}
                  style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: 9, border: `1px solid ${passwordBorder}`, background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14 }} />
                <button type="button" onClick={() => setPasswordVisible(v => !v)}
                  style={{ position: 'absolute', right: 10, background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#7fb0a0', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {passwordToggleLabel}
                </button>
              </div>
              {showPasswordError && <div style={{ fontSize: 12, color: '#e2836a', animation: 'loginShake 400ms' }}>Incorrect password</div>}
              {isSignup && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                  <div style={{ display: 'flex', gap: 4, height: 4 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{ flex: 1, borderRadius: 2, background: i < strength ? strengthColors[strength] : 'rgba(90,201,168,0.2)' }} />
                    ))}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: strengthColors[strength] }}>
                    {password ? strengthLabels[strength] : ''}
                  </div>
                </div>
              )}
            </div>

            {isSignup && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fb0a0' }}>Confirm password</label>
                <input className="login-input" type={passwordInputType} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1px solid ${confirmBorder}`, background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14 }} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {isSignup ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#b7d4c5', cursor: 'pointer' }}>
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#5ac9a8' }} />
                  I agree to the Terms &amp; Privacy Policy
                </label>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#b7d4c5', cursor: 'pointer' }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#5ac9a8' }} />
                    Remember me
                  </label>
                  <a href="#" onClick={onForgot} style={{ fontSize: 13, color: '#5ac9a8', textDecoration: 'none' }}>Forgot password?</a>
                </>
              )}
            </div>

            {banner && (
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${banner.tone === 'error' ? 'rgba(226,131,106,0.35)' : banner.tone === 'success' ? 'rgba(90,201,168,0.35)' : 'rgba(217,178,90,0.35)'}`,
                background: banner.tone === 'error' ? 'rgba(226,131,106,0.10)' : banner.tone === 'success' ? 'rgba(90,201,168,0.10)' : 'rgba(217,178,90,0.10)',
                color: banner.tone === 'error' ? '#e2836a' : banner.tone === 'success' ? '#5ac9a8' : '#d9b25a',
              }}>{banner.text}</div>
            )}

            <button type="button" onClick={submit} disabled={submitting}
              style={{ width: '100%', padding: '13px 0', borderRadius: 999, border: 'none', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', transition: 'transform 180ms', background: '#5ac9a8', color: '#06120f', opacity: submitting ? 0.7 : 1 }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
            >
              {submitting ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create account' : 'Sign in')}
            </button>

          </div>

          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: '#b7d4c5' }}>
            {isSignup ? 'Already have an account?' : 'New to Nyaaya AI?'}{' '}
            <a href="#" onClick={e => { e.preventDefault(); setMode(isSignup ? 'login' : 'signup'); setShowEmailError(false); setShowPasswordError(false); setBanner(null) }}
              style={{ color: '#5ac9a8', textDecoration: 'none', fontWeight: 500 }}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
