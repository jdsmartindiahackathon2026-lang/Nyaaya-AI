'use client'
import { useReducer, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AbsAnswers,
  AbsResult,
  QuestionId,
  QUESTIONS,
  nextQuestion,
  skippedQuestions,
  deriveObligations,
  buildResult,
  buildAskQuery,
  buildEscalateSummary,
} from '../../../lib/abs_logic'
import { supabase } from '../../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = 'loading' | 'start' | 'question' | 'result'

interface State {
  mode: Mode
  answers: AbsAnswers
  savedResult: AbsResult | null
  isFreshDiagnosis: boolean
}

type Action =
  | { type: 'LOAD_SAVED'; result: AbsResult }
  | { type: 'NO_SAVED' }
  | { type: 'START' }
  | { type: 'ANSWER'; id: QuestionId; value: boolean }
  | { type: 'RESET' }

const EMPTY_ANSWERS: AbsAnswers = { q1: null, q2: null, q3: null, q4: null, q5: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_SAVED':
      return { ...state, mode: 'result', savedResult: action.result, answers: action.result.answers, isFreshDiagnosis: false }
    case 'NO_SAVED':
      return { ...state, mode: 'start' }
    case 'START':
      return { ...state, mode: 'question', answers: EMPTY_ANSWERS, isFreshDiagnosis: true }
    case 'ANSWER': {
      const newAnswers = { ...state.answers, [action.id]: action.value }
      // Skip q2/q3/q4 if q1 is false
      if (action.id === 'q1' && action.value === false) {
        newAnswers.q2 = null
        newAnswers.q3 = null
        newAnswers.q4 = null
      }
      const next = nextQuestion(newAnswers)
      if (next === 'done') {
        return { ...state, answers: newAnswers, mode: 'result', savedResult: null, isFreshDiagnosis: true }
      }
      return { ...state, answers: newAnswers }
    }
    case 'RESET':
      return { mode: 'start', answers: EMPTY_ANSWERS, savedResult: null, isFreshDiagnosis: false }
    default:
      return state
  }
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'Biological Diversity Act, 2002', href: 'https://indiacode.nic.in/bitstream/123456789/1993/1/200218.pdf' },
  { label: 'Biological Diversity Rules, 2004', href: 'https://nbaindia.org/content/25/19/1/rules.html' },
  { label: 'Access and Benefit-Sharing Guidelines', href: 'https://nbaindia.org/content/40/33/1/guidelines.html' },
  { label: 'Nagoya Protocol (WIPO)', href: 'https://www.cbd.int/abs/nagoya-protocol/' },
]

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 2 * Math.PI
    const dist = 60 + Math.random() * 40
    const dx = Math.round(Math.cos(angle) * dist)
    const dy = Math.round(Math.sin(angle) * dist + 60)
    return { dx, dy, delay: i * 60 }
  })

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: 30,
          left: '50%',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent)',
          // @ts-expect-error css custom properties
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          animation: `confettiFall 800ms ease-out ${p.delay}ms both`,
          opacity: 0,
        }} />
      ))}
    </div>
  )
}

// ─── Obligation counter card ───────────────────────────────────────────────────

