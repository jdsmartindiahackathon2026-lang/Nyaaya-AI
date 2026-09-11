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

import { useState } from 'react'
import { useWorkspace } from '../lib/workspaceContext'

export default function LeftSidebar({ language, onLanguageChange }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { activeOrg, userOrgs, switchWorkspace, createWorkspace } = useWorkspace()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newOrgName.trim() || creating) return
    setCreating(true)
    try {
      await createWorkspace(newOrgName.trim())
      setNewOrgName('')
      setShowCreateModal(false)
      setDropdownOpen(false)
    } catch {
      // Handled in context
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '20px 16px',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Branding — links to homepage */}
      <div
        className="unfurl-l"
        onClick={() => router.push('/')}
        title="Return to homepage"
        style={{ display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer' }}
      >
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

      {/* Workspace Switcher */}
      <div style={{ position: 'relative', width: '100%' }}>
        <button
          type="button"
          onClick={() => setDropdownOpen(o => !o)}
          title="Switch active organization or team workspace"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-hi)',
            background: 'rgba(28,74,55,0.4)',
            color: 'var(--text-hi)',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'border-color 150ms, background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(28,74,55,0.65)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(28,74,55,0.4)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: activeOrg?.billing_tier === 'pro' || activeOrg?.billing_tier === 'enterprise' ? '#7fd9ae' : '#5ac9a8',
              boxShadow: '0 0 6px rgba(90,201,168,0.5)',
              flexShrink: 0,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeOrg?.name || 'Loading workspace…'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-lo)', flexShrink: 0 }}>▼</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: '#0a1613',
            border: '1px solid var(--border-hi)',
            borderRadius: 9,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
          }}>
            <div className="label-xs" style={{ padding: '6px 8px 4px', color: 'var(--text-dim)' }}>
              Workspaces
            </div>
            {userOrgs.map(org => {
              const isCurrent = org.id === activeOrg?.id
              return (
                <button
                  key={org.id}
                  onClick={() => { switchWorkspace(org.id); setDropdownOpen(false) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: isCurrent ? 'rgba(90,201,168,0.18)' : 'transparent',
                    color: isCurrent ? 'var(--accent)' : 'var(--text)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {org.name}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    {org.role}
                  </span>
                </button>
              )
            })}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px dashed var(--border-hi)',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,201,168,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span>+</span> Create new workspace
            </button>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(6,12,10,0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 420,
            background: '#091814',
            border: '1px solid var(--border-hi)',
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-hi)' }}>
                Create team workspace
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-lo)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-lo)', lineHeight: 1.5 }}>
              Create a dedicated workspace for your Ayurvedic clinic, startup, or IP legal firm. All regulatory clearances, searches, and formulations will be securely scoped to this team.
            </p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="label-xs">Workspace Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kottakkal Arya Vaidya Sala R&D"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-hi)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-hi)',
                    fontSize: 13.5,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-lo)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newOrgName.trim()}
                  className="send-btn"
                  style={{ padding: '9px 20px', fontSize: 13 }}
                >
                  {creating ? 'Creating…' : 'Create workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
