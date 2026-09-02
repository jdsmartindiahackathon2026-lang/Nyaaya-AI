'use client'
import { useRouter, usePathname } from 'next/navigation'
import IPSaktiLogo from './IPSaktiLogo'

const NAV = [
  { label: 'Ask', href: '/app/ask' },
  { label: 'Classify Formulation', href: '/app/classify' },
  { label: 'ABS Helper', href: '/app/abs' },
  { label: 'TKDL Prior Art', href: '/app/tkdl' },
  { label: 'Escalate to Human', href: '/app/escalate' },
]

const LANGUAGES = [
  { label: 'English', code: 'en' },
  { label: 'हिंदी',   code: 'hi' },
  { label: 'தமிழ்',  code: 'ta' },
  { label: 'বাংলা',  code: 'bn' },
]

const CORPUS_STATS = [
  { label: 'Statutes & rules', value: '412' },
  { label: 'Treaties',         value: '9' },
  { label: 'TKDL records',     value: '38,000+' },
]

interface Props {
  language: string
  onLanguageChange: (lang: string) => void
}

export default function LeftSidebar({ language, onLanguageChange }: Props) {
  const router = useRouter()
  const pathname = usePathname()

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
      {/* Branding */}
      <div className="unfurl-l" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IPSaktiLogo size={20} />
          <span className="serif" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-hi)', lineHeight: 1.2 }}>
            IP-SAKTI<br />Sahayak
          </span>
        </div>
        <div className="label-xs" style={{ paddingLeft: 28 }}>
          Ayurveda IPR &amp; regulatory guidance
        </div>
      </div>

      {/* Nav */}
      <nav className="unfurl-l" style={{ display: 'flex', flexDirection: 'column', gap: 2, animationDelay: '60ms' }}>
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`nav-btn${active ? ' active' : ''}`}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: active ? 'var(--accent)' : 'var(--accent-dim)',
                boxShadow: active ? '0 0 6px 2px rgba(127,217,174,.4)' : 'none',
                justifySelf: 'center',
              }} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Corpus roots */}
      <div className="unfurl-l" style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 12, border: '1px solid var(--border)', borderRadius: 9,
        background: 'var(--bg-card)', animationDelay: '120ms',
      }}>
        <div className="label-xs">Corpus roots</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-lo)' }}>
          v2026.08 — synced Aug 2026
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {CORPUS_STATS.map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-lo)' }}>
              <span>{row.label}</span>
              <span className="mono" style={{ color: 'var(--mono-val)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Language — pushed to bottom */}
      <div className="unfurl-l" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, animationDelay: '180ms' }}>
        <div className="label-xs">Language (sap)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {LANGUAGES.map(lg => (
            <button
              key={lg.code}
              onClick={() => onLanguageChange(lg.code)}
              style={{
                padding: '5px 9px', borderRadius: 999,
                border: '1px solid var(--border-hi)',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 11.5,
                background: language === lg.code ? '#1c4a37' : 'transparent',
                color: language === lg.code ? 'var(--accent)' : 'var(--text-lo)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {lg.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-xs)' }}>
          Carried through Google Translate.
        </div>
      </div>
    </aside>
  )
}
