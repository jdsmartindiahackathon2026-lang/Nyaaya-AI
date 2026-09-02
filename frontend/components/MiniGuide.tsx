'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  currentScreen: string
  language: string
}

interface Msg { role: 'user' | 'guide'; text: string }

export default function MiniGuide({ currentScreen, language }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!query.trim() || loading) return
    const q = query.trim()
    setQuery('')
    setMsgs(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('mini-guide', {
        body: { query: q, currentScreen, language }
      })
      if (error) throw error
      setMsgs(m => [...m, { role: 'guide', text: data.answer }])
    } catch {
      setMsgs(m => [...m, { role: 'guide', text: 'Guide unavailable. Please try again.' }])
    } finally {
      setLoading(false)
    }
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
            <span style={{ color: 'var(--accent)', fontSize: 15 }}>?</span>
            <span className="label-xs">Nyaaya Guide</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>Groq · Llama</span>
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
                {m.text}
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
          width: 44, height: 44, borderRadius: '50%',
          border: '1px solid var(--border-hi)',
          background: open ? '#1c4a37' : 'var(--bg-input)',
          color: 'var(--accent)',
          cursor: 'pointer', fontSize: 18, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(127,217,174,0.15)',
          transition: 'background 150ms',
        }}
      >
        ?
      </button>
    </div>
  )
}
