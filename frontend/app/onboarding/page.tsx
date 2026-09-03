'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import OnboardingBackground from '../../components/OnboardingBackground'

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'practitioner' | 'startup' | 'researcher' | 'cultivator'
type Lang = 'en' | 'hi' | 'bn'

// ─── Screen 1: Language selection data ────────────────────────────────────────
const LANGUAGES: { code: Lang; native: string; english: string; tooltip: string }[] = [
  { code: 'en', native: 'English',  english: 'English', tooltip: 'Continue in English' },
  { code: 'hi', native: 'हिंदी',    english: 'Hindi',   tooltip: 'हिंदी में जारी रखें' },
  { code: 'bn', native: 'বাংলা',    english: 'Bengali', tooltip: 'বাংলায় চালিয়ে যান' },
]

// ─── Screen 2: Role selection data ────────────────────────────────────────────
const ROLES: { code: Role; title: string; desc: string }[] = [
  { code: 'practitioner', title: 'Practitioner / Vaidya',   desc: 'I practice Ayurveda and want to protect or commercialise my formulations' },
  { code: 'startup',      title: 'Startup / MSME',          desc: 'I have a product and need IP protection and regulatory compliance guidance' },
  { code: 'researcher',   title: 'Researcher / Student',    desc: 'I\'m exploring Ayurveda IP law and traditional knowledge frameworks' },
  { code: 'cultivator',   title: 'Cultivator / FPO',        desc: 'I grow or supply medicinal plants and want to understand my rights' },
]

// ─── Screen 3: Branched context questions ─────────────────────────────────────
const CONTEXT_QUESTIONS: Record<Role, { heading: string; questions: { key: string; label: string; chips: string[] }[] }> = {
  practitioner: {
    heading: 'Tell us about your formulation',
    questions: [
      { key: 'formulation_type', label: 'What best describes your formulation?', chips: ['Classical', 'Own innovation', 'Both'] },
      { key: 'selling',          label: 'Are you currently selling?',             chips: ['Yes commercially', 'Personal practice only', 'Planning to start'] },
    ],
  },
  startup: {
    heading: 'Tell us about your product',
    questions: [
      { key: 'stage',   label: 'What stage are you at?',      chips: ['Formulation stage', 'Product ready', 'Already in market'] },
      { key: 'concern', label: 'What\'s your primary concern?', chips: ['Patent', 'GI or trademark', 'Drug regulatory', 'ABS compliance', 'All of the above'] },
    ],
  },
  researcher: {
    heading: 'What are you researching?',
    questions: [
      { key: 'area', label: 'Pick your primary area', chips: ['Patents & TK', 'GI & geographical origin', 'ABS & biodiversity', 'Drug regulation', 'General overview'] },
    ],
  },
  cultivator: {
    heading: 'Tell us about your work',
    questions: [
      { key: 'growing', label: 'What are you primarily growing?', chips: ['Single herb', 'Multiple herbs', 'Wild-collected', 'Cultivated'] },
      { key: 'concern', label: 'What\'s your primary concern?',   chips: ['ABS obligations', 'GI for regional produce', 'Export compliance', 'Biopiracy protection'] },
    ],
  },
}

// ─── Screen 4: Focus area derivation ─────────────────────────────────────────
function deriveFocusArea(role: Role, answers: Record<string, string>): string {
  switch (role) {
    case 'practitioner': return answers['formulation_type'] ?? ''
    case 'startup':      return answers['concern'] ?? ''
    case 'researcher':   return answers['area'] ?? ''
    case 'cultivator':   return answers['concern'] ?? ''
  }
}

// ─── Screen 4: Personalised summary paragraphs ────────────────────────────────
function buildSummary(role: Role, answers: Record<string, string>): string {
  switch (role) {
    case 'practitioner':
      return `We've tailored your Nyaaya AI experience for Ayurveda practitioners. Your focus on ${answers['formulation_type'] ?? 'your formulation'} will guide our IP and commercialisation recommendations. We'll surface the most relevant pathways for protecting your knowledge and growing your practice.`
    case 'startup':
      return `Your journey as a startup navigating Ayurveda IP starts here. Based on your stage and focus on ${answers['concern'] ?? 'compliance'}, we'll bring you targeted guidance on patents, regulatory approvals, and market-entry requirements in India.`
    case 'researcher':
      return `As a researcher, you'll get deep access to Ayurveda IP frameworks and case law. Your interest in ${answers['area'] ?? 'IP research'} will shape the sources and citations we surface — from TKDL databases to Nagoya Protocol obligations.`
    case 'cultivator':
      return `We've configured Nyaaya AI to support cultivators and FPOs. Your primary concern around ${answers['concern'] ?? 'your rights'} will drive personalised guidance on ABS obligations, GI tags, and biodiversity protection relevant to your produce.`
  }
}

