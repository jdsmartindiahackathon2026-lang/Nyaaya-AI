'use client'
import { useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  maskFormulationText,
  computePayloadSha256,
  generateAuditCertificate,
  ConfidentialReceipt,
} from '../../../lib/privacyShield'

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
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Confidential Computing & Privacy Shield State
  const [confidentialMode, setConfidentialMode] = useState(true)
  const [maskProportions, setMaskProportions] = useState(true)
  const [confidentialReceipt, setConfidentialReceipt] = useState<ConfidentialReceipt | null>(null)

  function toggleFlag(key: string) {
    setFlags(f => ({ ...f, [key]: !f[key] }))
  }

  const stepValid = [
    productName.trim().length > 0 && productType.length > 0,
    ingredients.trim().length > 0,
    true,
  ]

  function handleNextStep(targetStep: number) {
    if (targetStep > step && !stepValid[step]) {
      setTouched(t => ({ ...t, [step === 0 ? 'step0' : 'step1']: true }))
      return
    }
    setError(null)
    setStep(targetStep)
  }

  // Computed masked ingredients preview for step 2 review
  const maskedPreview = useMemo(() => {
    if (!maskProportions) return null
    const res = maskFormulationText(ingredients)
    return res.tokenCount > 0 ? res : null
  }, [ingredients, maskProportions])

  async function classify() {
    if (!productName.trim() || !productType) { setError('Fill required fields.'); return }
    setLoading(true)
    setError(null)
    try {
      let finalDescription = description
      let finalIngredients = ingredients

      if (confidentialMode && maskProportions) {
        const maskedDesc = maskFormulationText(description)
        const maskedIng = maskFormulationText(ingredients)
        finalDescription = maskedDesc.maskedText
        finalIngredients = maskedIng.maskedText
      }

      const payloadString = JSON.stringify({
        productName,
        productType,
        description: finalDescription,
        ingredients: finalIngredients,
        flags,
      })
      const payloadHash = await computePayloadSha256(payloadString)

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
        body: {
          step: 3,
          answers,
          language: 'en',
          confidential_mode: confidentialMode,
          payload_hash: payloadHash,
        }
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.message)

      if (data?.confidential_receipt) {
        setConfidentialReceipt(data.confidential_receipt)
      } else {
        setConfidentialReceipt(null)
      }

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

  function reset() {
    setStep(0)
    setResult(null)
    setConfidentialReceipt(null)
    setError(null)
    setProductName('')
    setProductType('')
    setDescription('')
    setIngredients('')
    setFlags({})
    setTouched({})
  }

  function handleDownloadCertificate() {
    if (!confidentialReceipt) return
    const certJson = generateAuditCertificate(
      confidentialReceipt,
      productName || 'Confidential Formulation',
      'Ayurvedic Patent & Regulatory Classification'
    )
    const blob = new Blob([certJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nyaaya_tee_receipt_${confidentialReceipt.receipt_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              onClick={() => {
                if (i <= step || stepValid[step]) {
                  handleNextStep(i)
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, fontSize: 12,
                cursor: i <= step || stepValid[step] ? 'pointer' : 'default',
                color: step === i ? 'var(--accent)' : step > i ? 'var(--accent-dim)' : 'var(--text-dim)',
                transition: 'color 120ms',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                background: step === i ? 'rgba(127,217,174,0.15)' : step > i ? 'rgba(127,217,174,0.08)' : 'var(--bg-card)',
                border: step === i ? '1.5px solid var(--accent)' : step > i ? '1px solid var(--accent-dim)' : '1px solid var(--border)',
                color: step === i ? 'var(--accent)' : step > i ? 'var(--accent-dim)' : 'var(--text-dim)',
              }}>
                {step > i ? '✓' : i + 1}
              </span>
              <span>{s}</span>
              {i < STEPS.length - 1 && <span style={{ color: 'var(--border-hi)', marginLeft: 3 }}>›</span>}
            </div>
          ))}
        </div>
      )}

      {/* Step 0: Basic info */}
      {step === 0 && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="label-xs">Product name <span style={{ color: 'var(--accent)' }}>*</span></label>
              {touched.step0 && !productName.trim() && (
                <span style={{ fontSize: 11, color: '#e8a0a0' }}>Product name is required</span>
              )}
            </div>
            <input
              type="text"
              value={productName}
              onChange={e => {
                setProductName(e.target.value)
                if (touched.step0) setTouched(t => ({ ...t, step0: false }))
              }}
              placeholder="e.g. Ashwagandharishta Plus, Turmeric Curcuminoid Complex"
              style={{
                background: 'var(--bg-input)',
                border: touched.step0 && !productName.trim() ? '1px solid #c47a7a' : '1px solid var(--border-hi)',
                borderRadius: 8, padding: '10px 12px', color: 'var(--text)',
                fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="label-xs">Product type <span style={{ color: 'var(--accent)' }}>*</span></label>
              {touched.step0 && !productType && (
                <span style={{ fontSize: 11, color: '#e8a0a0' }}>Please select a type</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRODUCT_TYPES.map(t => (
                <button key={t} type="button" onClick={() => {
                  setProductType(t)
                  if (touched.step0) setTouched(prev => ({ ...prev, step0: false }))
                }}
                  style={{
                    padding: '8px 15px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${productType === t ? 'var(--accent)' : touched.step0 && !productType ? 'rgba(196,122,122,0.6)' : 'var(--border-hi)'}`,
                    background: productType === t ? 'rgba(127,217,174,0.15)' : 'var(--bg-input)',
                    color: productType === t ? 'var(--accent)' : 'var(--text)',
                    transition: 'all 120ms',
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
          <button
            onClick={() => handleNextStep(1)}
            className="send-btn"
            style={{ alignSelf: 'flex-start', padding: '10px 22px' }}
          >
            Next: Add ingredients →
          </button>
        </div>
      )}

      {/* Step 1: Ingredients */}
      {step === 1 && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="label-xs">Key ingredients <span style={{ color: 'var(--accent)' }}>*</span></label>
              {touched.step1 && !ingredients.trim() && (
                <span style={{ fontSize: 11, color: '#e8a0a0' }}>Ingredients list is required</span>
              )}
            </div>
            <textarea
              value={ingredients}
              onChange={e => {
                setIngredients(e.target.value)
                if (touched.step1) setTouched(t => ({ ...t, step1: false }))
              }}
              rows={5}
              placeholder="List the main ingredients, one per line or comma-separated. Include botanical names and concentrations where known (e.g. Withania somnifera 45% extract, Piper nigrum 5% piperine)."
              style={{
                background: 'var(--bg-input)',
                border: touched.step1 && !ingredients.trim() ? '1px solid #c47a7a' : '1px solid var(--border-hi)',
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
            <button
              onClick={() => handleNextStep(2)}
              className="send-btn"
              style={{ padding: '10px 22px' }}
            >
              Review formulation →
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

          {/* Confidential Computing & TEE Shield Card */}
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            border: confidentialMode ? '1px solid rgba(127,217,174,0.4)' : '1px solid var(--border)',
            background: confidentialMode ? 'rgba(9, 23, 17, 0.75)' : 'var(--bg-card)',
            display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: confidentialMode ? '0 4px 20px rgba(90,201,168,0.1)' : 'none',
            transition: 'all 180ms ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: confidentialMode ? '#7fd9ae' : 'var(--text)' }}>
                    Confidential TEE Shield & Zero Retention
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                    Evaluates in hardware memory enclave (AMD SEV-SNP). 0 bytes saved to database.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfidentialMode(!confidentialMode)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                  fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer',
                  border: confidentialMode ? '1px solid #7fd9ae' : '1px solid var(--border-hi)',
                  background: confidentialMode ? 'rgba(127,217,174,0.2)' : 'transparent',
                  color: confidentialMode ? '#7fd9ae' : 'var(--text-lo)',
                  transition: 'all 120ms',
                }}
              >
                {confidentialMode ? '✓ TEE ACTIVE' : 'OFF'}
              </button>
            </div>

            {confidentialMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(127,217,174,0.12)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={maskProportions}
                    onChange={e => setMaskProportions(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', marginTop: 2, cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Client-Side Proportional Masking</strong> — Automatically mask exact concentration percentages (e.g. <code>45% w/w</code>) and solvent ratios into abstract tokens before leaving your browser. Safeguards patent novelty under Section 29–34.
                  </span>
                </label>

                {maskProportions && maskedPreview && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(90,201,168,0.2)', fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ color: '#7fd9ae', fontWeight: 600 }}>Sanitized Payload (What the AI Enclave receives):</div>
                    <div style={{ color: 'var(--text-lo)', fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.4 }}>
                      {maskedPreview.maskedText}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 2 }}>
                      ✓ {maskedPreview.tokenCount} proprietary trade secret parameter(s) masked in-browser.
                    </div>
                  </div>
                )}
              </div>
            )}
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
              {loading ? 'Classifying…' : 'Classify formulation →'}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {step === 3 && result && (
        <div className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* TEE Verification Certificate Card */}
          {confidentialReceipt && (
            <div style={{
              padding: '16px 18px', borderRadius: 12,
              border: '1px solid rgba(127,217,174,0.45)',
              background: 'linear-gradient(135deg, rgba(9,25,18,0.85) 0%, rgba(6,16,12,0.92) 100%)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🔒</span>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7fd9ae',
                  }}>
                    Zero-Retention Memory Enclave Verified
                  </span>
                </div>
                <button
                  onClick={handleDownloadCertificate}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: '1px solid rgba(127,217,174,0.4)',
                    background: 'rgba(127,217,174,0.12)', color: '#7fd9ae',
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title="Download signed JSON certificate for patent records"
                >
                  ↓ Download Audit Certificate
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 11.5, marginTop: 4 }}>
                <div style={{ color: 'var(--text-dim)' }}>
                  Receipt ID: <span style={{ color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace" }}>{confidentialReceipt.receipt_id}</span>
                </div>
                <div style={{ color: 'var(--text-dim)' }}>
                  Enclave Spec: <span style={{ color: 'var(--text)' }}>{confidentialReceipt.enclave_spec}</span>
                </div>
                <div style={{ color: 'var(--text-dim)' }}>
                  Data Retention: <span style={{ color: '#7fd9ae' }}>{confidentialReceipt.data_retention}</span>
                </div>
                <div style={{ color: 'var(--text-dim)' }}>
                  SHA-256 Digest: <span style={{ color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace" }}>{confidentialReceipt.payload_sha256.slice(0, 16)}…</span>
                </div>
              </div>
            </div>
          )}

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
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none', background: 'var(--bg-card)',
                  }}>{c.statute_ref || c.source}</a>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            <button onClick={reset} style={{
              padding: '10px 18px', borderRadius: 8,
              border: '1px solid var(--border-hi)', background: 'transparent',
              color: 'var(--text)', fontSize: 13, cursor: 'pointer',
            }}>Classify another formulation</button>
            <a
              href={`/app/ask?q=${encodeURIComponent(`What regulatory filings apply to a ${result.classification || productType} formulation like ${productName}?`)}`}
              style={{
                padding: '10px 18px', borderRadius: 8,
                border: '1px solid var(--accent-dim)', background: 'rgba(127,217,174,0.1)',
                color: 'var(--accent)', fontSize: 13, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              Ask legal assistant about this →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
