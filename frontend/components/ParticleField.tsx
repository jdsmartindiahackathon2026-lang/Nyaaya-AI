'use client'

const PARTICLES = [
  { left: '12%',  top: '18%', size: '4px',  cls: 'pf0', dur: '6.2s', delay: '0s'    },
  { left: '28%',  top: '62%', size: '3px',  cls: 'pf1', dur: '7.8s', delay: '-2.1s' },
  { left: '45%',  top: '31%', size: '5px',  cls: 'pf2', dur: '5.4s', delay: '-1.3s' },
  { left: '61%',  top: '74%', size: '3px',  cls: 'pf3', dur: '8.1s', delay: '-3.7s' },
  { left: '73%',  top: '22%', size: '4px',  cls: 'pf4', dur: '6.6s', delay: '-0.8s' },
  { left: '82%',  top: '55%', size: '3px',  cls: 'pf5', dur: '9.2s', delay: '-4.2s' },
  { left: '91%',  top: '38%', size: '4px',  cls: 'pf6', dur: '7.0s', delay: '-1.9s' },
  { left: '37%',  top: '85%', size: '3px',  cls: 'pf7', dur: '5.8s', delay: '-2.6s' },
  { left: '55%',  top: '11%', size: '3px',  cls: 'pf0', dur: '6.9s', delay: '-3.1s' },
  { left: '8%',   top: '47%', size: '4px',  cls: 'pf3', dur: '7.3s', delay: '-0.5s' },
  { left: '19%',  top: '79%', size: '3px',  cls: 'pf5', dur: '8.7s', delay: '-5.0s' },
  { left: '67%',  top: '91%', size: '4px',  cls: 'pf2', dur: '6.1s', delay: '-1.7s' },
]

export default function ParticleField() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`particle ${p.cls}`}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            ['--dur' as string]: p.dur,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  )
}
