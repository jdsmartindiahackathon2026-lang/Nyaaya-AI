'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  PRICING_TIERS,
  COMPARISON_FEATURES,
  BillingInterval,
  BillingTier,
} from '../../lib/pricingConfig'

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  const tiers = (Object.keys(PRICING_TIERS) as BillingTier[]).map(
    (key) => PRICING_TIERS[key]
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #0d231a 0%, #060e0a 55%, #040806 100%)',
      color: '#e4eae6',
      fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '0 0 80px',
    }}>
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(90, 201, 168, 0.12)',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1e4f3a 0%, #0f2b20 100%)',
            border: '1px solid rgba(90, 201, 168, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7fd9ae',
            fontWeight: 700,
            fontSize: 16,
          }}>
            न्या
          </div>
          <span style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 20,
            fontWeight: 700,
            color: '#f0f5f2',
            letterSpacing: '-0.02em',
          }}>
            Nyaaya AI
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/login" style={{
            color: '#94a79d',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 0.15s',
          }}>
            Sign in
          </Link>
          <Link href="/login?mode=signup" style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: '#5ac9a8',
            color: '#061710',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
            transition: 'opacity 0.15s',
          }}>
            Get Started Free
          </Link>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 860,
        margin: '60px auto 40px',
        textAlign: 'center',
        padding: '0 20px',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'rgba(90, 201, 168, 0.08)',
          border: '1px solid rgba(90, 201, 168, 0.25)',
          color: '#7fd9ae',
          fontSize: 12.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 20,
        }}>
          Transparent AYUSH Compliance Pricing
        </div>
        <h1 style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 700,
          color: '#f4f8f6',
          lineHeight: 1.15,
          letterSpacing: '-0.025em',
          marginBottom: 16,
        }}>
          Formulation clearance, without the corporate legal retainers.
        </h1>
        <p style={{
          fontSize: 17,
          color: '#9db4a9',
          lineHeight: 1.6,
          maxWidth: 640,
          margin: '0 auto 36px',
        }}>
          Every tier gives you authoritative Indian statutory grounding, TKDL prior art intelligence, and multi-user workspace collaboration.
        </p>

        {/* Billing Interval Toggle */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: 4,
          borderRadius: 10,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <button
            onClick={() => setInterval('monthly')}
            style={{
              padding: '8px 20px',
              borderRadius: 7,
              border: 'none',
              background: interval === 'monthly' ? '#1c4233' : 'transparent',
              color: interval === 'monthly' ? '#eafaf0' : '#889f93',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('annual')}
            style={{
              padding: '8px 20px',
              borderRadius: 7,
              border: 'none',
              background: interval === 'annual' ? '#1c4233' : 'transparent',
              color: interval === 'annual' ? '#eafaf0' : '#889f93',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            Annual
            <span style={{
              background: 'rgba(90, 201, 168, 0.2)',
              color: '#5ac9a8',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}>
              2 Months Free
            </span>
          </button>
        </div>
      </section>

      {/* ── Pricing Cards Grid ───────────────────────────────────────── */}
      <section style={{
        maxWidth: 1240,
        margin: '0 auto 80px',
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 20,
        alignItems: 'stretch',
      }}>
        {tiers.map((tier) => {
          const isAnnual = interval === 'annual'
          const price = isAnnual ? tier.annualPriceINR : tier.monthlyPriceINR
          const monthlyEquivalent = isAnnual && tier.annualPriceINR > 0
            ? Math.round(tier.annualPriceINR / 12)
            : tier.monthlyPriceINR

          return (
            <div
              key={tier.id}
              style={{
                borderRadius: 16,
                border: tier.popular
                  ? '1.5px solid rgba(90, 201, 168, 0.65)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                background: tier.popular
                  ? 'linear-gradient(180deg, rgba(20, 52, 39, 0.7) 0%, rgba(8, 24, 18, 0.85) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: tier.popular ? '0 12px 36px -10px rgba(90, 201, 168, 0.25)' : 'none',
              }}
            >
              {tier.popular && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(90deg, #5ac9a8, #7fd9ae)',
                  color: '#061710',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 12px',
                  borderRadius: 999,
                }}>
                  {tier.badge || 'Most Popular'}
                </div>
              )}

              {/* Title & Description */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#f0f5f2',
                  margin: '0 0 6px',
                }}>
                  {tier.name}
                </h3>
                <p style={{
                  fontSize: 13,
                  color: '#8fa599',
                  lineHeight: 1.45,
                  minHeight: 40,
                  margin: 0,
                }}>
                  {tier.description}
                </p>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 500, color: '#7fd9ae' }}>₹</span>
                  <span style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontSize: 40,
                    fontWeight: 800,
                    color: '#f4f8f6',
                    letterSpacing: '-0.03em',
                  }}>
                    {monthlyEquivalent.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: 13, color: '#889f93', marginLeft: 2 }}>
                    / month
                  </span>
                </div>
                {isAnnual && price > 0 && (
                  <div style={{ fontSize: 12, color: '#5ac9a8', marginTop: 4 }}>
                    Billed ₹{price.toLocaleString('en-IN')} annually
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#7a8f84', marginTop: 6 }}>
                  {typeof tier.seats === 'number' ? `${tier.seats} Workspace Seats included` : 'Unlimited Seats + SSO'}
                </div>
              </div>

              {/* Feature List */}
              <div style={{ flex: 1, marginBottom: 28 }}>
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#657e72',
                  marginBottom: 12,
                }}>
                  What is included:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tier.features.map((f, idx) => (
                    <li key={idx} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: f.highlight ? '#d3f2e4' : '#9bb0a4',
                      fontWeight: f.highlight ? 600 : 400,
                    }}>
                      <span style={{ color: '#5ac9a8', fontSize: 14, lineHeight: 1 }}>✓</span>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Call to Action */}
              <Link
                href={tier.ctaHref || `/app/profile?upgrade=${tier.id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px 18px',
                  borderRadius: 9,
                  background: tier.popular ? '#5ac9a8' : 'rgba(255, 255, 255, 0.08)',
                  color: tier.popular ? '#061710' : '#f0f5f2',
                  border: tier.popular ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  transition: 'transform 0.15s ease, background 0.15s ease',
                }}
              >
                {tier.ctaLabel}
              </Link>
            </div>
          )
        })}
      </section>

      {/* ── Feature Comparison Matrix ─────────────────────────────────── */}
      <section style={{
        maxWidth: 1100,
        margin: '0 auto 80px',
        padding: '0 20px',
      }}>
        <h2 style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 28,
          fontWeight: 700,
          color: '#f0f5f2',
          textAlign: 'center',
          marginBottom: 36,
        }}>
          Compare all tier specifications
        </h2>

        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          overflowX: 'auto',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: 13.5,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)' }}>
                <th style={{ padding: '16px 20px', color: '#8fa599', fontWeight: 600 }}>Capability</th>
                <th style={{ padding: '16px 16px', color: '#f0f5f2', fontWeight: 600, width: '18%' }}>Community</th>
                <th style={{ padding: '16px 16px', color: '#f0f5f2', fontWeight: 600, width: '18%' }}>Starter</th>
                <th style={{ padding: '16px 16px', color: '#5ac9a8', fontWeight: 700, width: '18%' }}>Pro</th>
                <th style={{ padding: '16px 16px', color: '#f0f5f2', fontWeight: 600, width: '18%' }}>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((section, sIdx) => (
                <tr key={sIdx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div style={{
                      padding: '12px 20px',
                      background: 'rgba(90, 201, 168, 0.05)',
                      color: '#7fd9ae',
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {section.category}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {section.rows.map((row, rIdx) => (
                          <tr key={rIdx} style={{
                            borderBottom: rIdx === section.rows.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                          }}>
                            <td style={{ padding: '12px 20px', color: '#c7d7ce' }}>{row.name}</td>
                            <td style={{ padding: '12px 16px', color: '#889f93', width: '18%' }}>{row.free}</td>
                            <td style={{ padding: '12px 16px', color: '#e4eae6', width: '18%' }}>{row.starter}</td>
                            <td style={{ padding: '12px 16px', color: '#5ac9a8', fontWeight: 600, width: '18%' }}>{row.pro}</td>
                            <td style={{ padding: '12px 16px', color: '#e4eae6', width: '18%' }}>{row.enterprise}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Frequently Asked Questions ────────────────────────────────── */}
      <section style={{
        maxWidth: 780,
        margin: '0 auto',
        padding: '0 20px',
      }}>
        <h2 style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 28,
          fontWeight: 700,
          color: '#f0f5f2',
          textAlign: 'center',
          marginBottom: 32,
        }}>
          Frequently Asked Questions
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            {
              q: 'Can our Ayurvedic formulation secrets leak into public AI training sets?',
              a: 'Never. Nyaaya AI supports Confidential Mode with cryptographically verified SHA-256 receipts. Enterprise and Pro customer data is never stored permanently or used to train third-party foundation models.',
            },
            {
              q: 'Why are ABS Memos watermarked on the Community free tier?',
              a: 'The interactive questionnaire allows formulators to diagnose clearance without upfront payment. The official clean PDF is reserved for paid tiers to ensure filings made before State Biodiversity Boards are backed by verified account registration.',
            },
            {
              q: 'How does team seat allocation work?',
              a: 'Starter includes 3 seats and Pro includes 10 seats. Workspace owners can invite formulators, R&D chemists, and external legal counsel using 24-hour secure links without paying extra per seat.',
            },
            {
              q: 'Can I cancel or switch tiers anytime?',
              a: 'Yes. You can upgrade, downgrade, or cancel your subscription at any time directly within your Workspace Profile settings.',
            },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '20px 22px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, color: '#f0f5f2', margin: '0 0 8px' }}>
                {item.q}
              </h4>
              <p style={{ fontSize: 14, color: '#90a498', lineHeight: 1.6, margin: 0 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
