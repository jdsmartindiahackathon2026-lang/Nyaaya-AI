'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

const STEPS = ['Describe formulation', 'Add ingredients', 'Review & classify']

const PRODUCT_TYPES = ['Classical', 'Proprietary', 'Cosmetic', 'Food/Aahar', 'Not sure']
const INGREDIENT_FLAGS = [
  { key: 'hasWildCollection', label: 'Contains wild-collected species' },
  { key: 'hasEndangered', label: 'Contains Schedule I / Red List species' },
  { key: 'hasNovelIngredient', label: 'Contains a novel (non-classical) ingredient' },
  { key: 'isForExport', label: 'Intended for export' },
]

interface Result {
  classification: string
  regime: string
  rationale: string
  next_steps: string[]
  citations: { source: string; url: string; statute_ref: string }[]
  confidence: string
}

export default function ClassifyPage() {
  const [step, setStep] = useState(0)
  const [productName, setProductName] = useState('')
  const [productType, setProductType] = useState('')
  const [description, setDescription] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleFlag(key: string) {
    setFlags(f => ({ ...f, [key]: !f[key] }))
  }

  async function classify() {
    if (!productName.trim() || !productType) { setError('Fill required fields.'); return }
    setLoading(true)
    setError(null)
    try {
      // Build payload matching classify-formulation backend contract
      const answers: Record<string, unknown> = {}
      if (productType === 'Classical') {
        answers.firstSchedule = 'yes'
      } else if (productType !== 'Not sure') {
        answers.firstSchedule = 'no'
      }
      if (productType === 'Cosmetic') {
        answers.innovationType = 'cosmetic'
      } else if (productType === 'Food/Aahar') {
        answers.innovationType = 'aahar'
      } else if (flags.hasNovelIngredient) {
        answers.innovationType = 'new_drug'
      }
      answers.usesTraditionalKnowledge = !!flags.hasWildCollection

      const { data, error: fnError } = await supabase.functions.invoke('classify-formulation', {
        body: { step: 3, answers, language: 'en' }
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.message)

      // Map backend response shape to frontend Result interface
      const mapped: Result = {
        classification: data.label ?? data.classification ?? '',
        regime: data.classification ?? '',
        rationale: [data.ipPosture, data.regulatoryRequirements].filter(Boolean).join('\n\n'),
        next_steps: data.nextStep ? [data.nextStep] : [],
        citations: (data.citations ?? []).map((c: Record<string, string>) => ({
          source: c.display_name ?? c.source ?? '',
          url: c.url ?? '',
          statute_ref: c.statute_ref ?? '',
        })),
        confidence: data.model_used === 'hybrid-rag' ? 'high' : 'medium',
      }
      setResult(mapped)
      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Classification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function reset() { setStep(0); setResult(null); setError(null); setProductName(''); setProductType(''); setDescription(''); setIngredients(''); setFlags({}) }

  const stepValid = [
    productName.trim() && productType,
    ingredients.trim(),
    true,
  ]

  return (
    <div style={{ padding: '26px 30px', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>
          Classify your formulation.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-lo)', lineHeight: 1.6 }}>
          Answer 3 questions. The system determines your IP regime and regulatory pathway from official definitions.
        </p>
      </div>

      {/* Step indicator */}
      {step < 3 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? 'var(--accent)' : i === step ? 'rgba(127,217,174,0.2)' : 'var(--bg-input)',
                color: i < step ? '#0b1512' : i === step ? 'var(--accent)' : 'var(--text-dim)',
                border: i === step ? '1px solid var(--accent-dim)' : '1px solid var(--border)',
                flexShrink: 0,
              }}>{i + 1}</div>
              <span style={{ fontSize: 12, color: i === step ? 'var(--text)' : 'var(--text-dim)' }}>{s}</span>
              {i < STEPS.length - 1 && <span style={{ color: 'var(--border-hi)', fontSize: 10 }}>›</span>}
            </div>
          ))}
        </div>
      )}

      {/* Step 0: Basic info */}
      {step === 0 && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label-xs">Product name</label>
            <input
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g. Ashwagandhadi Churna"
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-hi)',
                borderRadius: 8, padding: '10px 12px', color: 'var(--text)',
                fontSize: 14, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif",
                width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label-xs">Product type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRODUCT_TYPES.map(t => (
                <button key={t} onClick={() => setProductType(t)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${productType === t ? 'var(--accent)' : 'var(--border-hi)'}`,
                    background: productType === t ? 'rgba(127,217,174,0.12)' : 'var(--bg-input)',
                    color: productType === t ? 'var(--accent)' : 'var(--text)',
                  }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label-xs">Brief description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the therapeutic claim, preparation method, or intended use…"
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-hi)',
                borderRadius: 8, padding: '10px 12px', color: 'var(--text)',
                fontSize: 14, outline: 'none', resize: 'vertical', width: '100%',
                fontFamily: "'IBM Plex Sans', sans-serif", boxSizing: 'border-box',
              }}
            />
          </div>
          <button onClick={() => setStep(1)} disabled={!stepValid[0]} className="send-btn" style={{ alignSelf: 'flex-start', padding: '10px 22px' }}>
            Next →
          </button>
        </div>
      )}

      {/* Step 1: Ingredients */}
      {step === 1 && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label-xs">Key ingredients</label>
            <textarea
              value={ingredients}
              onChange={e => setIngredients(e.target.value)}
              rows={5}
              placeholder="List the main ingredients, one per line or comma-separated. Include botanical names where known."
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-hi)',
                borderRadius: 8, padding: '10px 12px', color: 'var(--text)',
                fontSize: 14, outline: 'none', resize: 'vertical', width: '100%',
                fontFamily: "'IBM Plex Sans', sans-serif", boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="label-xs">Additional flags</div>
            {INGREDIENT_FLAGS.map(f => (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                <input type="checkbox" checked={!!flags[f.key]} onChange={() => toggleFlag(f.key)}
                  style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer' }} />
                {f.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(0)} style={{
              padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border-hi)',
              background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
            }}>← Back</button>
            <button onClick={() => setStep(2)} disabled={!stepValid[1]} className="send-btn" style={{ padding: '10px 22px' }}>
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review & submit */}
      {step === 2 && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 16, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {[
              { label: 'Product', value: productName },
              { label: 'Type', value: productType },
              { label: 'Description', value: description || '—' },
              { label: 'Ingredients', value: ingredients },
              ...Object.entries(flags).filter(([, v]) => v).map(([k]) => ({
                label: 'Flag', value: INGREDIENT_FLAGS.find(f => f.key === k)?.label ?? k,
              })),
            ].map(row => (
              <div key={row.label + row.value} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <span style={{ color: 'var(--text-dim)', minWidth: 90, flexShrink: 0 }}>{row.label}</span>
                <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{row.value}</span>
              </div>
            ))}
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: 'rgba(196,122,122,0.1)', border: '1px solid rgba(196,122,122,0.3)', color: '#e8a0a0',
            }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={{
              padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border-hi)',
              background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
            }}>← Back</button>
            <button onClick={classify} disabled={loading} className="send-btn" style={{ padding: '10px 22px' }}>
              {loading ? 'Classifying…' : 'Classify →'}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {step === 3 && result && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            padding: 20, borderRadius: 12, border: '1px solid var(--accent-dim)',
            background: 'rgba(127,217,174,0.05)',
          }}>
            <div className="label-xs" style={{ color: 'var(--accent-dim)', marginBottom: 8 }}>Classification</div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-hi)', marginBottom: 4 }}>
              {result.classification}
            </div>
            <div style={{ fontSize: 13, color: 'var(--accent-dim)' }}>Regime: {result.regime}</div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{result.rationale}</div>
          {result.next_steps?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="label-xs">Next steps</div>
              {result.next_steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent-dim)', flexShrink: 0 }}>{i + 1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {result.citations?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="label-xs">Sources</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.citations.map((c, i) => (
                  <a key={i} href={c.url} target="_blank" rel="noreferrer" style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none', background: 'var(--bg-card)',
                  }}>{c.statute_ref || c.source}</a>
                ))}
              </div>
            </div>
          )}
          <button onClick={reset} style={{
            alignSelf: 'flex-start', padding: '10px 18px', borderRadius: 8,
            border: '1px solid var(--border-hi)', background: 'transparent',
            color: 'var(--text)', fontSize: 13, cursor: 'pointer',
          }}>Classify another formulation</button>
        </div>
      )}
    </div>
  )
}