// ─── Role display label ───────────────────────────────────────────────────────
function roleLabel(role: Role): string {
  return ROLES.find(r => r.code === role)?.title ?? role
}

// ─── Language display label ───────────────────────────────────────────────────
function langLabel(code: Lang): string {
  return LANGUAGES.find(l => l.code === code)?.native ?? code
}

// ─── Pill button shared styles ────────────────────────────────────────────────
function pillBtn(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    maxWidth: 280,
    padding: '14px 0',
    borderRadius: 999,
    border: 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
    fontSize: 15,
    fontWeight: 600,
    background: enabled ? '#7fd9ae' : '#234437',
    color: enabled ? '#0b1512' : '#6f9683',
    opacity: enabled ? 1 : 0.4,
    transition: 'transform 180ms, opacity 180ms',
    alignSelf: 'center',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()

  // Skip if already onboarded
  useEffect(() => {
    try {
      if (localStorage.getItem('nyaaya_onboarded') === '1') {
        router.replace('/app/ask')
      }
    } catch {}
  }, [router])

  const [screen, setScreen] = useState<1 | 2 | 3 | 4>(1)
  const [lang, setLang]     = useState<Lang>('en')
  const [role, setRole]     = useState<Role | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [hoveredLang, setHoveredLang] = useState<Lang | null>(null)
  const [loading, setLoading] = useState(false)

  // ── Screen 4 CTA: auth + persist ─────────────────────────────────────────
  async function finish() {
    if (loading) return
    setLoading(true)
    const userType = role ?? 'practitioner'
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError) throw authError
      const userId = authData?.user?.id
      if (userId) {
        const { error: upsertError } = await supabase.from('users').upsert({
          id: userId,
          auth_id: userId,
          user_type: userType,
          language: lang,
          jurisdiction: 'india',
          context_answers: answers,
        })
        if (upsertError) throw upsertError
      }
      try {
        localStorage.setItem('nyaaya_userType', userType)
        localStorage.setItem('nyaaya_language', lang)
        localStorage.setItem('nyaaya_jurisdiction', 'india')
        localStorage.setItem('nyaaya_onboarded', '1')
      } catch {}
      router.push('/app/ask')
    } catch {
      try {
        localStorage.setItem('nyaaya_userType', userType)
        localStorage.setItem('nyaaya_language', lang)
        localStorage.setItem('nyaaya_jurisdiction', 'india')
        localStorage.setItem('nyaaya_onboarded', '1')
      } catch {}
      router.push('/app/ask')
    } finally {
      setLoading(false)
    }
  }

  // ── Screen 3: are all questions answered? ─────────────────────────────────
  const screen3Complete = role
    ? CONTEXT_QUESTIONS[role].questions.every(q => !!answers[q.key])
    : false

  // ── Shared wrapper ────────────────────────────────────────────────────────
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    minHeight: '100vh',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  }

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 44,
    animation: 'riseIn 500ms cubic-bezier(0.22,1,0.36,1) both',
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Language Selection
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 1) {
    return (
      <div style={wrapperStyle}>
        <OnboardingBackground />

        <div style={contentStyle}>
          {/* Heading */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <h1 style={{
              fontFamily: 'Source Serif 4, Georgia, serif',
              fontSize: 30, fontWeight: 700,
              color: '#f2f6f3', letterSpacing: '-0.01em',
              margin: 0,
            }}>
              Choose your language
            </h1>
          </div>

          {/* Language cards */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {LANGUAGES.map((l, idx) => (
              <div
                key={l.code}
                style={{ width: 240, flex: '0 0 240px', position: 'relative' }}
                onMouseEnter={() => setHoveredLang(l.code)}
                onMouseLeave={() => setHoveredLang(null)}
              >
                {/* Hover tooltip */}
                {hoveredLang === l.code && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 4px)',
                    left: '50%', transform: 'translateX(-50%)',
                    width: 220, height: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10,
                    animation: 'tooltipBounce 700ms cubic-bezier(0.22,1,0.36,1) both',
                  }}>
                    <svg viewBox="0 0 220 100" xmlns="http://www.w3.org/2000/svg"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <path
                        d="M10 0 H210 Q220 0 220 10 V78 Q220 88 210 88 H122 L110 100 L98 88 H10 Q0 88 0 78 V10 Q0 0 10 0 Z"
                        fill="#f2f6f3"
                      />
                    </svg>
                    <span style={{
                      position: 'relative', zIndex: 1,
                      fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
                      fontSize: 13, color: '#0b1512',
                      lineHeight: 1.4, textAlign: 'center',
                      width: '65%',
                      marginBottom: 12,
                      animation: 'tooltipText 350ms 90ms ease-out both',
                    }}>
                      {l.tooltip}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => { setLang(l.code); setScreen(2) }}
                  style={{
                    width: '100%', height: 140,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 10, padding: '0 20px',
                    borderRadius: 16,
                    border: `1px solid #234437`,
                    background: 'rgba(15,28,22,0.65)',
                    cursor: 'pointer',
                    transition: 'background 180ms, border-color 180ms, transform 180ms',
                    animation: `cardZoomIn 600ms cubic-bezier(0.22,1,0.36,1) ${idx * 0.15}s both`,
                  }}
                  onMouseEnter={e => {
                    const t = e.currentTarget
                    t.style.background = '#163727'
                    t.style.borderColor = '#3a6c53'
                    t.style.transform = 'translateY(-3px)'
                  }}
                  onMouseLeave={e => {
                    const t = e.currentTarget
                    t.style.background = 'rgba(15,28,22,0.65)'
                    t.style.borderColor = '#234437'
                    t.style.transform = 'none'
                  }}
                >
                  <span style={{
                    fontFamily: 'Source Serif 4, Georgia, serif',
                    fontSize: 34, fontWeight: 600, color: '#f2f6f3',
                    animation: `gooeyIn 550ms ease-out ${idx * 0.15 + 0.65}s both`,
                  }}>
                    {l.native}
                  </span>
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12, fontWeight: 400,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#6f9683',
                    animation: `gooeyIn 550ms ease-out ${idx * 0.15 + 0.75}s both`,
                  }}>
                    {l.english}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — Who Are You (role selection)
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 2) {
    return (
      <div style={wrapperStyle}>
        <OnboardingBackground />

        <div style={{ ...contentStyle, gap: 36, maxWidth: 720, width: '100%' }}>
          {/* Heading */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <h1 style={{
              fontFamily: 'Source Serif 4, Georgia, serif',
              fontSize: 32, fontWeight: 700, color: '#f2f6f3',
              margin: 0, textAlign: 'center',
            }}>Who are you?</h1>
            <p style={{
              fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
              fontSize: 16, color: '#9db9a9',
              margin: 0, textAlign: 'center',
            }}>
              We'll personalise your experience based on your role
            </p>
          </div>

          {/* Role options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            {ROLES.map(r => (
              <button
                key={r.code}
                onClick={() => setRole(r.code)}
                style={{
                  width: '100%', padding: '18px 22px',
                  borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                  border: `1px solid ${role === r.code ? '#5a9a76' : '#234437'}`,
                  background: role === r.code ? '#163727' : 'rgba(15,28,22,0.65)',
                  transition: 'border-color 180ms, background 180ms',
                }}
                onMouseEnter={e => {
                  if (role !== r.code) {
                    const t = e.currentTarget
                    t.style.background = '#163727'
                  }
                }}
                onMouseLeave={e => {
                  if (role !== r.code) {
                    const t = e.currentTarget
                    t.style.background = 'rgba(15,28,22,0.65)'
                  }
                }}
              >
                <div style={{
                  fontFamily: 'Source Serif 4, Georgia, serif',
                  fontSize: 19, fontWeight: 600, color: '#f2f6f3',
                  marginBottom: 4,
                }}>{r.title}</div>
                <div style={{
                  fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
                  fontSize: 14, lineHeight: 1.4, color: '#9db9a9',
                }}>{r.desc}</div>
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            disabled={!role}
            onClick={() => role && setScreen(3)}
            style={{
              ...pillBtn(!!role),
              ...(role ? {} : {}),
            }}
            onMouseEnter={e => { if (role) e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 3 — Context Questions
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 3 && role) {
    const branch = CONTEXT_QUESTIONS[role]

    return (
      <div style={wrapperStyle}>
        <OnboardingBackground />

        <div style={{ ...contentStyle, gap: 36, maxWidth: 720, width: '100%' }}>
          {/* Heading */}
          <h1 style={{
            fontFamily: 'Source Serif 4, Georgia, serif',
            fontSize: 32, fontWeight: 700, color: '#f2f6f3',
            margin: 0, textAlign: 'center',
          }}>{branch.heading}</h1>

          {/* Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, width: '100%' }}>
            {branch.questions.map(q => (
              <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
                  fontSize: 17, fontWeight: 600, color: '#f2f6f3',
                }}>{q.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {q.chips.map(chip => {
                    const selected = answers[q.key] === chip
                    return (
                      <button
                        key={chip}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.key]: chip }))}
                        style={{
                          padding: '14px 20px', borderRadius: 12, cursor: 'pointer',
                          border: `1px solid ${selected ? '#5a9a76' : '#234437'}`,
                          background: selected ? '#163727' : 'rgba(15,28,22,0.65)',
                          fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
                          fontSize: 14, fontWeight: 500,
                          color: selected ? '#f2f6f3' : '#9db9a9',
                          transition: 'border-color 180ms, background 180ms, color 180ms',
                        }}
                        onMouseEnter={e => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = '#3a6c53'
                            e.currentTarget.style.background = '#163727'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = '#234437'
                            e.currentTarget.style.background = 'rgba(15,28,22,0.65)'
                          }
                        }}
                      >
                        {chip}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            disabled={!screen3Complete}
            onClick={() => screen3Complete && setScreen(4)}
            style={pillBtn(screen3Complete)}
            onMouseEnter={e => { if (screen3Complete) e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 4 — Session Summary
  // ════════════════════════════════════════════════════════════════════════════
  const safeRole = role ?? 'practitioner'
  const focusArea = deriveFocusArea(safeRole, answers)
  const summaryText = buildSummary(safeRole, answers)

  const DETAIL_ROWS: { label: string; value: string }[] = [
    { label: 'Language',     value: langLabel(lang) },
    { label: 'Role',         value: roleLabel(safeRole) },
    { label: 'Jurisdiction', value: 'India' },
    { label: 'Focus area',   value: focusArea },
  ]

  return (
    <div style={wrapperStyle}>
      <OnboardingBackground />

      <div style={{ ...contentStyle, gap: 32, maxWidth: 560, width: '100%', textAlign: 'center' }}>
        {/* Heading + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 style={{
            fontFamily: 'Source Serif 4, Georgia, serif',
            fontSize: 34, fontWeight: 700, color: '#f2f6f3',
            margin: 0,
          }}>You're all set</h1>
          <p style={{
            fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
            fontSize: 16, lineHeight: 1.6, color: '#9db9a9',
            margin: 0,
          }}>{summaryText}</p>
        </div>

        {/* Session details card */}
        <div style={{
          width: '100%',
          borderRadius: 14,
          border: '1px solid #234437',
          background: 'rgba(15,28,22,0.65)',
          overflow: 'hidden',
        }}>
          {DETAIL_ROWS.map((row, idx) => (
            <div
              key={row.label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 22px',
                borderBottom: idx < DETAIL_ROWS.length - 1 ? '1px solid #1a3327' : 'none',
              }}
            >
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12, fontWeight: 400,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: '#6f9683',
              }}>{row.label}</span>
              <span style={{
                fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
                fontSize: 15, fontWeight: 500, color: '#f2f6f3',
              }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={finish}
          disabled={loading}
          style={{
            width: '100%', maxWidth: 320, padding: '15px 0',
            borderRadius: 999, border: 'none', cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
            fontSize: 16, fontWeight: 600,
            background: '#7fd9ae', color: '#0b1512',
            transition: 'transform 180ms',
            opacity: loading ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
        >
          {loading ? 'Setting up…' : 'Enter Nyaaya AI'}
        </button>

        {/* Helper text */}
        <p style={{
          fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
          fontSize: 12, color: '#6f9683', margin: '-24px 0 0',
        }}>
          You can change these settings anytime from your session panel
        </p>
      </div>
    </div>
  )
}