function ObligationCounter({ count }: { count: number }) {
  let color = 'var(--text-dim)'
  if (count >= 4) color = 'var(--accent-hi)'
  else if (count >= 2) color = 'rgba(217,180,127,0.9)'

  const subline =
    count === 0 ? '0 so far — looking good'
    : count <= 2 ? `${count} clearance${count === 1 ? '' : 's'} apply`
    : `${count} clearances — substantial obligations`

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      alignSelf: 'flex-start',
      padding: '12px 16px',
      borderRadius: 10,
      border: '1px solid var(--border-hi)',
      background: 'var(--bg-card)',
      minWidth: 160,
      textAlign: 'center',
      backdropFilter: 'blur(8px)',
    }}>
      <div className="label-xs" style={{ marginBottom: 6 }}>Obligations triggered</div>
      <div key={count} style={{
        fontSize: 36,
        fontWeight: 700,
        color,
        lineHeight: 1,
        animation: count > 0 ? 'gooeyIn 400ms ease both' : undefined,
      }}>{count}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>{subline}</div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ABSPage() {
  const router = useRouter()
  const [state, dispatch] = useReducer(reducer, {
    mode: 'loading',
    answers: EMPTY_ANSWERS,
    savedResult: null,
    isFreshDiagnosis: false,
  })

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading'>('idle')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const confettiShown = useRef(false)

  // Load saved diagnosis on mount
  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { dispatch({ type: 'NO_SAVED' }); return }

        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()
        if (!userRow) { dispatch({ type: 'NO_SAVED' }); return }

        const { data: row } = await supabase
          .from('abs_diagnoses')
          .select('answers, obligations, obligation_count, created_at')
          .eq('user_id', userRow.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (row) {
          const result = buildResult(row.answers as AbsAnswers)
          dispatch({ type: 'LOAD_SAVED', result })
        } else {
          dispatch({ type: 'NO_SAVED' })
        }
      } catch (err) {
        console.error('ABS load error:', err)
        dispatch({ type: 'NO_SAVED' })
      }
    }
    load()
  }, [])

  // Track confetti
  if (state.mode === 'result' && state.isFreshDiagnosis && !confettiShown.current) {
    confettiShown.current = true
  }
  if (state.mode !== 'result') confettiShown.current = false

  const result = state.mode === 'result' ? buildResult(state.answers) : null
  const currentQId = state.mode === 'question' ? nextQuestion(state.answers) : null
  const currentQ = currentQId && currentQId !== 'done'
    ? QUESTIONS.find(q => q.id === currentQId) ?? null
    : null

  const liveCount = deriveObligations(state.answers).length

  // Answered questions for summary rows
  const answeredQs = QUESTIONS.filter(q => state.answers[q.id] !== null)
  const skipped = skippedQuestions(state.answers)

  async function handleSave() {
    if (!result) return
    setSaveStatus('saving')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      if (!userRow) throw new Error('User profile not found')

      const { error } = await supabase.from('abs_diagnoses').insert({
        user_id: userRow.id,
        answers: result.answers,
        obligations: result.obligations,
        obligation_count: result.obligationCount,
      })
      if (error) throw error
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save error:', err)
      setSaveStatus('error')
      setErrorBanner('Could not save to profile. Please try again.')
      setTimeout(() => setErrorBanner(null), 5000)
    }
  }

  async function handleDownloadPDF() {
    if (!result) return
    setPdfStatus('loading')
    try {
      const { downloadMemo } = await import('../../../components/ABSMemoPDF')
      await downloadMemo(result)
    } finally {
      setPdfStatus('idle')
    }
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (state.mode === 'loading') {
    return (
      <div style={{ padding: '26px 30px' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  // ── START ────────────────────────────────────────────────────────────────────
  if (state.mode === 'start') {
    return (
      <div className="rise-in" style={{ padding: '26px 30px', maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>
            {"Let's work out which ABS clearances apply to you."}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-lo)', lineHeight: 1.6 }}>
            5 questions. Personalised checklist at the end. No data leaves your browser until you save.
          </p>
        </div>

        <button className="send-btn" onClick={() => dispatch({ type: 'START' })} style={{ alignSelf: 'flex-start', fontSize: 14, padding: '12px 28px' }}>
          Start diagnosis →
        </button>

        {/* Reference accordion */}
        <details style={{ borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
          <summary style={{ padding: '12px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--text-lo)', userSelect: 'none', listStyle: 'none' }}>
            <span className="label-xs" style={{ marginRight: 6 }}>▸</span>
            See all 5 questions as a list
          </summary>
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                q: 'Are you sourcing a biological resource from India?',
                a: 'If yes, the Biological Diversity Act applies. You may need approval from the National Biodiversity Authority (NBA) or State Biodiversity Board (SBB).',
              },
              {
                q: 'Is the resource wild-collected or from a protected area?',
                a: 'Wild-collected resources require ABS clearance. Resources from cultivated, common agricultural land may be exempt.',
              },
              {
                q: 'Are you a foreign entity, NRI, or exporting?',
                a: 'NBA approval is mandatory for foreign entities accessing resources or associated traditional knowledge for research, bio-survey, or export.',
              },
              {
                q: 'Are you using associated Traditional Knowledge?',
                a: 'Using TK associated with biological resources requires sharing benefits with local communities. NBA approval and a benefit-sharing agreement are required.',
              },
              {
                q: 'Does the WIPO GRATK Treaty apply?',
                a: 'If filing a patent abroad after November 2024 that uses a genetic resource or associated TK, GRATK disclosure requirements may apply in signatory countries.',
              },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div className="mono" style={{
                    fontSize: 11, color: 'var(--accent-dim)', background: 'rgba(127,217,174,0.1)',
                    border: '1px solid var(--accent-dim)', borderRadius: 4, padding: '2px 7px', flexShrink: 0,
                  }}>Q{i + 1}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.4 }}>{item.q}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-lo)', lineHeight: 1.6, paddingLeft: 44 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </details>

        {/* Quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="label-xs">Official references</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_LINKS.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={{
                padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)',
                background: 'var(--bg-card)', fontSize: 12.5, color: 'var(--accent)',
                textDecoration: 'none', lineHeight: 1.4,
              }}>{l.label}</a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── QUESTION ─────────────────────────────────────────────────────────────────
  if (state.mode === 'question') {
    const totalQ = 5
    const answeredCount = answeredQs.length + skipped.length
    const progressPct = Math.round((answeredCount / totalQ) * 100)

    return (
      <div style={{ padding: '26px 30px', maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'var(--accent)',
            borderRadius: 2,
            transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        {/* Layout: question + counter */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Answered summary rows */}
            {answeredQs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {answeredQs.map(q => {
                  if (skipped.includes(q.id)) return null
                  const ans = state.answers[q.id]
                  const qNum = QUESTIONS.findIndex(x => x.id === q.id) + 1
                  return (
                    <div key={q.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 12px', borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      fontSize: 12.5, color: 'var(--text-lo)',
                    }}>
                      <span className="mono" style={{ color: 'var(--accent-dim)', fontSize: 10 }}>Q{qNum}</span>
                      <span style={{ flex: 1 }}>{q.text}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 5, fontSize: 11,
                        background: ans ? 'rgba(127,217,174,0.15)' : 'rgba(127,127,127,0.1)',
                        color: ans ? 'var(--accent)' : 'var(--text-dim)',
                        border: `1px solid ${ans ? 'var(--accent-dim)' : 'var(--border-hi)'}`,
                        fontWeight: 600,
                      }}>
                        {ans ? 'Yes' : 'No'}
                      </span>
                      <span style={{ color: 'var(--accent)', fontSize: 12 }}>✓</span>
                    </div>
                  )
                })}
                {skipped.length > 0 && (
                  <div style={{
                    padding: '7px 12px', borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    fontSize: 12, color: 'var(--text-dim)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 11,
                      background: 'rgba(111,150,131,0.1)',
                      border: '1px solid var(--border-hi)',
                      color: 'var(--text-dim)',
                    }}>
                      {skipped.length} question{skipped.length > 1 ? 's' : ''} skipped
                    </span>
                    <span>Indian sourcing does not apply</span>
                  </div>
                )}
              </div>
            )}

            {/* Current question card */}
            {currentQ && (
              <div key={currentQ.id} style={{
                padding: '20px 22px', borderRadius: 12,
                border: '1px solid var(--border-hi)',
                background: 'var(--bg-card)',
                display: 'flex', flexDirection: 'column', gap: 14,
                animation: 'slideInRight 280ms cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="label-xs">{currentQ.statuteAnchor}</span>
                </div>
                <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.35 }}>
                  {currentQ.text}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-lo)', lineHeight: 1.6 }}>
                  {currentQ.explainer}
                </div>
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => {
                    setTimeout(() => dispatch({ type: 'ANSWER', id: currentQ.id, value: true }), 200)
                  }} style={{
                    padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid var(--accent)',
                    background: 'rgba(127,217,174,0.15)', color: 'var(--accent)',
                    transition: 'background 150ms',
                  }}>
                    Yes
                  </button>
                  <button onClick={() => {
                    setTimeout(() => dispatch({ type: 'ANSWER', id: currentQ.id, value: false }), 200)
                  }} style={{
                    padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid var(--border-hi)',
                    background: 'transparent', color: 'var(--text-lo)',
                    transition: 'background 150ms',
                  }}>
                    No
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sticky counter */}
          <ObligationCounter count={liveCount} />
        </div>
      </div>
    )
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (state.mode === 'result' && result) {
    return (
      <div style={{ padding: '26px 30px', maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>

        {state.isFreshDiagnosis && <Confetti />}

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>
            {result.headline}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-lo)', lineHeight: 1.6 }}>
            {result.intro}
          </p>
        </div>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="label-xs">Your checklist</div>
          {result.obligations.length === 0 ? (
            <div style={{
              padding: '20px 22px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-card)', fontSize: 14, color: 'var(--accent)', textAlign: 'center',
            }}>
              {"You're clear — no ABS approvals are required for your situation."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.obligations.map(ob => (
                <div key={ob.code} style={{
                  padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0, marginTop: 2 }}>▪</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.4 }}>
                        {ob.label}
                      </div>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent-dim)', marginTop: 3 }}>
                        {ob.statute}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-lo)', lineHeight: 1.6, marginTop: 6 }}>
                        {ob.detail}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
                    <a href={ob.link} target="_blank" rel="noreferrer" style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12,
                      border: '1px solid var(--border-hi)', color: 'var(--text-lo)',
                      textDecoration: 'none', background: 'transparent',
                    }}>
                      View source ↗
                    </a>
                    <button onClick={() => router.push(`/app/ask?q=${encodeURIComponent(buildAskQuery(ob))}`)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12,
                      border: '1px solid var(--accent-dim)', color: 'var(--accent)',
                      cursor: 'pointer', background: 'transparent',
                    }}>
                      Ask about this →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error banner */}
        {errorBanner && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(196,122,122,0.1)',
            border: '1px solid rgba(196,122,122,0.3)',
            color: '#e8a0a0', fontSize: 13,
          }}>
            {errorBanner}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={handleDownloadPDF} disabled={pdfStatus === 'loading'} style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--border-hi)',
            background: 'var(--bg-card)', color: 'var(--text-lo)',
            opacity: pdfStatus === 'loading' ? 0.6 : 1,
          }}>
            {pdfStatus === 'loading' ? 'Preparing…' : 'Download memo (PDF)'}
          </button>

          <button onClick={() => {
            router.push(`/app/escalate?issueType=${encodeURIComponent('ABS clearance guidance')}&summary=${encodeURIComponent(buildEscalateSummary(result))}`)
          }} style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--border-hi)',
            background: 'var(--bg-card)', color: 'var(--text-lo)',
          }}>
            Escalate
          </button>

          {state.isFreshDiagnosis && (
            <button onClick={handleSave} disabled={saveStatus === 'saving' || saveStatus === 'saved'} className="send-btn" style={{
              opacity: saveStatus === 'saved' ? 0.7 : 1,
            }}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save to profile'}
            </button>
          )}

          <button onClick={() => { dispatch({ type: 'RESET' }); setSaveStatus('idle') }} style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-dim)',
          }}>
            Retake diagnosis
          </button>
        </div>

        {/* Disclaimer */}
        <div style={{ fontSize: 11.5, color: 'var(--text-xs)', lineHeight: 1.6 }}>
          {result.disclaimer}
        </div>
      </div>
    )
  }

  return null
}

