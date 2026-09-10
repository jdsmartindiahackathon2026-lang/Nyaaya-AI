'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

// Real chunk counts from the 7,438-clause statute_chunks corpus (Session 9).
// Trade Secrets has no dedicated Indian act — protected under common law +
// contract; kept in the map at 0 so the realm stays visible.
const NINE_REALMS = [
  { label: 'Patents',                   count: '764'   },
  { label: 'Geographical Indications',  count: '359'   },
  { label: 'Trademarks',                count: '713'   },
  { label: 'Designs',                   count: '212'   },
  { label: 'Copyright',                 count: '559'   },
  { label: 'Trade Secrets',             count: '—'     },
  { label: 'Plant-variety Rights',      count: '461'   },
  { label: 'Access & Benefit-Sharing',  count: '368'   },
  { label: 'Drug-regulatory',           count: '1,504' },
]

const REALM_QUERIES: Record<string, string> = {
  'Patents': 'What are the patentability criteria and Section 3(p) exclusions for herbal formulations under the Patents Act 1970?',
  'Geographical Indications': 'How does Geographical Indications registration apply to traditional regional Ayurvedic products under the GI Act 1999?',
  'Trademarks': 'What are trademark registration rules for Ayurvedic brands and classical formulation names under Trade Marks Act 1999?',
  'Designs': 'Can packaging, novel bottle shapes, or dispensers for Ayurvedic formulations receive Design protection under Designs Act 2000?',
  'Copyright': 'What copyright protection exists for Ayurvedic instructional texts, classical commentary, and branding materials under Copyright Act 1957?',
  'Trade Secrets': 'How are proprietary Ayurvedic extraction methods and confidential processes protected under Indian contract and common law?',
  'Plant-variety Rights': 'How does the PPV&FR Act 2001 protect breeders and farmers cultivating medicinal plant varieties?',
  'Access & Benefit-Sharing': 'What National Biodiversity Authority (NBA) approvals and ABS benefit-sharing fees apply to bio-resource sourcing?',
  'Drug-regulatory': 'What regulatory compliance and licensing is required under the Drugs and Cosmetics Act 1940 and Phytopharmaceutical Rules 2015?',
}

interface Props {
  userType: string
  jurisdiction: string
  classification?: string
}

export default function RightSidebar({ userType, jurisdiction, classification }: Props) {
  const [activeRegime, setActiveRegime] = useState<string | null>(null)
  const router = useRouter()

  function handleRealmClick(label: string) {
    const next = activeRegime === label ? null : label
    setActiveRegime(next)
    if (next && REALM_QUERIES[next]) {
      router.push(`/app/ask?q=${encodeURIComponent(REALM_QUERIES[next])}`)
    }
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="label-xs">Nine Realms — regime map</div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>click to ask</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NINE_REALMS.map(r => (
            <button
              key={r.label}
              onClick={() => handleRealmClick(r.label)}
              title={`Ask a query about ${r.label}`}
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
        <Link
          href="/app/profile"
          style={{
            display: 'block', width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left', textDecoration: 'none',
            transition: 'background 150ms, color 150ms, border-color 150ms',
          }}
        >
          Profile &amp; settings
        </Link>
      </div>
    </aside>
  )
}
