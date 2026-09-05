'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'

interface Props {
  currentScreen: string
  language: string
}

interface Msg { role: 'user' | 'guide'; text: string; retryQuery?: string }

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

// Inline owl SVG — geometric, front-facing, brand-palette
function OwlSvg({ size = 48, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Nyaaya Guide owl"
      style={style}
    >
      {/* Body */}
      <path
        d="M24 42c-8 0-14-6-14-14V24c0-8 6-14 14-14s14 6 14 14v4c0 8-6 14-14 14z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M24 42c-8 0-14-6-14-14V24c0-8 6-14 14-14s14 6 14 14v4c0 8-6 14-14 14z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Ear tufts */}
      <path d="M18 12L15 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M30 12L33 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      {/* Face plate */}
      <ellipse cx="24" cy="24" rx="9" ry="8" fill="currentColor" opacity="0.10" stroke="currentColor" strokeWidth="1" />
      {/* Left eye */}
      <circle cx="20" cy="23" r="3.5" fill="var(--accent)" opacity="0.9" />
      <circle cx="20" cy="23" r="1.2" fill="currentColor" opacity="0.85" />
      {/* Right eye */}
      <circle cx="28" cy="23" r="3.5" fill="var(--accent)" opacity="0.9" />
      <circle cx="28" cy="23" r="1.2" fill="currentColor" opacity="0.85" />
      {/* Beak */}
      <path d="M22.5 27L24 30L25.5 27z" fill="currentColor" opacity="0.7" />
      {/* Perch */}
      <line x1="16" y1="44" x2="32" y2="44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

const SUGGESTED_PROMPTS = [
  'What is ABS and do I need it?',
  'Show me how to search TKDL',
  'What does the Ask interface do?',
]

export default function MiniGuide({ currentScreen, language }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(false)
  const [animState, setAnimState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed')

  const bottomRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevLangRef = useRef<string>(language)

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

  // Language-change transcript clear (skip initial mount)
  useEffect(() => {
    if (prevLangRef.current === language) return
    prevLangRef.current = language
    setMsgs([])
    clearTranscript()
  }, [language])

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Clear unread indicator when panel opens
  useEffect(() => {
    if (open) setUnread(false)
  }, [open])

  // Autofocus input when panel opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 350)
      return () => clearTimeout(t)
    }
  }, [open])

  // Esc key closes panel
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Animation state machine
  function handleOpen() {
    setAnimState('opening')
    setOpen(true)
    setTimeout(() => setAnimState('open'), 600)
  }

  function handleClose() {
    setAnimState('closing')
    setTimeout(() => {
      setOpen(false)
      setAnimState('closed')
    }, 400)
  }

  function toggleOpen() {
    if (animState === 'closed' || animState === 'closing') {
      handleOpen()
    } else {
      handleClose()
    }
  }

  const send = useCallback(async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim()
    if (!q || loading) return
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
      if (!open) setUnread(true)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : undefined
      const isRateLimit = status === 429 || /too many requests|rate_limited/i.test(msg)
      const errorText = isRateLimit
        ? "You're going fast — the guide accepts up to 30 messages per minute. Try again in a moment."
        : 'Guide unavailable. Try again?'
      setMsgs(m => [...m, { role: 'guide', text: errorText, retryQuery: q }])
      if (!open) setUnread(true)
    } finally {
      setLoading(false)
    }
  }, [query, msgs, loading, open, currentScreen, language])

  function handleClear() {
    setMsgs([])
    clearTranscript()
  }

  const isOpening = animState === 'opening' || animState === 'open'
  const isVisible = open

  return (
    <>
      <style>{`
        @keyframes mgOwlBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes mgBubbleFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.8); }
        }
        @keyframes mgBubbleFadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mgBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mgBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes mgPanelIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mgPanelOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.92); }
        }
        @keyframes mgOwlFlyIn {
          0% { opacity: 0; transform: translate(80px, 120px) scale(0.5) rotate(15deg); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes mgOwlFlyOut {
          0% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translate(80px, 120px) scale(0.5) rotate(15deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Backdrop */}
      {isVisible && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 998,
            background: 'rgba(6,12,10,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: animState === 'closing'
              ? 'mgBackdropOut 300ms ease forwards'
              : 'mgBackdropIn 300ms ease 150ms both',
          }}
        />
      )}

      {/* Centered modal wrapper */}
      {isVisible && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 'min(520px, 90vw)',
            height: 'min(640px, 85vh)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-hi)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 40px rgba(127,217,174,0.08)',
            pointerEvents: 'auto',
            animation: animState === 'closing'
              ? 'mgPanelOut 300ms cubic-bezier(.4,0,.6,1) forwards'
              : 'mgPanelIn 300ms cubic-bezier(.22,1,.36,1) 250ms both',
          }}>
            {/* Header */}
            <div style={{
              minHeight: 64, padding: '0 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              {/* Owl perched in header */}
              <div style={{
                flexShrink: 0,
                animation: animState === 'closing'
                  ? 'mgOwlFlyOut 350ms cubic-bezier(.4,0,.6,1) forwards'
                  : 'mgOwlFlyIn 500ms cubic-bezier(.16,1.2,.36,1) 100ms both',
              }}>
                <div style={{
                  animation: animState === 'open'
                    ? 'mgOwlBreathe 3.2s ease-in-out infinite'
                    : 'none',
                }}>
                  <OwlSvg size={40} />
                </div>
              </div>

              {/* Title block */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span className="label-xs" style={{ fontSize: 14 }}>Nyaaya Guide</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>Nyaaya · AI</span>
              </div>

              {/* Clear button */}
              <button
                onClick={handleClear}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-dim)', padding: '4px 6px',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                title="Clear conversation"
              >
                Clear
              </button>

              {/* Close button */}
              <button
                onClick={handleClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 18, color: 'var(--text-dim)', padding: '4px 6px',
                  lineHeight: 1, transition: 'color 150ms',
                  fontFamily: 'system-ui, sans-serif',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                title="Close"
                aria-label="Close guide"
              >
                ×
              </button>
            </div>

            {/* Transcript area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {msgs.length === 0 && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
                    Ask me what any feature does, or how to navigate Nyaaya AI.
                  </div>
                  {/* Suggested prompt chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SUGGESTED_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => { setQuery(p); send(p) }}
                        style={{
                          padding: '6px 12px', borderRadius: 999,
                          border: '1px solid var(--border-hi)',
                          fontSize: 12, cursor: 'pointer',
                          background: 'transparent', color: 'var(--text)',
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          transition: 'border-color 150ms, background 150ms',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--accent-dim)'
                          e.currentTarget.style.background = 'rgba(127,217,174,0.06)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-hi)'
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
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
                    <>
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
                      {/* Retry button for error messages */}
                      {m.retryQuery && (
                        <button
                          onClick={() => send(m.retryQuery)}
                          style={{
                            marginTop: 6, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid var(--border-hi)',
                            background: 'transparent', color: 'var(--accent)',
                            fontSize: 11, cursor: 'pointer',
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            transition: 'background 150ms',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(127,217,174,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          Retry
                        </button>
                      )}
                    </>
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

            {/* Input row */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder="Ask about any feature…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              />
              <button onClick={() => send()} disabled={loading || !query.trim()} className="send-btn" style={{ padding: '6px 12px', fontSize: 12 }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bubble trigger — bottom-right */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
        <button
          onClick={toggleOpen}
          title="Nyaaya Guide"
          style={{
            position: 'relative',
            width: 44, height: 44, borderRadius: '50%',
            border: '1px solid var(--border-hi)',
            background: 'var(--bg-input)',
            color: 'var(--accent)',
            cursor: 'pointer', fontSize: 18, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(127,217,174,0.15)',
            transition: 'opacity 200ms, transform 200ms',
            opacity: isOpening ? 0 : 1,
            transform: isOpening ? 'scale(0.8)' : 'scale(1)',
            pointerEvents: isOpening ? 'none' : 'auto',
          }}
          onMouseEnter={e => { if (!isOpening) e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { if (!isOpening) e.currentTarget.style.transform = 'scale(1)' }}
        >
          <OwlSvg size={22} />
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
    </>
  )
}
