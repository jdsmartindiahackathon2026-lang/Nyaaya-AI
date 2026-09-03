'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const ISSUE_TYPES = [
  'Patent filing assistance',
  'GI application support',
  'ABS clearance guidance',
  'TKDL documentation dispute',
  'Export compliance',
  'Other',
]

const URGENCY_OPTS = ['Informational', 'Low', 'Medium', 'High']

export default function EscalatePageWrapper() {
  return (
    <Suspense fallback={null}>
      <EscalatePage />
    </Suspense>
  )
}

function EscalatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hydrated = useRef(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [issueType, setIssueType] = useState('')
  const [urgency, setUrgency] = useState('Medium')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const summary = searchParams?.get('summary')
    const issueTypeParam = searchParams?.get('issueType')
    if (summary) setDescription(decodeURIComponent(summary))
    if (issueTypeParam && ISSUE_TYPES.includes(decodeURIComponent(issueTypeParam))) {
      setIssueType(decodeURIComponent(issueTypeParam))
    }
    if (summary || issueTypeParam) {
      router.replace('/app/escalate', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true); setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('escalate', {
        body: { name, email, issueType, urgency, description }
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.message)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: '26px 30px', maxWidth: 560 }}>
        <div className="rise-in" style={{
          padding: '28px 24px', borderRadius: 12, border: '1px solid var(--accent-dim)',
          background: 'rgba(127,217,174,0.05)', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(127,217,174,0.15)', border: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20 }}>✓</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-hi)' }}>Request received.</div>
          <div style={{ fontSize: 14, color: 'var(--text-lo)', lineHeight: 1.6 }}>
            Your escalation has been logged and routed to a human IP facilitator. Expect a response within 2–3 business days for standard requests, or within 24 hours for High urgency submissions.
          </div>
          <button onClick={() => { setSubmitted(false); setName(''); setEmail(''); setIssueType(''); setDescription(''); setUrgency('Medium') }}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border-hi)',
              background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', marginTop: 4,
            }}>Submit another request</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '26px 30px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>
          Connect with a human.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-lo)', lineHeight: 1.6 }}>
          For complex matters that require expert review — filing strategies, dispute resolution, or regulatory interpretation — submit a request and an IP facilitator will respond.
        </p>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label-xs">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-hi)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif" }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label-xs">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="your@email.com"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-hi)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif" }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="label-xs">Issue type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ISSUE_TYPES.map(t => (
              <button type="button" key={t} onClick={() => setIssueType(t)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${issueType === t ? 'var(--accent)' : 'var(--border-hi)'}`,
                  background: issueType === t ? 'rgba(127,217,174,0.12)' : 'var(--bg-input)',
                  color: issueType === t ? 'var(--accent)' : 'var(--text)',
                }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="label-xs">Urgency</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {URGENCY_OPTS.map(u => (
              <button type="button" key={u} onClick={() => setUrgency(u)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${urgency === u ? 'var(--accent)' : 'var(--border-hi)'}`,
                  background: urgency === u ? 'rgba(127,217,174,0.12)' : 'var(--bg-input)',
                  color: urgency === u ? 'var(--accent)' : 'var(--text)',
                }}>{u}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="label-xs">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={5}
            placeholder="Describe your situation in detail — product name, current stage, the specific question or problem you need help with…"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-hi)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: "'IBM Plex Sans', sans-serif" }} />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(196,122,122,0.1)', border: '1px solid rgba(196,122,122,0.3)', color: '#e8a0a0' }}>{error}</div>
        )}

        <button type="submit" disabled={loading || !name || !email || !issueType || !description} className="send-btn" style={{ alignSelf: 'flex-start', padding: '11px 24px' }}>
          {loading ? 'Submitting…' : 'Submit request →'}
        </button>
      </form>

      <div style={{ fontSize: 11.5, color: 'var(--text-xs)', lineHeight: 1.6 }}>
        Your submission is stored securely. Information is shared only with the assigned IP facilitator.
      </div>
    </div>
  )
}
