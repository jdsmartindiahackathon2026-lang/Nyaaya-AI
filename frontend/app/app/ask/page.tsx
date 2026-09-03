'use client'
import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const SUGGESTIONS = [
  { regime: 'Patents',     text: 'Can we patent a classical Ashwagandha formulation drawn from Charaka Samhita?' },
  { regime: 'GI',         text: 'Does this product qualify for a Geographical Indication, and how is that different from a patent?' },
  { regime: 'ABS',        text: 'We are sourcing a wild-collected herb for export. What Biological Diversity Act clearances apply?' },
  { regime: 'GRATK',      text: 'How does the WIPO GRATK Treaty change our disclosure duty when filing abroad?' },
]

interface Citation { source: string; url: string; statute_ref: string }
interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  confidence?: 'high' | 'medium' | 'abstain'
  disclaimer?: string
}

export default function AskPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AskPage />
    </Suspense>
  )
}

function AskPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSentRef = useRef(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (autoSentRef.current) return
    const q = searchParams?.get('q')
    if (!q) return
    const decoded = decodeURIComponent(q)
    if (!decoded.trim()) return
    autoSentRef.current = true
    setQuery(decoded)
    router.replace('/app/ask', { scroll: false })
    sendQuery(decoded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getContext() {
    try {
      return {
        jurisdiction: localStorage.getItem('nyaaya_jurisdiction') ?? 'india',
        language:     localStorage.getItem('nyaaya_language')     ?? 'en',
        userType:     localStorage.getItem('nyaaya_userType')     ?? 'startup',
      }
    } catch {
      return { jurisdiction: 'india', language: 'en', userType: 'startup' }
    }
  }

  async function sendQuery(q: string) {
    if (!q.trim() || loading) return
    const ctx = getContext()
    setError(null)
    setMessages(m => [...m, { role: 'user', content: q }])
    setQuery('')
    setLoading(true)
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content })).slice(-6)
      const { data, error: fnError } = await supabase.functions.invoke('ask-query', {
        body: {
          query: q,
          jurisdiction: ctx.jurisdiction,
          language: ctx.language,
          userType: ctx.userType,
          conversationId: null,
          history,
        },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.message)
      setMessages(m => [...m, {
        role: 'assistant',
        content: data.answer,
        citations: data.citations ?? [],
        confidence: data.confidence,
        disclaimer: data.disclaimer,
      }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
      setMessages(m => m.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(query) }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Thread or empty state */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 10px' }}>
        {isEmpty ? (
          <div className="rise-in" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h1 className="serif" style={{
                margin: 0, fontSize: 33, lineHeight: 1.15, fontWeight: 700,
                letterSpacing: '-0.02em', color: 'var(--text-hi)',
              }}>
                Ask a question. Trace it to its root.
              </h1>
              <p style={{
                margin: 0, fontSize: 15, lineHeight: 1.6,
                color: 'var(--text-lo)', maxWidth: '60ch',
              }}>
                Every answer is retrieved from a version-tracked corpus of statutes, rules, treaties, pharmacopoeial standards and registry records. Each citation traces back to its official source.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="label-xs">Start with</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s.regime} onClick={() => sendQuery(s.text)} className="suggestion-card">
                    <div className="label-xs" style={{ color: 'var(--accent-dim)' }}>{s.regime}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)' }}>{s.text}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((m, i) => (
              <div key={i} className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {m.role === 'user' ? (
                  <div style={{
                    alignSelf: 'flex-end', maxWidth: '80%',
                    padding: '10px 14px', borderRadius: 10,
                    background: '#163727', color: 'var(--text-hi)',
                    fontSize: 14, lineHeight: 1.5,
                  }}>
                    {m.content}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Confidence badge */}
                    {m.confidence && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`label-xs confidence-${m.confidence}`}>
                          {m.confidence.toUpperCase()} CONFIDENCE
                        </span>
                      </div>
                    )}
                    {/* Answer */}
                    <div style={{
                      fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {m.content}
                    </div>
                    {/* Citations */}
                    {m.citations && m.citations.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="label-xs">Sources</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {m.citations.map((c, ci) => (
                            <a key={ci} href={c.url} target="_blank" rel="noreferrer" style={{
                              padding: '4px 10px', borderRadius: 6,
                              border: '1px solid var(--border)',
                              fontSize: 11.5, color: 'var(--accent)',
                              textDecoration: 'none', background: 'var(--bg-card)',
                              transition: 'border-color 150ms',
                            }}>
                              {c.statute_ref || c.source}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Disclaimer */}
                    {m.disclaimer && (
                      <div style={{
                        fontSize: 11.5, color: 'var(--text-xs)',
                        borderTop: '1px solid var(--border)',
                        paddingTop: 10, lineHeight: 1.5,
                      }}>
                        {m.disclaimer}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                <span style={{ animation: 'glowPulse 1.2s ease-in-out infinite' }}>Retrieving from official sources…</span>
              </div>
            )}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(196,122,122,0.1)',
                border: '1px solid rgba(196,122,122,0.3)',
                color: '#e8a0a0', fontSize: 13,
              }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '16px 30px 20px',
        borderTop: isEmpty ? 'none' : '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 720 }}>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            placeholder="Ask a question about Ayurveda IP or regulatory compliance…"
            className="chat-input"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button
            onClick={() => sendQuery(query)}
            disabled={loading || !query.trim()}
            className="send-btn"
          >
            {loading ? '…' : 'Ask →'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-xs)', maxWidth: 720 }}>
          Press Enter to send · Shift+Enter for new line · Citations from official government sources only
        </div>
      </div>
    </div>
  )
}
