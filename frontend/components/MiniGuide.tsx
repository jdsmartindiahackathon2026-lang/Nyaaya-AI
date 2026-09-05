'use client'
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'

interface Props {
  currentScreen: string
  language: string
}

interface Msg { role: 'user' | 'guide'; text: string }

const STORAGE_KEY = 'nyaaya_miniguide_transcript_v1'
const MAX_STORED = 20
const MAX_HISTORY = 6

function loadTranscript(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Msg[]
  } catch {
    return []
  }
}

function saveTranscript(msgs: Msg[]) {
  try {
    const capped = msgs.slice(-MAX_STORED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped))
  } catch {
    // private browsing or storage full — silent fail
  }
}

function clearTranscript() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // silent fail
  }
}

export default function MiniGuide({ currentScreen, language }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)

  // Load transcript from localStorage on mount
  useEffect(() => {
    setMsgs(loadTranscript())
    mountedRef.current = true
  }, [])

  // Save transcript whenever msgs changes (after mount)
  useEffect(() => {
    if (!mountedRef.current) return
    saveTranscript(msgs)
  }, [msgs])

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Clear unread indicator when panel opens
  useEffect(() => {
    if (open) setUnread(false)
  }, [open])

  async function send() {
    if (!query.trim() || loading) return
    const q = query.trim()
    setQuery('')
    const nextMsgs: Msg[] = [...msgs, { role: 'user', text: q }]
    setMsgs(nextMsgs)
    setLoading(true)

    // Build history: last MAX_HISTORY messages before this new user message
    const historySource = msgs.slice(-MAX_HISTORY)
    const history = historySource.map(m => ({
      role: m.role === 'guide' ? 'assistant' : 'user' as 'user' | 'assistant',
      content: m.text,
    }))

    try {
      const { data, error } = await supabase.functions.invoke('mini-guide', {
        body: { query: q, currentScreen, language, history }
      })
      if (error) throw error
      setMsgs(m => [...m, { role: 'guide', text: data.answer }])
      // If panel is closed, mark unread
      if (!open) setUnread(true)
    } catch {
      setMsgs(m => [...m, { role: 'guide', text: 'Guide unavailable. Please try again.' }])
      if (!open) setUnread(true)
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setMsgs([])
    clearTranscript()
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 52, right: 0,
          width: 320, maxHeight: 420,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-hi)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'riseIn 300ms cubic-bezier(.22,1,.36,1) both',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', fontSize: 15, display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 1H2C1.45 1 1 1.45 1 2v8c0 .55.45 1 1 1h2v3l3-3h7c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
            <span className="label-xs">Nyaaya Guide</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>Groq · Llama</span>
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--text-dim)', padding: '2px 4px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              title="Clear conversation"
            >
              Clear
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Ask me what any feature does, or how to navigate Nyaaya AI.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{
                fontSize: 13, lineHeight: 1.5,
                color: m.role === 'user' ? 'var(--text-hi)' : 'var(--text)',
                padding: m.role === 'guide' ? '8px 10px' : 0,
                background: m.role === 'guide' ? 'rgba(127,217,174,0.06)' : 'transparent',
                borderRadius: m.role === 'guide' ? 8 : 0,
                borderLeft: m.role === 'guide' ? '2px solid var(--accent-dim)' : 'none',
                paddingLeft: m.role === 'guide' ? 10 : 0,
              }}>
                {m.role === 'guide' ? (
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => {
                        const isInternal = href && href.startsWith('/app/')
                        return (
                          <a
                            href={href}
                            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                            {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                          >
                            {children}
                          </a>
                        )
                      },
                      p: ({ children }) => (
                        <p style={{ margin: 0 }}>{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ paddingLeft: 18, margin: '4px 0' }}>{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol style={{ paddingLeft: 18, margin: '4px 0' }}>{children}</ol>
                      ),
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
            ))}
            {loading && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', animation: 'glowPulse 1.2s ease-in-out infinite' }}>
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Ask about any feature…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            />
            <button onClick={send} disabled={loading || !query.trim()} className="send-btn" style={{ padding: '6px 12px', fontSize: 12 }}>
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        title="Nyaaya Guide"
        style={{
          position: 'relative',
          width: 44, height: 44, borderRadius: '50%',
          border: '1px solid var(--border-hi)',
          background: open ? '#1c4a37' : 'var(--bg-input)',
          color: 'var(--accent)',
          cursor: 'pointer', fontSize: 18, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(127,217,174,0.15)',
          transition: 'background 150ms, transform 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M14 1H2C1.45 1 1 1.45 1 2v8c0 .55.45 1 1 1h2v3l3-3h7c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
        </svg>
        {unread && !open && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            border: '1.5px solid var(--bg-input)',
          }} />
        )}
      </button>
    </div>
  )
}
