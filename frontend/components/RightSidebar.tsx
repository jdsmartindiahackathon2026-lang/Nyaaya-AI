'use client'
import { useState } from 'react'

const NINE_REALMS = [
  { label: 'Patents',              count: '2,140' },
  { label: 'Geographical Indications', count: '410' },
  { label: 'Trademarks',          count: '860'   },
  { label: 'Designs',             count: '190'   },
  { label: 'Copyright',           count: '150'   },
  { label: 'Trade Secrets',       count: '80'    },
  { label: 'Plant-variety Rights',count: '120'   },
  { label: 'Access & Benefit-Sharing', count: '260' },
  { label: 'Drug-regulatory',     count: '540'   },
]

interface Props {
  userType: string
  jurisdiction: string
  classification?: string
}

export default function RightSidebar({ userType, jurisdiction, classification }: Props) {
  const [open, setOpen] = useState(true)
  const [activeRegime, setActiveRegime] = useState<string | null>(null)

  return (
    <aside style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      padding: '22px 18px',
      borderLeft: '1px solid var(--border)',
      background: 'linear-gradient(180deg, rgba(11,21,17,0.55), rgba(7,13,11,0.75))',
      overflowY: 'auto',
      overflowX: 'hidden',
      minHeight: 0,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? 'Collapse' : 'Expand'}
        style={{
          position: 'absolute', top: 18, left: -12,
          width: 24, height: 24, borderRadius: '50%',
          border: '1px solid var(--border-hi)',
          background: 'var(--bg-input)',
          color: 'var(--accent)',
          cursor: 'pointer', fontSize: 12, lineHeight: 1, zIndex: 2,
        }}
      >
        {open ? '›' : '‹'}
      </button>

      {open && (
        <>
          {/* Nine Realms */}
          <div className="unfurl-r" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="label-xs">Nine Realms</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NINE_REALMS.map(r => (
                <button
                  key={r.label}
                  onClick={() => setActiveRegime(a => a === r.label ? null : r.label)}
                  className={`regime-btn${activeRegime === r.label ? ' active' : ''}`}
                >
                  <span style={{ fontSize: 12.5 }}>{r.label}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mono-val)', flexShrink: 0 }}>{r.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Session state */}
          <div className="unfurl-r" style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            padding: 14, border: '1px solid var(--border)', borderRadius: 9,
            background: 'var(--bg-card)', animationDelay: '80ms',
          }}>
            <div className="label-xs">Session</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Jurisdiction', value: jurisdiction === 'india' ? 'India' : jurisdiction === 'international' ? 'International' : 'India + International' },
                { label: 'User type', value: userType.charAt(0).toUpperCase() + userType.slice(1) },
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
            padding: 14, border: '1px solid var(--border)', borderRadius: 9,
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
        </>
      )}
    </aside>
  )
}
