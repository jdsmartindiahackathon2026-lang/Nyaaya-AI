'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface TKDLResult {
  status: 'documented' | 'partial' | 'not_found'
  summary: string
  references: { title: string; url: string; statute_ref: string }[]
  confidence: string
  recommendation: string
}

export default function TKDLPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TKDLResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    if (!query.trim() || loading) return
    setLoading(true); setError(null); setResult(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('tkdl-search', { body: { query } })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.message)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    documented: '#7fd9ae',
    partial: '#d9c87f',
    not_found: '#d97f7f',
  }
  const STATUS_LABEL: Record<string, string> = {
    documented: 'DOCUMENTED IN TKDL',
    partial: 'PARTIALLY DOCUMENTED',
    not_found: 'NOT FOUND',
  }

  return (
    <div style={{ padding: '26px 30px', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>
          Check prior art before filing.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-lo)', lineHeight: 1.6 }}>
          Search the Traditional Knowledge Digital Library and Indian patent corpus to determine if a formulation or technique is already documented. Sources: tkdl.res.in, indiacode.nic.in.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="e.g. Ashwagandha root extract for stress relief, Turmeric anti-inflammatory preparation…"
          style={{
            flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-hi)',
            borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
            fontSize: 14, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        />
        <button onClick={search} disabled={loading || !query.trim()} className="send-btn" style={{ padding: '10px 18px' }}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(196,122,122,0.1)', border: '1px solid rgba(196,122,122,0.3)', color: '#e8a0a0',
        }}>{error}</div>
      )}

      {loading && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', animation: 'glowPulse 1.2s ease-in-out infinite' }}>
          Searching TKDL corpus and patent records…
        </div>
      )}

      {result && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            padding: '14px 18px', borderRadius: 10,
            border: `1px solid ${STATUS_COLOR[result.status]}40`,
            background: `${STATUS_COLOR[result.status]}0d`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: STATUS_COLOR[result.status],
              boxShadow: `0 0 8px ${STATUS_COLOR[result.status]}80`,
            }} />
            <div>
              <div className="label-xs" style={{ color: STATUS_COLOR[result.status] }}>{STATUS_LABEL[result.status]}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{result.confidence} confidence</div>
            </div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{result.summary}</div>
          {result.recommendation && (
            <div style={{
              padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-card)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
            }}>
              <div className="label-xs" style={{ marginBottom: 6 }}>Recommendation</div>
              {result.recommendation}
            </div>
          )}
          {result.references?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="label-xs">References</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.references.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noreferrer" style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none', background: 'var(--bg-card)',
                  }}>{r.statute_ref || r.title}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-lo)' }}>Scope:</strong> Searches are restricted to tkdl.res.in and indiacode.nic.in as primary sources. A "not found" result does not guarantee patentability — a full FER search through the Indian Patent Office is required before filing.
      </div>
    </div>
  )
}
