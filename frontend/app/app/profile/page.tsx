'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  auth_id: string
  user_type: string
  language: string
  jurisdiction: string
  full_name: string | null
  avatar_url: string | null
  organisation: string | null
  role_in_org: string | null
  state: string | null
  city: string | null
  languages_spoken: string[] | null
  preferences: Preferences | null
  last_active: string | null
  created_at?: string
  context_answers?: Record<string, unknown>
}

interface Preferences {
  answer_style?: 'concise' | 'detailed' | 'statute_first'
  citation_depth?: 3 | 10
  show_confidence?: boolean
  show_tkdl_warnings?: boolean
  auto_translate?: boolean
  reduced_motion?: boolean
  font_size?: 'small' | 'medium' | 'large'
  allow_anon_queries?: boolean
  notifications?: {
    escalation?: boolean
    digest?: boolean
    new_statute?: boolean
    rate_limit?: boolean
    marketing?: boolean
    override_email?: string
  }
}

interface ActivityEvent {
  event_type: string
  label: string
  created_at: string
}

interface EscalationRow {
  id: string
  query_summary: string
  status: string
  urgency: string
  created_at: string
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  ['identity',      'Identity & account',      'Who you are, how we reach you.'],
  ['preferences',   'Preferences',             'How answers look and behave by default.'],
  ['practice',      'Practice context',        'Your onboarding answers — editable anytime.'],
  ['usage',         'Usage & history',         'Everything you have asked and saved.'],
  ['escalations',   'Escalations',             'Human hand-offs and their status.'],
  ['notifications', 'Notifications',           'What we email you about.'],
  ['ratelimits',    'Rate limits & quota',     'Your usage against today\'s limits.'],
  ['security',      'Security & auth',         'Password, sign-in methods, sessions.'],
  ['privacy',       'Privacy & data',          'Export, anonymise, or delete your data.'],
  ['legal',         'Legal & compliance',      'Terms, policies and acknowledgements.'],
  ['team',          'Team / workspace',        'Shared access for firms and clinics.'],
  ['api',           'API & integrations',      'Programmatic access to IP-SAKTI.'],
  ['referral',      'Referral & community',    'Invite peers, be discovered.'],
] as const

type TabId = typeof TABS[number][0]

const SOON_TABS = new Set<string>(['team', 'api', 'referral'])

// ─── Particle data (stable across renders) ───────────────────────────────────

function genLeaves() {
  return Array.from({ length: 10 }, () => ({
    size: 14 + Math.round(Math.random() * 10),
    left: Math.round(Math.random() * 100) + '%',
    opacity: (0.15 + Math.random() * 0.25).toFixed(2),
    duration: (16 + Math.random() * 10).toFixed(1) + 's',
    delay: (-Math.random() * 20).toFixed(1) + 's',
    dx: Math.round((Math.random() - 0.5) * 200) + 'px',
    rot: Math.round(180 + Math.random() * 360) + 'deg',
  }))
}

