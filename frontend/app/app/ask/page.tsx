'use client'
import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
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
interface ConversationRow {
  id: string
  title: string | null
  created_at: string
}

const NEW_CHAT_LABEL = 'New chat'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString()
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
  const [userRowId, setUserRowId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loadingConv, setLoadingConv] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSentRef = useRef(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Fetch users.id + past conversations on mount ───────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: userRow } = await supabase
        .from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (cancelled || !userRow) return
      setUserRowId(userRow.id)
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      setConversations(convs ?? [])
    })()
    return () => { cancelled = true }
  }, [])

  // ── Handle ?q= deep link (auto-send once) ──────────────────────────────────
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

  // Create a conversation row lazily on first send if none is active.
  async function ensureConversation(firstQuery: string, jurisdiction: string): Promise<string | null> {
    if (activeConvId) return activeConvId
    if (!userRowId) return null
    const title = firstQuery.length > 60 ? firstQuery.slice(0, 60).trimEnd() + '…' : firstQuery
    const { data, error: insErr } = await supabase
      .from('conversations')
      .insert({ user_id: userRowId, jurisdiction, title })
      .select('id, title, created_at')
      .single()
    if (insErr || !data) return null
    setActiveConvId(data.id)
    setConversations(prev => [data as ConversationRow, ...prev])
    return data.id
  }

  const startNewChat = useCallback(() => {
    setActiveConvId(null)
    setMessages([])
    setError(null)
    setQuery('')
    textareaRef.current?.focus()
  }, [])

  async function loadConversation(convId: string) {
    if (convId === activeConvId || loadingConv) return
    setLoadingConv(true)
    setError(null)
    try {
      const { data, error: msgErr } = await supabase
        .from('messages')
        .select('role, content, citations, confidence')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      if (msgErr) throw msgErr
      const loaded: Message[] = (data ?? []).map(r => ({
        role: r.role as 'user' | 'assistant',
        content: r.content as string,
        citations: (r.citations ?? []) as Citation[],
        confidence: (r.confidence ?? undefined) as Message['confidence'],
      }))
      setMessages(loaded)
      setActiveConvId(convId)
    } catch (err) {
      console.error('Load conversation error:', err)
      setError('Could not load that conversation.')
    } finally {
      setLoadingConv(false)
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
      const convId = await ensureConversation(q, ctx.jurisdiction)
      const history = messages.map(m => ({ role: m.role, content: m.content })).slice(-6)
      const { data, error: fnError } = await supabase.functions.invoke('ask-query', {
        body: {
          query: q,
          jurisdiction: ctx.jurisdiction,
          language: ctx.language,
          userType: ctx.userType,
          conversationId: convId,
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
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* ── Chat history rail ─────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(7,13,11,0.35)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 12px 10px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={startNewChat} style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '9px 12px', borderRadius: 8,
            border: '1px solid var(--border-hi)',
            background: 'rgba(28,74,55,0.35)',
            color: 'var(--accent)',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 150ms, border-color 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(28,74,55,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(28,74,55,0.35)' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span> New chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px 16px' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '12px 8px', fontSize: 11.5, color: 'var(--text-xs)', lineHeight: 1.5 }}>
              No past conversations yet. Ask your first question to start one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {conversations.map(c => {
                const active = c.id === activeConvId
                return (
                  <button key={c.id} onClick={() => loadConversation(c.id)}
                    style={{
                      textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid transparent',
                      background: active ? 'rgba(28,74,55,0.5)' : 'transparent',
                      color: active ? 'var(--text-hi)' : 'var(--text-lo)',
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      fontSize: 12.5, lineHeight: 1.35,
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 3,
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(28,74,55,0.2)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {c.title?.trim() || NEW_CHAT_LABEL}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-xs)' }}>
                      {relativeTime(c.created_at)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main chat pane ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                      {m.confidence && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`label-xs confidence-${m.confidence}`}>
                            {m.confidence.toUpperCase()} CONFIDENCE
                          </span>
                        </div>
                      )}
                      <div style={{
                        fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {m.content}
                      </div>
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
              {(loading || loadingConv) && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  <span style={{ animation: 'glowPulse 1.2s ease-in-out infinite' }}>
                    {loadingConv ? 'Loading conversation…' : 'Retrieving from official sources…'}
                  </span>
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
    </div>
  )
}
