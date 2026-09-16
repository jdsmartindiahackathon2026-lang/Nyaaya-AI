import Link from 'next/link'

export default function NotFound() {
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
          maxWidth: 480,
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
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 48,
            fontWeight: 700,
            color: '#7fd9ae',
            lineHeight: 1,
          }}
        >
          404
        </span>

        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "'Source Serif 4', Georgia, serif",
            color: '#f2f6f3',
          }}
        >
          Page Not Found
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#8aab98',
            lineHeight: 1.6,
          }}
        >
          The legal regime, document, or route you requested is not located in the Nyaaya AI corpus.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Link
            href="/app/ask"
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#7fd9ae',
              color: '#061009',
              fontWeight: 600,
              fontSize: 13.5,
              textDecoration: 'none',
            }}
          >
            Go to Assistant
          </Link>
          <Link
            href="/"
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #234437',
              background: 'transparent',
              color: '#7fd9ae',
              fontSize: 13.5,
              textDecoration: 'none',
            }}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  )
}
