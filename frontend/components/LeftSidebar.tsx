'use client'
import { useState } from 'react'
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
  { label: 'हिंदी', code: 'hi' },
  { label: 'বাংলা', code: 'bn' },
]

const CORPUS_STATS = [
  { label: 'Statutes & rules', value: '412' },
  { label: 'Treaties', value: '9' },
  { label: 'TKDL records', value: '38,000+' },
]

interface Props {
  language: string
  onLanguageChange: (lang: string) => void
}

export default function LeftSidebar({ language, onLanguageChange }: Props) {
  const [open, setOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  return (
    <aside style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      padding: '22px 18px',
      borderRight: '1px solid var(--border)',
      background: 'linear-gradient(180deg, rgba(11,21,17,0.55), rgba(7,13,11,0.75))',
      overflowY: 'auto',
      overflowX: 'hidden',
      minHeight: 0,
      transition: 'width 300ms ease',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? 'Collapse' : 'Expand'}
        style={{
          position: 'absolute', top: 18, right: -12,
          width: 24, height: 24, borderRadius: '50%',
          border: '1px solid var(--border-hi)',
          background: 'var(--bg-input)',
          color: 'var(--accent)',
          cursor: 'pointer', fontSize: 12, lineHeight: 1, zIndex: 2,
        }}
      >
        {open ? '‹' : '›'}
      </button>

      {open ? (
        <>
          {/* Branding */}
          <div className="unfurl-l" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IPSaktiLogo size={20} />
              <div className="serif" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-hi)' }}>
                IP-SAKTI Sahayak
              </div>
            </div>
            <div className="label-xs" style={{ paddingLeft: 28 }}>
              Ayurveda IPR &amp; regulatory guidance
            </div>
          </div>

          {/* Nav */}
          <nav className="unfurl-l" style={{ display: 'flex', flexDirection: 'column', gap: 3, animationDelay: '60ms' }}>
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
            padding: 14, border: '1px solid var(--border)', borderRadius: 9,
            background: 'var(--bg-card)', animationDelay: '120ms',
          }}>
            <div className="label-xs">Corpus roots</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-lo)' }}>
              v2026.08 — synced Aug 2026
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {CORPUS_STATS.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-lo)' }}>
                  <span>{row.label}</span>
                  <span className="mono" style={{ color: 'var(--mono-val)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Language */}
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
        </>
      ) : (
        <div className="leaf-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 4 }}>
          <IPSaktiLogo size={20} />
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={item.label}
                style={{
                  width: 30, height: 30, border: 0, borderRadius: '50%',
                  cursor: 'pointer',
                  background: active ? '#1c4a37' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? 'var(--accent)' : 'var(--accent-dim)',
                  boxShadow: active ? '0 0 6px 2px rgba(127,217,174,.4)' : 'none',
                }} />
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