function genFireflies() {
  return Array.from({ length: 8 }, () => ({
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

const LEAVES = genLeaves()
const FIREFLIES = genFireflies()

// ─── Row sub-components ────────────────────────────────────────────────────────

const ROW_BORDER = '1px solid rgba(90,201,168,0.12)'

function RowDivider({ children }: { children: React.ReactNode }) {
  return <div style={{ borderBottom: ROW_BORDER }}>{children}</div>
}

function ToggleRow({ label, desc, checked, onChange, disabled }: {
  label: string; desc?: string; checked: boolean; onChange: () => void; disabled?: boolean
}) {
  return (
    <RowDivider>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', opacity: disabled ? 0.4 : 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '72%' }}>
          <div style={{ fontSize: 14, color: '#e7ede9' }}>{label}</div>
          {desc && <div style={{ fontSize: 12, color: '#7fb0a0' }}>{desc}{disabled ? ' — coming soon' : ''}</div>}
        </div>
        <button
          type="button"
          onClick={disabled ? undefined : onChange}
          style={{
            width: 42, height: 23, borderRadius: 999, flexShrink: 0,
            border: `1px solid ${checked ? '#1f5f4b' : '#2c5040'}`,
            background: checked ? '#1f5f4b' : 'transparent',
            position: 'relative',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span style={{
            position: 'absolute', top: 1.5, left: checked ? 21 : 2,
            width: 17, height: 17, borderRadius: '50%',
            background: checked ? '#eafaf0' : '#7fb0a0',
            transition: 'left 160ms',
          }} />
        </button>
      </div>
    </RowDivider>
  )
}

function SelectRow({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <RowDivider>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0' }}>
        <div style={{ fontSize: 14, color: '#e7ede9' }}>{label}</div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(90,201,168,0.25)',
            background: 'rgba(6,14,12,0.8)', color: '#e7ede9',
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
            minWidth: 160, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </RowDivider>
  )
}

function TextRow({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <RowDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fb0a0' }}>{label}</label>
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}
        />
      </div>
    </RowDivider>
  )
}

function TextareaRow({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <RowDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fb0a0' }}>{label}</label>
        <textarea
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, resize: 'vertical' }}
        />
      </div>
    </RowDivider>
  )
}

function ReadonlyRow({ label, value, badge, buttonLabel, onButton, buttonDisabled }: {
  label: string; value: string; badge?: string; buttonLabel?: string; onButton?: () => void; buttonDisabled?: boolean
}) {
  return (
    <RowDivider>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0' }}>
        <div style={{ fontSize: 14, color: '#e7ede9' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: '#b7d4c5' }}>{value}</span>
          {badge && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.04em', color: '#7fb0a0', padding: '3px 8px', borderRadius: 999, background: 'rgba(90,201,168,0.1)', border: '1px solid rgba(90,201,168,0.2)' }}>{badge}</span>}
          {buttonLabel && <HoverButton onClick={buttonDisabled ? undefined : onButton} disabled={buttonDisabled}>{buttonLabel}</HoverButton>}
        </div>
      </div>
    </RowDivider>
  )
}

function ButtonRow({ label, desc, buttonLabel, onClick, variant = 'default', disabled }: {
  label: string; desc?: string; buttonLabel: string; onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger'; disabled?: boolean
}) {
  const styles = {
    default: { bg: 'transparent', color: '#b7d4c5', border: '#2c5040' },
    primary: { bg: '#1f5f4b', color: '#eafaf0', border: '#1f5f4b' },
    danger: { bg: 'rgba(226,54,54,0.12)', color: '#f2a3a3', border: 'rgba(226,54,54,0.5)' },
  }
  const st = disabled ? { bg: 'transparent', color: '#5c6f66', border: '#274238' } : styles[variant]
  return (
    <RowDivider>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '12px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '60%' }}>
          <div style={{ fontSize: 14, color: '#e7ede9' }}>{label}</div>
          {desc && <div style={{ fontSize: 12, color: '#7fb0a0' }}>{desc}{disabled ? ' — coming soon' : ''}</div>}
        </div>
        <button
          type="button" onClick={disabled ? undefined : onClick}
          style={{ padding: '9px 16px', borderRadius: 999, border: `1px solid ${st.border}`, background: st.bg, color: st.color, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {buttonLabel}
        </button>
      </div>
    </RowDivider>
  )
}

function ChipsRow({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
}) {
  return (
    <RowDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
        <div style={{ fontSize: 14, color: '#e7ede9' }}>{label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {options.map(o => {
            const sel = selected.includes(o)
            return (
              <button key={o} type="button" onClick={() => onToggle(o)}
                style={{ padding: '6px 13px', borderRadius: 999, border: `1px solid ${sel ? '#3a6c53' : '#2c5040'}`, background: sel ? 'rgba(90,201,168,0.18)' : 'transparent', color: sel ? '#7fd9ae' : '#b7d4c5', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, cursor: 'pointer' }}
              >{o}</button>
            )
          })}
        </div>
      </div>
    </RowDivider>
  )
}

function NoteRow({ text, tone = 'default' }: { text: string; tone?: 'default' | 'soon' }) {
  const c = tone === 'soon'
    ? { bg: 'rgba(201,170,90,0.08)', border: 'rgba(201,170,90,0.25)', color: '#c9aa5a' }
    : { bg: 'rgba(90,201,168,0.08)', border: 'rgba(90,201,168,0.2)', color: '#9db9a9' }
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, fontSize: 12.5, lineHeight: 1.55, color: c.color }}>{text}</div>
  )
}

function ProgressRow({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100))
  return (
    <RowDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, color: '#e7ede9' }}>{label}</div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#b7d4c5' }}>{used} / {total}</span>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(90,201,168,0.12)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: '#5ac9a8', borderRadius: 999 }} />
        </div>
      </div>
    </RowDivider>
  )
}

interface ListItem {
  title: string; sub: string;
  badge?: string; badgeColor?: string; badgeBg?: string; badgeBorder?: string;
  buttonLabel?: string; onButton?: () => void
}

function ListRow({ label, items }: { label: string; items: ListItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0' }}>
      <div style={{ fontSize: 14, color: '#e7ede9', marginBottom: 6 }}>{label}</div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(90,201,168,0.1)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 13, color: '#cfe4d8' }}>{it.title}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6f9683' }}>{it.sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {it.badge && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: it.badgeBg ?? 'rgba(90,201,168,0.12)', color: it.badgeColor ?? '#7fd9ae', border: `1px solid ${it.badgeBorder ?? 'rgba(90,201,168,0.25)'}` }}>{it.badge}</span>}
            {it.buttonLabel && <HoverButton onClick={it.onButton}>{it.buttonLabel}</HoverButton>}
          </div>
        </div>
      ))}
    </div>
  )
}

