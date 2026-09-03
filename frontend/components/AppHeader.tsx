'use client'

const MODE_TITLES: Record<string, { title: string; sub: string }> = {
  ask:      { title: 'Ask Interface',        sub: 'Retrieve cited answers from official sources' },
  classify: { title: 'Classify Formulation', sub: 'Determine IP and regulatory posture in 3 steps' },
  abs:      { title: 'ABS Helper',           sub: 'Access and Benefit-Sharing compliance checker' },
  tkdl:     { title: 'TKDL / Prior Art',     sub: 'Check traditional knowledge documentation before filing' },
  escalate: { title: 'Escalate to Human',    sub: 'Connect with a human IP facilitator' },
}

interface Props {
  mode: string
  jurisdiction: string
  onJurisdictionChange: (j: string) => void
}

export default function AppHeader({ mode }: Props) {
  const meta = MODE_TITLES[mode] ?? MODE_TITLES.ask

  return (
    <header style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '16px 30px',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-hi)' }}>
            {meta.title}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-lo)' }}>{meta.sub}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 16px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-hi)',
            borderRadius: 10,
            fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-lo)',
            userSelect: 'none',
          }}>
            Jurisdiction · India
          </div>
        </div>
      </div>
    </header>
  )
}
