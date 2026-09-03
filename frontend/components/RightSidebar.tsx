'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const NINE_REALMS = [
  { label: 'Patents',                   count: '2,140' },
  { label: 'Geographical Indications',  count: '410'   },
  { label: 'Trademarks',                count: '860'   },
  { label: 'Designs',                   count: '190'   },
  { label: 'Copyright',                 count: '150'   },
  { label: 'Trade Secrets',             count: '80'    },
  { label: 'Plant-variety Rights',      count: '120'   },
  { label: 'Access & Benefit-Sharing',  count: '260'   },
  { label: 'Drug-regulatory',           count: '540'   },
]

interface Props {
  userType: string
  jurisdiction: string
  classification?: string
}

export default function RightSidebar({ userType, jurisdiction, classification }: Props) {
  const [activeRegime, setActiveRegime] = useState<string | null>(null)
  const router = useRouter()

  async function signOut() {
    try {
      await supabase.auth.signOut()
      try {
        localStorage.removeItem('nyaaya_onboarded')
        localStorage.removeItem('nyaaya_userType')
        localStorage.removeItem('nyaaya_language')
        localStorage.removeItem('nyaaya_jurisdiction')
      } catch {}
    } finally {
      router.replace('/login')
    }
  }

  const jurLabel = jurisdiction === 'india' ? 'India'
    : jurisdiction === 'international' ? 'International'
    : 'India + International'

  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 22,
      padding: '22px 16px',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Nine Realms */}
      <div className="unfurl-r" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="label-xs">Nine Realms — regime map</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NINE_REALMS.map(r => (
            <button
              key={r.label}
              onClick={() => setActiveRegime(a => a === r.label ? null : r.label)}
              className={`regime-btn${activeRegime === r.label ? ' active' : ''}`}
            >
              <span style={{ fontSize: 12 }}>{r.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mono-val)', flexShrink: 0 }}>{r.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Session */}
      <div className="unfurl-r" style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 12, border: '1px solid var(--border)', borderRadius: 9,
        background: 'var(--bg-card)', animationDelay: '80ms',
      }}>
        <div className="label-xs">Session</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { label: 'Jurisdiction', value: jurLabel },
            { label: 'User type',    value: userType.charAt(0).toUpperCase() + userType.slice(1) },
            ...(classification ? [{ label: 'Classification', value: classification }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)' }}>{row.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mono-val)', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guardrails */}
      <div className="unfurl-r" style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: 12, border: '1px solid var(--border)', borderRadius: 9,
        background: 'var(--bg-card)', animationDelay: '160ms',
      }}>
        <div className="label-xs">Guardrails</div>
        {[
          'Official sources only',
          'Jurisdiction separation',
          'No guessing — abstain instead',
          'Confidence rated per answer',
        ].map(g => (
          <div key={g} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-lo)' }}>
            <span style={{ color: 'var(--accent-dim)', flexShrink: 0, marginTop: 1 }}>✓</span>
            <span>{g}</span>
          </div>
        ))}
      </div>

      {/* Account */}
      <div className="unfurl-r" style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: 12, border: '1px solid var(--border)', borderRadius: 9,
        background: 'var(--bg-card)', animationDelay: '240ms',
      }}>
        <div className="label-xs">Account</div>
        <button
          onClick={signOut}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
            transition: 'background 150ms, color 150ms, border-color 150ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(226,131,106,0.08)'
            e.currentTarget.style.color = '#e2836a'
            e.currentTarget.style.borderColor = 'rgba(226,131,106,0.35)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-dim)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