function CountersGrid({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, padding: '6px 0 16px' }}>
      {items.map((c, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 10px', borderRadius: 10, border: '1px solid rgba(90,201,168,0.18)', background: 'rgba(6,14,12,0.5)' }}>
          <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#7fd9ae' }}>{c.value}</div>
          <div style={{ fontSize: 11, color: '#8aab98', lineHeight: 1.3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function HoverButton({ children, onClick, style, disabled }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; disabled?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button" onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${hov && !disabled ? '#3a6c53' : '#2c5040'}`, background: hov && !disabled ? '#163727' : 'transparent', color: disabled ? '#5c6f66' : '#b7d4c5', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
    >{children}</button>
  )
}

// ─── Avatar row (identity tab) ─────────────────────────────────────────────────

function AvatarRow({ initial, avatarUrl, onUpload }: { initial: string; avatarUrl?: string | null; onUpload: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) { console.error('Avatar upload error:', error); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      onUpload(data.publicUrl)
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <RowDivider>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0 14px' }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(90,201,168,0.4)' }} />
          : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(150deg, #1b4a34, #0e2419)', border: '2px solid rgba(90,201,168,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Source Serif 4', serif", fontSize: 22, fontWeight: 700, color: '#7fd9ae' }}>{initial}</div>
        }
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: '#cfe4d8' }}>Profile photo</div>
          <HoverButton onClick={() => inputRef.current?.click()}>{uploading ? 'Uploading…' : 'Upload photo'}</HoverButton>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </div>
    </RowDivider>
  )
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerZone() {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')
  const [text, setText] = useState('')
  const [shaking, setShaking] = useState(false)

  const valid = text.trim().toUpperCase() === 'DELETE'

  async function handleDelete() {
    if (!valid) return
    try {
      await supabase.functions.invoke('delete-account')
      try {
        localStorage.removeItem('nyaaya_onboarded')
        localStorage.removeItem('nyaaya_userType')
        localStorage.removeItem('nyaaya_language')
        localStorage.removeItem('nyaaya_jurisdiction')
      } catch {}
      router.replace('/login')
    } catch (err) {
      console.error('Delete account error:', err)
    }
  }

  function startDelete() {
    setStep('confirm')
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, marginTop: 4, borderRadius: 14, border: '1px solid rgba(226,54,54,0.35)', background: 'rgba(28,10,10,0.4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: '#f2a3a3' }}>Danger zone</div>
        <div style={{ fontSize: 12, color: '#c98a8a' }}>This permanently deletes your account, onboarding answers and session history. This cannot be undone.</div>
      </div>
      {step === 'idle' && (
        <button type="button" onClick={startDelete}
          style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 999, border: '1px solid rgba(226,54,54,0.5)', background: 'rgba(226,54,54,0.12)', color: '#f2a3a3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >Delete account</button>
      )}
      {step === 'confirm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: shaking ? 'shake 400ms' : undefined }}>
          <div style={{ fontSize: 13, color: '#f2a3a3' }}>Are you sure? Type <b>DELETE</b> to confirm.</div>
          <input
            type="text" value={text} onChange={e => setText(e.target.value)} placeholder="DELETE"
            style={{ width: 200, padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(226,54,54,0.4)', background: 'rgba(20,6,6,0.8)', color: '#f2a3a3', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => { setStep('idle'); setText('') }}
              style={{ padding: '9px 18px', borderRadius: 999, border: '1px solid #2c5040', background: 'transparent', color: '#b7d4c5', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >Cancel</button>
            <button type="button" onClick={handleDelete} disabled={!valid}
              style={{ padding: '9px 18px', borderRadius: 999, border: 'none', background: valid ? '#d94545' : 'rgba(217,69,69,0.3)', color: '#fff', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.3 }}
            >Permanently delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Change email inline widget ───────────────────────────────────────────────

function ChangeEmailWidget() {
  const [open, setOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [msg, setMsg] = useState('')

  async function handleConfirm() {
    if (!newEmail.trim()) return
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) throw error
      setMsg('Check your inbox to confirm the change.')
      setOpen(false)
      setNewEmail('')
    } catch (e) {
      console.error('Change email error:', e)
      setMsg('Failed to update email. Try again.')
    }
  }

  return (
    <RowDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 14, color: '#e7ede9' }}>Email address</div>
            <div style={{ fontSize: 12, color: '#7fb0a0' }}>Change the email linked to your account</div>
          </div>
          <button type="button" onClick={() => { setOpen(o => !o); setMsg('') }}
            style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid #2c5040', background: 'transparent', color: '#b7d4c5', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >{open ? 'Cancel' : 'Change email'}</button>
        </div>
        {open && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email address"
              style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(6,14,12,0.8)', color: '#f2f6f3', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}
            />
            <button type="button" onClick={handleConfirm}
              style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid #1f5f4b', background: '#1f5f4b', color: '#eafaf0', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Confirm</button>
          </div>
        )}
        {msg && <div style={{ fontSize: 12, color: '#7fd9ae' }}>{msg}</div>}
      </div>
    </RowDivider>
  )
}

// ─── Tab content renderer ─────────────────────────────────────────────────────

interface TabContentProps {
  tab: TabId
  user: UserRow | null
  email: string
  activity: ActivityEvent[]
  usageCounts: { conversations: number; abs: number; tkdl: number; classify: number; escalations: number }
  rateLimits: { ask: number; classify: number; abs: number }
  openEscalations: EscalationRow[]
  resolvedEscalations: EscalationRow[]
  // form state
  fullName: string; setFullName: (v: string) => void
  org: string; setOrg: (v: string) => void
  roleInOrg: string; setRoleInOrg: (v: string) => void
  locationState: string; setLocationState: (v: string) => void
  locationCity: string; setLocationCity: (v: string) => void
  languagesSpoken: string[]; toggleLanguage: (v: string) => void
  avatarUrl: string | null; onAvatarUpload: (url: string) => void
  userType: string; setUserType: (v: string) => void
  // preferences
  interfaceLang: string; setInterfaceLang: (v: string) => void
  answerStyle: string; setAnswerStyle: (v: string) => void
  citationDepth: string; setCitationDepth: (v: string) => void
  fontSize: string; setFontSize: (v: string) => void
  showConfidence: boolean; setShowConfidence: (v: boolean) => void
  showTkdl: boolean; setShowTkdl: (v: boolean) => void
  autoTranslate: boolean; setAutoTranslate: (v: boolean) => void
  reducedMotion: boolean; setReducedMotion: (v: boolean) => void
  // practice
  formulationFocus: string; setFormulationFocus: (v: string) => void
  ipConcerns: string[]; toggleIpConcern: (v: string) => void
  exportMarkets: string[]; toggleExportMarket: (v: string) => void
  biologicalResources: boolean; setBioRes: (v: boolean) => void
  sourcesTK: boolean; setSourcesTK: (v: boolean) => void
  painPoints: string; setPainPoints: (v: string) => void
  // notifications
  emailEscalation: boolean; setEmailEscalation: (v: boolean) => void
  emailDigest: boolean; setEmailDigest: (v: boolean) => void
  emailNewStatute: boolean; setEmailNewStatute: (v: boolean) => void
  emailRateLimit: boolean; setEmailRateLimit: (v: boolean) => void
  notifEmail: string; setNotifEmail: (v: string) => void
  marketingOptin: boolean; setMarketingOptin: (v: boolean) => void
  // privacy
  allowAnonQueries: boolean; setAllowAnonQueries: (v: boolean) => void
  exportLabel: string; onExport: () => void
  router: ReturnType<typeof useRouter>
}

function TabContent(props: TabContentProps) {
  const { tab, user, email, activity, usageCounts, rateLimits, openEscalations, resolvedEscalations } = props

  function copyText(text: string) {
    try { navigator.clipboard.writeText(text) } catch {}
  }

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—'
  const lastActive = user?.last_active
    ? new Date(user.last_active).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Now'
  const initial = (props.fullName || user?.full_name || 'U').trim().charAt(0).toUpperCase()

  switch (tab) {
    case 'identity':
      return (
        <>
          <AvatarRow initial={initial} avatarUrl={props.avatarUrl} onUpload={props.onAvatarUpload} />
          <TextRow label="Full name" value={props.fullName} onChange={props.setFullName} placeholder="Your name" />
          <ReadonlyRow label="Email" value={email || '—'} badge="Verify to change" />
          <SelectRow label="User type" value={props.userType} onChange={props.setUserType} options={[
            { value: 'practitioner', label: 'Practitioner' },
            { value: 'formulator', label: 'Formulator' },
            { value: 'startup', label: 'Ayush startup' },
            { value: 'lawyer', label: 'IP lawyer' },
            { value: 'researcher', label: 'Researcher' },
            { value: 'regulator', label: 'Regulator' },
          ]} />
          <TextRow label="Organisation / clinic / firm" value={props.org} onChange={props.setOrg} placeholder="Optional" />
          <TextRow label="Role within organisation" value={props.roleInOrg} onChange={props.setRoleInOrg} placeholder="e.g. Founder, R&D lead, In-house counsel" />
          <TextRow label="State" value={props.locationState} onChange={props.setLocationState} placeholder="e.g. Karnataka" />
          <TextRow label="City" value={props.locationCity} onChange={props.setLocationCity} placeholder="e.g. Bengaluru" />
          <ChipsRow label="Languages spoken" options={['English', 'Hindi', 'Bengali', 'Tamil', 'Other']} selected={props.languagesSpoken} onToggle={props.toggleLanguage} />
          <ReadonlyRow label="Joined" value={createdAt} />
          <ReadonlyRow label="Last active" value={lastActive} />
          <ReadonlyRow label="Account ID" value={user?.auth_id ? 'usr_' + user.auth_id.slice(0, 6) : '—'} buttonLabel="Copy" onButton={() => copyText(user?.auth_id ?? '')} />
        </>
      )

    case 'preferences':
      return (
        <>
          <SelectRow label="Interface language" value={props.interfaceLang} onChange={props.setInterfaceLang} options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिंदी' },
            { value: 'bn', label: 'বাংলা' },
            { value: 'ta', label: 'தமிழ்' },
          ]} />
          <ReadonlyRow label="Jurisdiction" value="India" badge="International coming soon" />
          <SelectRow label="Default answer style" value={props.answerStyle} onChange={props.setAnswerStyle} options={[
            { value: 'concise', label: 'Concise' },
            { value: 'detailed', label: 'Detailed' },
            { value: 'statute_first', label: 'Statute-first' },
          ]} />
          <SelectRow label="Default AI model" value="Sonar" onChange={() => {}} options={[
            { value: 'Sonar', label: 'Sonar' },
            { value: 'Sonar-Pro', label: 'Sonar-Pro' },
          ]} disabled />
          <SelectRow label="Citation depth" value={props.citationDepth} onChange={props.setCitationDepth} options={[
            { value: '3', label: 'Top 3' },
            { value: '10', label: 'Top 10' },
          ]} />
          <ToggleRow label="Show confidence badges" desc="Display retrieval-confidence indicators on answers" checked={props.showConfidence} onChange={() => props.setShowConfidence(!props.showConfidence)} />
          <ToggleRow label="Show TKDL prior-art warnings inline" desc="Surface traditional-knowledge conflicts as you read" checked={props.showTkdl} onChange={() => props.setShowTkdl(!props.showTkdl)} />
          <ToggleRow label="Auto-translate answers" desc="Translate answers into your interface language" checked={props.autoTranslate} onChange={() => props.setAutoTranslate(!props.autoTranslate)} />
          <ToggleRow label="Reduced motion" desc="Overrides your device setting for this app" checked={props.reducedMotion} onChange={() => props.setReducedMotion(!props.reducedMotion)} />
          <SelectRow label="Theme" value="Dark" onChange={() => {}} options={[{ value: 'Dark', label: 'Dark' }]} disabled />
          <SelectRow label="Font size" value={props.fontSize} onChange={props.setFontSize} options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]} />
        </>
      )

    case 'practice':
      return (
        <>
          <SelectRow label="Formulation focus" value={props.formulationFocus} onChange={props.setFormulationFocus} options={[
            { value: 'Classical', label: 'Classical' },
            { value: 'Proprietary', label: 'Proprietary' },
            { value: 'Phytopharmaceutical', label: 'Phytopharmaceutical' },
            { value: 'Dietary supplement', label: 'Dietary supplement' },
            { value: 'Cosmetic', label: 'Cosmetic' },
          ]} />
          <ChipsRow label="Primary IP concerns" options={['Patents', 'Trademarks', 'Geographical indications', 'Trade secrets', 'Copyright']} selected={props.ipConcerns} onToggle={props.toggleIpConcern} />
          <ChipsRow label="Export markets" options={['None', 'US', 'EU', 'UAE', 'SEA']} selected={props.exportMarkets} onToggle={props.toggleExportMarket} />
          <ToggleRow label="Uses biological resources from India" desc="Raises ABS wizard priority when on" checked={props.biologicalResources} onChange={() => props.setBioRes(!props.biologicalResources)} />
          <ToggleRow label="Sources traditional knowledge" desc="Raises TKDL and §3(p) priority when on" checked={props.sourcesTK} onChange={() => props.setSourcesTK(!props.sourcesTK)} />
          <TextareaRow label="Regulatory pain points" value={props.painPoints} onChange={props.setPainPoints} placeholder="What slows you down today?" />
        </>
      )

    case 'usage':
      return (
        <>
          <CountersGrid items={[
            { label: 'Conversations', value: usageCounts.conversations },
            { label: 'ABS diagnoses', value: usageCounts.abs },
            { label: 'TKDL searches', value: usageCounts.tkdl === 0 ? '—' : usageCounts.tkdl },
            { label: 'Classify runs', value: usageCounts.classify === 0 ? '—' : usageCounts.classify },
            { label: 'Escalations', value: usageCounts.escalations },
          ]} />
          <ListRow label="Recent activity" items={activity.slice(0, 20).map(ev => ({ title: ev.label, sub: new Date(ev.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }))} />
          <ButtonRow label="Full conversation history" desc="Every question you have asked, in the Ask sidebar" buttonLabel="View in Ask" onClick={() => props.router.push('/app/ask')} />
          <NoteRow tone="soon" text="Bookmarking arrives with a future release." />
          <ListRow label="Saved answers & bookmarked citations" items={[]} />
          <NoteRow tone="soon" text="Downloaded memos will be listed here in a future release." />
          <ListRow label="Downloaded memos" items={[]} />
        </>
      )

    case 'escalations': {
      const openItems: ListItem[] = openEscalations.map(e => ({
        title: e.query_summary,
        sub: 'Filed ' + new Date(e.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
        badge: e.status === 'pending' ? 'Pending' : 'In review',
        badgeColor: '#c9aa5a', badgeBg: 'rgba(201,170,90,0.12)', badgeBorder: 'rgba(201,170,90,0.3)',
      }))
      const resolvedItems: ListItem[] = resolvedEscalations.map(e => ({
        title: e.query_summary,
        sub: 'Resolved ' + new Date(e.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
        badge: 'Resolved', badgeColor: '#7fd9ae',
      }))
      return (
        <>
          {openItems.length === 0 && <NoteRow text="No open tickets." />}
          <ListRow label="Open tickets" items={openItems} />
          {resolvedItems.length === 0 && <NoteRow text="No resolved tickets yet." />}
          <ListRow label="History" items={resolvedItems} />
          <NoteRow text="Facilitator ratings will appear here once facilitators are onboarded." tone="soon" />
        </>
      )
    }

    case 'notifications':
      return (
        <>
          <ToggleRow label="Email me when an escalation is responded to" checked={props.emailEscalation} onChange={() => props.setEmailEscalation(!props.emailEscalation)} />
          <ToggleRow label="Weekly digest" checked={props.emailDigest} onChange={() => props.setEmailDigest(!props.emailDigest)} />
          <ToggleRow label="New statute added to corpus" checked={props.emailNewStatute} onChange={() => props.setEmailNewStatute(!props.emailNewStatute)} />
          <ToggleRow label="Rate limit approaching" checked={props.emailRateLimit} onChange={() => props.setEmailRateLimit(!props.emailRateLimit)} />
          <TextRow label="Notification email" value={props.notifEmail} onChange={props.setNotifEmail} placeholder="Defaults to your account email" />
          <ToggleRow label="Marketing emails" desc="Off by default" checked={props.marketingOptin} onChange={() => props.setMarketingOptin(!props.marketingOptin)} />
        </>
      )

    case 'ratelimits':
      return (
        <>
          <NoteRow text="Usage counts shown are from the current rate-limit window (rolling per minute). Limits reset automatically." />
          <ProgressRow label="Ask" used={rateLimits.ask} total={20} />
          <ProgressRow label="Classify formulation" used={rateLimits.classify} total={20} />
          <ProgressRow label="ABS helper" used={rateLimits.abs} total={5} />
          <NoteRow text="Limits keep the corpus responsive for everyone. Need more headroom? Contact us to raise your quota." />
        </>
      )

    case 'security':
      return (
        <>
          <ButtonRow label="Sign out" desc="End your session on this device" buttonLabel="Sign out"
            variant="danger" onClick={async () => {
              await supabase.auth.signOut()
              try { ['nyaaya_onboarded', 'nyaaya_userType', 'nyaaya_language', 'nyaaya_jurisdiction'].forEach(k => localStorage.removeItem(k)) } catch {}
              props.router.replace('/login')
            }} />
          <ButtonRow label="Password" desc="Reset the password used to sign in" buttonLabel="Forgot password" onClick={async () => {
            if (!email) return
            await supabase.auth.resetPasswordForEmail(email)
          }} />
          <ChangeEmailWidget />
          <ButtonRow label="Google account" desc="Connected — sign-in via Google is active — disconnect requires re-auth" buttonLabel="Disconnect" disabled />
          <ToggleRow label="Two-factor authentication" desc="Ships once Supabase 2FA is on the plan" checked={false} onChange={() => {}} disabled />
          <NoteRow tone="soon" text="Session management ships once Supabase exposes device sessions." />
          <ListRow label="Active sessions" items={[]} />
          <NoteRow tone="soon" text="Security event log requires a security_events table — ships in a future release." />
          <ListRow label="Recent security events" items={[]} />
        </>
      )

    case 'privacy':
      return (
        <>
          <ButtonRow label="Export your data" desc="Download a JSON copy of your profile, answers and history" buttonLabel={props.exportLabel} onClick={props.onExport} variant="primary" />
          <ButtonRow label="Anonymise my data instead" desc="Keep your queries for corpus improvement, drop personal info" buttonLabel="Anonymise" disabled />
          <ToggleRow label="Allow anonymised queries to improve retrieval" checked={props.allowAnonQueries} onChange={() => props.setAllowAnonQueries(!props.allowAnonQueries)} />
          <ButtonRow label="What we store" desc="Plain-English inventory of the data we keep" buttonLabel="View" disabled />
          <DangerZone />
        </>
      )

    case 'legal':
      return (
        <>
          <ReadonlyRow label="Terms of service" value="Accepted Mar 12, 2026" buttonLabel="View" buttonDisabled />
          <ReadonlyRow label="Privacy policy" value="Accepted Mar 12, 2026" buttonLabel="View" buttonDisabled />
          <ButtonRow label="Disclaimer acknowledgement" desc={'"IP-SAKTI is decision-support, not legal advice." Re-accepted annually.'} buttonLabel="Re-accept" disabled />
          <NoteRow text="Facilitator engagement letter becomes available once escalation goes live." tone="soon" />
        </>
      )

    case 'team':
      return (
        <>
          <NoteRow text="Team workspaces are planned for after the hackathon." tone="soon" />
          <ButtonRow label="Invite colleagues" desc="Share conversation history within your firm — coming soon" buttonLabel="Invite" disabled />
          <ReadonlyRow label="Roles" value="Admin / Member / Read-only" />
          <ReadonlyRow label="Shared saved answers" value="Not enabled yet" />
          <ReadonlyRow label="Billing owner" value="—" />
        </>
      )

    case 'api':
      return (
        <>
          <NoteRow text="API access is aspirational — planned for a future release." tone="soon" />
          <ReadonlyRow label="Personal API key" value="Not generated" buttonLabel="Generate" onButton={() => {}} />
          <TextRow label="Webhook URL" value="" onChange={() => {}} placeholder="https://your-endpoint.com/hook" />
          <NoteRow text="Zapier / Make.com connector — much later." tone="soon" />
        </>
      )

    case 'referral':
      return (
        <>
          <ButtonRow label="Refer a colleague" desc="Share your link and get attribution" buttonLabel="Copy link" onClick={() => { try { navigator.clipboard.writeText('https://ipsakti.ai/r/user') } catch {} }} />
          <ToggleRow label="Public profile" desc="Let other practitioners discover you" checked={false} onChange={() => {}} />
          <NoteRow text="Facilitator directory listing appears here if you are registered as a facilitator." />
        </>
      )

    default:
      return null
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('identity')
  const [user, setUser] = useState<UserRow | null>(null)
  const [email, setEmail] = useState('')
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [usageCounts, setUsageCounts] = useState({ conversations: 0, abs: 0, tkdl: 0, classify: 0, escalations: 0 })
  const [rateLimits, setRateLimits] = useState({ ask: 0, classify: 0, abs: 0 })
  const [openEscalations, setOpenEscalations] = useState<EscalationRow[]>([])
  const [resolvedEscalations, setResolvedEscalations] = useState<EscalationRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Mouse parallax
  const [mx, setMx] = useState(0)
  const [my, setMy] = useState(0)
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setMx((e.clientX - r.left) / r.width - 0.5)
    setMy((e.clientY - r.top) / r.height - 0.5)
  }

  // Identity fields
  const [fullName, setFullName] = useState('')
  const [org, setOrg] = useState('')
  const [roleInOrg, setRoleInOrg] = useState('')
  const [locationState, setLocationState] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>(['English'])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userType, setUserType] = useState('startup')

  // Preferences
  const [interfaceLang, setInterfaceLang] = useState('en')
  const [answerStyle, setAnswerStyle] = useState('concise')
  const [citationDepth, setCitationDepth] = useState('3')
  const [fontSize, setFontSize] = useState('medium')
  const [showConfidence, setShowConfidence] = useState(true)
  const [showTkdl, setShowTkdl] = useState(true)
  const [autoTranslate, setAutoTranslate] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Practice
  const [formulationFocus, setFormulationFocus] = useState('Classical')
  const [ipConcerns, setIpConcerns] = useState<string[]>(['Patents'])
  const [exportMarkets, setExportMarkets] = useState<string[]>(['None'])
  const [biologicalResources, setBioRes] = useState(false)
  const [sourcesTK, setSourcesTK] = useState(false)
  const [painPoints, setPainPoints] = useState('')

  // Notifications
  const [emailEscalation, setEmailEscalation] = useState(true)
  const [emailDigest, setEmailDigest] = useState(true)
  const [emailNewStatute, setEmailNewStatute] = useState(false)
  const [emailRateLimit, setEmailRateLimit] = useState(true)
  const [notifEmail, setNotifEmail] = useState('')
  const [marketingOptin, setMarketingOptin] = useState(false)

  // Privacy
  const [allowAnonQueries, setAllowAnonQueries] = useState(true)
  const [exportLabel, setExportLabel] = useState('Export as JSON')

  // Load user data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || cancelled) return
        setEmail(authUser.email ?? '')

        const { data: row, error } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', authUser.id)
          .single()

        if (error) { console.error('Profile load error:', error); return }
        if (cancelled || !row) return

        setUser(row as UserRow)
        setFullName(row.full_name ?? '')
        setOrg(row.organisation ?? '')
        setRoleInOrg(row.role_in_org ?? '')
        setLocationState(row.state ?? '')
        setLocationCity(row.city ?? '')
        setLanguagesSpoken(row.languages_spoken ?? ['English'])
        setAvatarUrl(row.avatar_url ?? null)
        setInterfaceLang(row.language ?? 'en')
        setUserType(row.user_type ?? 'startup')
        setNotifEmail(authUser.email ?? '')

        const prefs = row.preferences as Preferences | null
        if (prefs) {
          setAnswerStyle(prefs.answer_style ?? 'concise')
          setCitationDepth(String(prefs.citation_depth ?? 3))
          setFontSize(prefs.font_size ?? 'medium')
          setShowConfidence(prefs.show_confidence ?? true)
          setShowTkdl(prefs.show_tkdl_warnings ?? true)
          setAutoTranslate(prefs.auto_translate ?? true)
          setReducedMotion(prefs.reduced_motion ?? false)
          setAllowAnonQueries(prefs.allow_anon_queries ?? true)
          if (prefs.notifications) {
            setEmailEscalation(prefs.notifications.escalation ?? true)
            setEmailDigest(prefs.notifications.digest ?? true)
            setEmailNewStatute(prefs.notifications.new_statute ?? false)
            setEmailRateLimit(prefs.notifications.rate_limit ?? true)
            setMarketingOptin(prefs.notifications.marketing ?? false)
            if (prefs.notifications.override_email) setNotifEmail(prefs.notifications.override_email)
          }
        }

        const ctx = row.context_answers as Record<string, unknown> | null
        if (ctx) {
          if (ctx.formulation_focus) setFormulationFocus(ctx.formulation_focus as string)
          if (ctx.ip_concerns && Array.isArray(ctx.ip_concerns)) setIpConcerns(ctx.ip_concerns as string[])
          if (ctx.export_markets && Array.isArray(ctx.export_markets)) setExportMarkets(ctx.export_markets as string[])
          if (ctx.pain_points) setPainPoints(ctx.pain_points as string)
          if (typeof ctx.uses_bio_resources === 'boolean') setBioRes(ctx.uses_bio_resources)
          if (typeof ctx.sources_tk === 'boolean') setSourcesTK(ctx.sources_tk)
        }

        // Load activity
        try {
          const { data: acts } = await supabase
            .from('activity_events_v')
            .select('event_type, label, created_at')
            .order('created_at', { ascending: false })
            .limit(20)
          if (!cancelled && acts) setActivity(acts as ActivityEvent[])
        } catch (e) { console.error('Activity load error:', e) }

        // Usage counts — parallel queries
        try {
          const userId = (row as UserRow).id
          const [convRes, absRes, escRes] = await Promise.all([
            supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('abs_diagnoses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('escalations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          ])
          if (!cancelled) {
            setUsageCounts({
              conversations: convRes.count ?? 0,
              abs: absRes.count ?? 0,
              tkdl: 0, // no dedicated table — keyed from rate_limits which is deny-all
              classify: 0,
              escalations: escRes.count ?? 0,
            })
          }
        } catch (e) { console.error('Usage count error:', e) }

        // Escalations list
        try {
          const userId = (row as UserRow).id
          const { data: escs } = await supabase
            .from('escalations')
            .select('id, query_summary, status, urgency, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
          if (!cancelled && escs) {
            const open = (escs as EscalationRow[]).filter(e => e.status === 'pending')
            const resolved = (escs as EscalationRow[]).filter(e => e.status === 'resolved')
            setOpenEscalations(open)
            setResolvedEscalations(resolved)
          }
        } catch (e) { console.error('Escalations load error:', e) }

        // Rate limits — deny-all RLS so fetch will return empty; show 0/N
        // We still attempt in case policy is relaxed in future
        try {
          const userId = (row as UserRow).id
          const { data: rl } = await supabase
            .from('rate_limits')
            .select('endpoint, count')
            .eq('user_id', userId)
          if (!cancelled && rl && rl.length > 0) {
            const sum = (endpoint: string) =>
              (rl as { endpoint: string; count: number }[])
                .filter(r => r.endpoint === endpoint)
                .reduce((acc, r) => acc + (r.count ?? 0), 0)
            setRateLimits({ ask: sum('ask-query'), classify: sum('classify-formulation'), abs: sum('escalate') })
          }
          // else leave as 0
        } catch (e) { /* deny-all RLS — expected */ }

      } catch (e) {
        console.error('Profile page error:', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Save
  async function handleSave() {
    if (!user) return
    setSaving(true)
    setSaveMsg('')
    try {
      const prefs: Preferences = {
        answer_style: answerStyle as Preferences['answer_style'],
        citation_depth: Number(citationDepth) as 3 | 10,
        font_size: fontSize as Preferences['font_size'],
        show_confidence: showConfidence,
        show_tkdl_warnings: showTkdl,
        auto_translate: autoTranslate,
        reduced_motion: reducedMotion,
        allow_anon_queries: allowAnonQueries,
        notifications: {
          escalation: emailEscalation,
          digest: emailDigest,
          new_statute: emailNewStatute,
          rate_limit: emailRateLimit,
          marketing: marketingOptin,
          override_email: notifEmail,
        },
      }
      const ctx = {
        ...(user.context_answers ?? {}),
        formulation_focus: formulationFocus,
        ip_concerns: ipConcerns,
        export_markets: exportMarkets,
        uses_bio_resources: biologicalResources,
        sources_tk: sourcesTK,
        pain_points: painPoints,
      }
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
          organisation: org,
          role_in_org: roleInOrg,
          state: locationState,
          city: locationCity,
          languages_spoken: languagesSpoken,
          language: interfaceLang,
          user_type: userType,
          preferences: prefs,
          context_answers: ctx,
          last_active: new Date().toISOString(),
        })
        .eq('auth_id', user.auth_id)
      if (error) throw error
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e) {
      console.error('Save error:', e)
      setSaveMsg('Error saving')
    } finally {
      setSaving(false)
    }
  }

  // Export
  async function handleExport() {
    setExportLabel('Preparing…')
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data')
      if (error) throw error
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nyaaya_export_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportLabel('Downloaded')
      setTimeout(() => setExportLabel('Export as JSON'), 2000)
    } catch (e) {
      console.error('Export error:', e)
      setExportLabel('Export as JSON')
    }
  }

  function toggleLanguage(v: string) {
    setLanguagesSpoken(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function toggleIpConcern(v: string) {
    setIpConcerns(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function toggleExportMarket(v: string) {
    setExportMarkets(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  const activeMeta = TABS.find(t => t[0] === activeTab)!
  const initial = (fullName || user?.full_name || 'U').trim().charAt(0).toUpperCase()
  const displayName = fullName || user?.full_name || 'Your profile'
  const loginMethod = email ? (email.includes('google') ? 'google' : 'email') : 'email'
  const loginMethodLabel = loginMethod === 'google' ? 'Google account' : 'Email & password'
  const createdAtLabel = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—'

  // Tabs where Save bar appears
  const SAVE_BAR_EXCLUDED = new Set(['legal', 'escalations', 'ratelimits', 'security', 'privacy', 'usage'])

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{ position: 'relative', minHeight: '100%', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: '#eaf3ee', overflow: 'hidden' }}
    >
      {/* Parallax background image */}
      <div style={{ position: 'absolute', inset: '-4%', zIndex: 0, opacity: 0.5, filter: 'saturate(1.25) contrast(1.05) brightness(1.15)', transform: `translate(${mx * 10}px, ${my * 10}px)`, transition: 'transform 400ms ease-out' }}>
        <img src="/yggdrasil-hero.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(7,13,11,0.05) 0%, rgba(7,13,11,0.4) 45%, rgba(7,13,11,0.85) 100%)' }} />

      {/* Drifting leaves */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, transform: `translate(${mx * -14}px, ${my * -14}px)`, transition: 'transform 400ms ease-out' }}>
        {LEAVES.map((leaf, i) => (
          <svg key={i} width={leaf.size} height={leaf.size} viewBox="0 0 24 24" style={{ position: 'absolute', left: leaf.left, top: -40, opacity: Number(leaf.opacity), animation: `leafDrift ${leaf.duration} linear ${leaf.delay} infinite`, ['--dx' as string]: leaf.dx, ['--rot' as string]: leaf.rot }}>
            <path d="M12 2C7 6 3 10 3 15a9 9 0 0 0 9 7 9 9 0 0 0 9-7c0-5-4-9-9-13z" fill="#4fd6b5" />
          </svg>
        ))}
      </div>

      {/* Fireflies */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, transform: `translate(${mx * -22}px, ${my * -22}px)`, transition: 'transform 400ms ease-out' }}>
        {FIREFLIES.map((fly, i) => (
          <div key={i} style={{ position: 'absolute', left: fly.left, top: fly.top, width: fly.size, height: fly.size, borderRadius: '50%', background: '#a6f5db', boxShadow: '0 0 8px 2px rgba(166,245,219,0.85)', animation: `fireflyDrift ${fly.duration} ease-in-out ${fly.delay} infinite, flicker ${fly.flickerDuration} ease-in-out ${fly.delay} infinite`, ['--fx' as string]: fly.fx, ['--fy' as string]: fly.fy, ['--fx2' as string]: fly.fx2, ['--fy2' as string]: fly.fy2 }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1180, margin: '0 auto', padding: '48px 24px 80px', display: 'flex', flexDirection: 'column', gap: 22, animation: 'riseIn 500ms cubic-bezier(0.22,1,0.36,1) both' }}>

        {/* Page heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', color: '#f2f6f3' }}>Profile &amp; settings</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: '#9db9a9' }}>Everything from onboarding, plus how IP-SAKTI works for you.</div>
        </div>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Identity card */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '22px 18px', borderRadius: 14, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(9,17,14,0.72)', backdropFilter: 'blur(10px)', boxShadow: '0 16px 44px rgba(0,0,0,0.35)' }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(90,201,168,0.4)' }} />
                : <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(150deg, #1b4a34, #0e2419)', border: '2px solid rgba(90,201,168,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Source Serif 4', serif", fontSize: 26, fontWeight: 700, color: '#7fd9ae' }}>{initial}</div>
              }
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: '#f2f6f3' }}>{displayName}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: '#9db9a9' }}>{email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: 'rgba(90,201,168,0.12)', border: '1px solid rgba(90,201,168,0.25)' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '0.04em', color: '#b7d4c5', whiteSpace: 'nowrap' }}>{loginMethodLabel}</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '0.04em', color: '#6f9683', textAlign: 'center' }}>Member since {createdAtLabel}</div>
            </div>

            {/* Tab nav */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 10, borderRadius: 14, border: '1px solid rgba(90,201,168,0.2)', background: 'rgba(9,17,14,0.6)', backdropFilter: 'blur(10px)' }}>
              {TABS.map(([id, label]) => {
                const active = activeTab === id
                const soon = SOON_TABS.has(id)
                return (
                  <button key={id} type="button" onClick={() => setActiveTab(id as TabId)}
                    style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px', border: 0, borderRadius: 8, cursor: 'pointer', background: active ? '#163727' : 'transparent', color: active ? '#eafaf0' : '#b7d4c5', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, transition: 'background 160ms' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#7fd9ae' : '#3a6c53', boxShadow: active ? '0 0 6px #7fd9ae' : 'none' }} />
                    <span>{label}</span>
                    {soon && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#c9aa5a', opacity: 0.8 }}>soon</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right content panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '26px 28px', borderRadius: 16, border: '1px solid rgba(90,201,168,0.25)', background: 'rgba(9,17,14,0.72)', backdropFilter: 'blur(10px)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', minHeight: 480 }}>

            {/* Tab header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4, borderBottom: '1px solid rgba(90,201,168,0.15)' }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, fontWeight: 600, color: '#f2f6f3' }}>{activeMeta[1]}</div>
              <div style={{ fontSize: 12.5, color: '#7fb0a0' }}>{activeMeta[2]}</div>
            </div>

            {/* Tab content */}
            <TabContent
              tab={activeTab}
              user={user}
              email={email}
              activity={activity}
              usageCounts={usageCounts}
              rateLimits={rateLimits}
              openEscalations={openEscalations}
              resolvedEscalations={resolvedEscalations}
              fullName={fullName} setFullName={setFullName}
              org={org} setOrg={setOrg}
              roleInOrg={roleInOrg} setRoleInOrg={setRoleInOrg}
              locationState={locationState} setLocationState={setLocationState}
              locationCity={locationCity} setLocationCity={setLocationCity}
              languagesSpoken={languagesSpoken} toggleLanguage={toggleLanguage}
              avatarUrl={avatarUrl} onAvatarUpload={(url) => setAvatarUrl(url)}
              userType={userType} setUserType={setUserType}
              interfaceLang={interfaceLang} setInterfaceLang={setInterfaceLang}
              answerStyle={answerStyle} setAnswerStyle={setAnswerStyle}
              citationDepth={citationDepth} setCitationDepth={setCitationDepth}
              fontSize={fontSize} setFontSize={setFontSize}
              showConfidence={showConfidence} setShowConfidence={setShowConfidence}
              showTkdl={showTkdl} setShowTkdl={setShowTkdl}
              autoTranslate={autoTranslate} setAutoTranslate={setAutoTranslate}
              reducedMotion={reducedMotion} setReducedMotion={setReducedMotion}
              formulationFocus={formulationFocus} setFormulationFocus={setFormulationFocus}
              ipConcerns={ipConcerns} toggleIpConcern={toggleIpConcern}
              exportMarkets={exportMarkets} toggleExportMarket={toggleExportMarket}
              biologicalResources={biologicalResources} setBioRes={setBioRes}
              sourcesTK={sourcesTK} setSourcesTK={setSourcesTK}
              painPoints={painPoints} setPainPoints={setPainPoints}
              emailEscalation={emailEscalation} setEmailEscalation={setEmailEscalation}
              emailDigest={emailDigest} setEmailDigest={setEmailDigest}
              emailNewStatute={emailNewStatute} setEmailNewStatute={setEmailNewStatute}
              emailRateLimit={emailRateLimit} setEmailRateLimit={setEmailRateLimit}
              notifEmail={notifEmail} setNotifEmail={setNotifEmail}
              marketingOptin={marketingOptin} setMarketingOptin={setMarketingOptin}
              allowAnonQueries={allowAnonQueries} setAllowAnonQueries={setAllowAnonQueries}
              exportLabel={exportLabel} onExport={handleExport}
              router={router}
            />

            {/* Save bar — only for writable tabs */}
            {!SOON_TABS.has(activeTab) && !SAVE_BAR_EXCLUDED.has(activeTab) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(90,201,168,0.12)' }}>
                <button type="button" onClick={handleSave} disabled={saving}
                  style={{ padding: '9px 20px', borderRadius: 999, border: 'none', background: '#1f5f4b', color: '#eafaf0', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >{saving ? 'Saving…' : 'Save changes'}</button>
                {saveMsg && <span style={{ fontSize: 13, color: '#7fd9ae' }}>{saveMsg}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
