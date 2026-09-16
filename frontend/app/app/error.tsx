'use client'

import { useEffect } from 'react'
import { logger } from '../../lib/logger'

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Dashboard route error caught by /app/error.tsx', error, {
      digest: error.digest,
    })
  }, [error])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          background: 'rgba(15,28,22,0.92)',
          border: '1px solid #234437',
          borderRadius: 14,
          padding: '32px 26px',
          boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(196,122,122,0.15)',
            border: '1px solid rgba(196,122,122,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          🌿
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "'Source Serif 4', Georgia, serif",
            color: '#f2f6f3',
          }}
        >
          Session View Interrupted
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: '#8aab98',
            lineHeight: 1.6,
          }}
        >
          We encountered an issue rendering this workspace section. Your conversation history and active organization remain safely preserved.
        </p>

        {error.digest && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              background: '#0e1e17',
              border: '1px solid #1c3229',
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#7fd9ae',
            }}
          >
            Trace ID: {error.digest}
          </span>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button
            onClick={() => reset()}
            className="send-btn"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            Reload Section
          </button>
        </div>
      </div>
    </div>
  )
}
