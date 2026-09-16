'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '../lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Root application error caught by error.tsx', error, {
      digest: error.digest,
    })
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#070d0b',
        color: '#e7ede9',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          background: 'rgba(15,28,22,0.85)',
          border: '1px solid #1c3229',
          borderRadius: 14,
          padding: '36px 30px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(196,122,122,0.15)',
            border: '1px solid rgba(196,122,122,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "'Source Serif 4', Georgia, serif",
            color: '#f2f6f3',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#8aab98',
            lineHeight: 1.6,
          }}
        >
          An unexpected application error occurred. Diagnostic details have been logged.
        </p>

        {error.digest && (
          <code
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              background: '#0e1e17',
              border: '1px solid #1c3229',
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#7fd9ae',
            }}
          >
            Ref: {error.digest}
          </code>
        )}

        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#7fd9ae',
              color: '#061009',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
          >
            Try Again
          </button>
          <Link
            href="/"
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #234437',
              background: 'transparent',
              color: '#7fd9ae',
              textDecoration: 'none',
              fontSize: 13.5,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
