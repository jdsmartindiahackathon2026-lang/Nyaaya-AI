'use client'

const QUICK_LINKS = [
  { label: 'Biological Diversity Act, 2002', href: 'https://indiacode.nic.in/bitstream/123456789/1993/1/200218.pdf' },
  { label: 'Biological Diversity Rules, 2004', href: 'https://nbaindia.org/content/25/19/1/rules.html' },
  { label: 'Access and Benefit-Sharing Guidelines', href: 'https://nbaindia.org/content/40/33/1/guidelines.html' },
  { label: 'Nagoya Protocol (WIPO)', href: 'https://www.cbd.int/abs/nagoya-protocol/' },
]

export default function ABSPage() {
  return (
    <div style={{ padding: '26px 30px', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>
          Access & Benefit-Sharing.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-lo)', lineHeight: 1.6 }}>
          Determine which clearances apply when accessing biological resources for Ayurvedic product development or export. Governed by the Biological Diversity Act, 2002 and the Nagoya Protocol.
        </p>
      </div>

      {/* Decision tree */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label-xs">Key questions</div>
        {[
          {
            q: 'Are you sourcing a biological resource from India?',
            a: 'If yes, the Biological Diversity Act applies. You may need approval from the National Biodiversity Authority (NBA) or State Biodiversity Board (SBB).',
          },
          {
            q: 'Is the resource wild-collected or from a protected area?',
            a: 'Wild-collected resources require ABS clearance. Resources from cultivated, common agricultural land may be exempt.',
          },
          {
            q: 'Are you a foreign entity, NRI, or exporting?',
            a: 'NBA approval is mandatory for foreign entities accessing resources or associated traditional knowledge for research, bio-survey, or export.',
          },
          {
            q: 'Are you using associated Traditional Knowledge?',
            a: 'Using TK associated with biological resources requires sharing benefits with local communities. NBA approval and a benefit-sharing agreement are required.',
          },
          {
            q: 'Does the WIPO GRATK Treaty apply?',
            a: 'If filing a patent abroad after November 2024 that uses a genetic resource or associated TK, GRATK disclosure requirements may apply in signatory countries.',
          },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '14px 16px', borderRadius: 9, border: '1px solid var(--border)',
            background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--accent-dim)', background: 'rgba(127,217,174,0.1)',
                border: '1px solid var(--accent-dim)', borderRadius: 4, padding: '2px 7px', flexShrink: 0,
              }}>Q{i + 1}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.4 }}>{item.q}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-lo)', lineHeight: 1.6, paddingLeft: 44 }}>{item.a}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="label-xs">Official references</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_LINKS.map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={{
              padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg-card)', fontSize: 12.5, color: 'var(--accent)',
              textDecoration: 'none', lineHeight: 1.4,
            }}>{l.label}</a>
          ))}
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6,
      }}>
        For detailed ABS compliance questions — benefit-sharing calculations, NBA application procedures, or treaty interaction — use the <a href="/app/ask" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Ask Interface</a> to get cited answers from official sources.
      </div>
    </div>
  )
}
