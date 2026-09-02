'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const USER_TYPES = [
  { value: 'startup', label: 'Startup', desc: 'Commercialising an Ayurvedic product' },
  { value: 'researcher', label: 'Researcher', desc: 'Academic or R&D institution' },
  { value: 'practitioner', label: 'Practitioner', desc: 'Vaidya or traditional healer' },
  { value: 'regulator', label: 'Regulator', desc: 'Government or compliance officer' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'bn', label: 'বাংলা' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [screen, setScreen] = useState(0)
  const [userType, setUserType] = useState('')
  const [language, setLanguage] = useState('en')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [loading, setLoading] = useState(false)

  async function finish() {
    setLoading(true)
    try {
      // Sign in anonymously to get a Supabase session
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError) throw authError

      const userId = authData?.user?.id
      if (userId) {
        // Write preferences to users table
        await supabase.from('users').upsert({
          id: userId,
          user_type: userType,
          preferred_language: language,
          jurisdiction,
        })
      }

      // Persist to localStorage as fallback
      try {
        localStorage.setItem('nyaaya_userType', userType)
        localStorage.setItem('nyaaya_language', language)
        localStorage.setItem('nyaaya_jurisdiction', jurisdiction)
      } catch {}

      router.push('/app/ask')
    } catch {
      // On auth failure still proceed — preferences in localStorage
      try {
        localStorage.setItem('nyaaya_userType', userType)
        localStorage.setItem('nyaaya_language', language)
        localStorage.setItem('nyaaya_jurisdiction', jurisdiction)
      } catch {}
      router.push('/app/ask')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse 900px 600px at 50% 0%, #10241c 0%, #0b1512 55%, #070d0b 100%)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Logo / Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--accent-dim)', textTransform: 'uppercase' }}>IP-SAKTI</div>
          <div className="serif" style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Ayurveda's IP<br />intelligence layer.
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-lo)', lineHeight: 1.6 }}>
            Tell us a little about yourself so we can tailor guidance to your situation.
          </div>
        </div>

        {/* Screen 0: user type */}
        {screen === 0 && (
          <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="label-xs">I am a…</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {USER_TYPES.map(u => (
                <button key={u.value} onClick={() => setUserType(u.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${userType === u.value ? 'var(--accent)' : 'var(--border-hi)'}`,
                    background: userType === u.value ? 'rgba(127,217,174,0.08)' : 'var(--bg-input)',
                    display: 'flex', flexDirection: 'column', gap: 3, transition: 'border-color 150ms',
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: userType === u.value ? 'var(--accent)' : 'var(--text-hi)' }}>{u.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{u.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setScreen(1)} disabled={!userType} className="send-btn" style={{ padding: '11px 24px', alignSelf: 'flex-start', marginTop: 4 }}>
              Continue →
            </button>
          </div>
        )}

        {/* Screen 1: language */}
        {screen === 1 && (
          <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="label-xs">Preferred language</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {LANGUAGES.map(l => (
                <button key={l.value} onClick={() => setLanguage(l.value)}
                  style={{
                    flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${language === l.value ? 'var(--accent)' : 'var(--border-hi)'}`,
                    background: language === l.value ? 'rgba(127,217,174,0.08)' : 'var(--bg-input)',
                    fontSize: 15, fontWeight: 600,
                    color: language === l.value ? 'var(--accent)' : 'var(--text-hi)',
                    transition: 'border-color 150ms',
                  }}>{l.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Answers will be translated to your selected language. Legal citations remain in English.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setScreen(0)} style={{
                padding: '11px 18px', borderRadius: 8, border: '1px solid var(--border-hi)',
                background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              }}>← Back</button>
              <button onClick={() => setScreen(2)} className="send-btn" style={{ padding: '11px 24px' }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Screen 2: jurisdiction */}
        {screen === 2 && (
          <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="label-xs">Primary jurisdiction</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { value: 'india', label: 'India only', desc: 'Domestic IP filings and AYUSH compliance' },
                { value: 'both', label: 'India + International', desc: 'PCT, Madrid Protocol, Nagoya Protocol filings' },
                { value: 'international', label: 'International only', desc: 'Foreign market access and treaty obligations' },
              ].map(j => (
                <button key={j.value} onClick={() => setJurisdiction(j.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${jurisdiction === j.value ? 'var(--accent)' : 'var(--border-hi)'}`,
                    background: jurisdiction === j.value ? 'rgba(127,217,174,0.08)' : 'var(--bg-input)',
                    display: 'flex', flexDirection: 'column', gap: 3, transition: 'border-color 150ms',
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: jurisdiction === j.value ? 'var(--accent)' : 'var(--text-hi)' }}>{j.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{j.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setScreen(1)} style={{
                padding: '11px 18px', borderRadius: 8, border: '1px solid var(--border-hi)',
                background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              }}>← Back</button>
              <button onClick={finish} disabled={loading} className="send-btn" style={{ padding: '11px 24px' }}>
                {loading ? 'Setting up…' : 'Enter Nyaaya AI →'}
              </button>
            </div>
          </div>
        )}

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === screen ? 20 : 6, height: 6, borderRadius: 3,
              background: i === screen ? 'var(--accent)' : 'var(--border-hi)',
              transition: 'width 250ms, background 250ms',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
