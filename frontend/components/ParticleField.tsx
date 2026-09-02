'use client'

const PARTICLES = [
  { left: '12%',  top: '18%', size: '4px', cls: 'pf0', dur: '6.2s',  delay: '0s'    },
  { left: '28%',  top: '62%', size: '3px', cls: 'pf1', dur: '7.8s',  delay: '-2.1s' },
  { left: '45%',  top: '31%', size: '5px', cls: 'pf2', dur: '5.4s',  delay: '-1.3s' },
  { left: '61%',  top: '74%', size: '3px', cls: 'pf3', dur: '8.1s',  delay: '-3.7s' },
  { left: '73%',  top: '22%', size: '4px', cls: 'pf4', dur: '6.6s',  delay: '-0.8s' },
  { left: '82%',  top: '55%', size: '3px', cls: 'pf5', dur: '9.2s',  delay: '-4.2s' },
  { left: '91%',  top: '38%', size: '4px', cls: 'pf6', dur: '7.0s',  delay: '-1.9s' },
  { left: '37%',  top: '85%', size: '3px', cls: 'pf7', dur: '5.8s',  delay: '-2.6s' },
  { left: '55%',  top: '11%', size: '3px', cls: 'pf0', dur: '6.9s',  delay: '-3.1s' },
  { left: '8%',   top: '47%', size: '4px', cls: 'pf3', dur: '7.3s',  delay: '-0.5s' },
  { left: '19%',  top: '79%', size: '3px', cls: 'pf5', dur: '8.7s',  delay: '-5.0s' },
  { left: '67%',  top: '91%', size: '4px', cls: 'pf2', dur: '6.1s',  delay: '-1.7s' },
  // doubled
  { left: '5%',   top: '28%', size: '3px', cls: 'pf1', dur: '7.1s',  delay: '-1.1s' },
  { left: '22%',  top: '44%', size: '4px', cls: 'pf4', dur: '6.5s',  delay: '-3.3s' },
  { left: '34%',  top: '13%', size: '3px', cls: 'pf6', dur: '8.3s',  delay: '-0.9s' },
  { left: '48%',  top: '67%', size: '5px', cls: 'pf2', dur: '5.9s',  delay: '-2.4s' },
  { left: '58%',  top: '42%', size: '3px', cls: 'pf0', dur: '7.6s',  delay: '-4.8s' },
  { left: '70%',  top: '8%',  size: '4px', cls: 'pf5', dur: '6.8s',  delay: '-1.5s' },
  { left: '78%',  top: '71%', size: '3px', cls: 'pf7', dur: '9.0s',  delay: '-3.0s' },
  { left: '86%',  top: '33%', size: '4px', cls: 'pf3', dur: '6.3s',  delay: '-0.3s' },
  { left: '94%',  top: '58%', size: '3px', cls: 'pf1', dur: '7.5s',  delay: '-2.9s' },
  { left: '15%',  top: '92%', size: '4px', cls: 'pf6', dur: '8.0s',  delay: '-1.2s' },
  { left: '42%',  top: '51%', size: '3px', cls: 'pf4', dur: '5.6s',  delay: '-4.5s' },
  { left: '63%',  top: '19%', size: '5px', cls: 'pf0', dur: '7.2s',  delay: '-2.0s' },
]

const LEAVES = [
  { left: '7%',   dur: '9s',  delay: '0s',    size: 7,  sway: 60,  rot: 25  },
  { left: '15%',  dur: '11s', delay: '-3s',   size: 6,  sway: 45,  rot: -15 },
  { left: '23%',  dur: '8s',  delay: '-1.5s', size: 8,  sway: 70,  rot: 40  },
  { left: '31%',  dur: '13s', delay: '-5s',   size: 5,  sway: 50,  rot: -30 },
  { left: '40%',  dur: '10s', delay: '-2s',   size: 7,  sway: 80,  rot: 20  },
  { left: '48%',  dur: '9s',  delay: '-7s',   size: 6,  sway: 40,  rot: -45 },
  { left: '55%',  dur: '12s', delay: '-1s',   size: 9,  sway: 65,  rot: 35  },
  { left: '63%',  dur: '8s',  delay: '-4s',   size: 5,  sway: 55,  rot: -20 },
  { left: '72%',  dur: '11s', delay: '-6s',   size: 7,  sway: 75,  rot: 50  },
  { left: '80%',  dur: '10s', delay: '-2.5s', size: 6,  sway: 45,  rot: -10 },
  { left: '88%',  dur: '9s',  delay: '-8s',   size: 8,  sway: 60,  rot: 30  },
  { left: '95%',  dur: '13s', delay: '-3.5s', size: 5,  sway: 50,  rot: -40 },
  { left: '3%',   dur: '10s', delay: '-9s',   size: 6,  sway: 70,  rot: 15  },
  { left: '18%',  dur: '8s',  delay: '-4.5s', size: 7,  sway: 55,  rot: -25 },
  { left: '35%',  dur: '12s', delay: '-0.5s', size: 5,  sway: 65,  rot: 45  },
  { left: '52%',  dur: '9s',  delay: '-6.5s', size: 8,  sway: 40,  rot: -35 },
  { left: '68%',  dur: '11s', delay: '-2s',   size: 6,  sway: 80,  rot: 22  },
  { left: '83%',  dur: '10s', delay: '-7.5s', size: 7,  sway: 50,  rot: -18 },
]

export default function ParticleField() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {/* Glowing particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={`p${i}`}
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

      {/* Falling emerald leaves */}
      {LEAVES.map((l, i) => (
        <span
          key={`l${i}`}
          style={{
            position: 'absolute',
            left: l.left,
            top: '-3%',
            width: l.size,
            height: l.size * 1.5,
            borderRadius: '50% 0 50% 0',
            background: 'radial-gradient(circle at 35% 35%, #a8ffcc, #3ecf80)',
            boxShadow: `0 0 ${l.size + 2}px ${Math.ceil(l.size / 2)}px rgba(62,207,128,0.55)`,
            opacity: 0,
            transform: `rotate(${l.rot}deg)`,
            animation: `leafFall ${l.dur} ease-in infinite`,
            animationDelay: l.delay,
            ['--sway' as string]: `${l.sway}px`,
          } as React.CSSProperties}
        />
      ))}

      <style>{`
        @keyframes leafFall {
          0%   { transform: translateY(0)     translateX(0)                 rotate(0deg);   opacity: 0;    }
          5%   { opacity: 0.8; }
          25%  { transform: translateY(25vh)  translateX(var(--sway))       rotate(90deg);  opacity: 0.75; }
          50%  { transform: translateY(50vh)  translateX(0)                 rotate(180deg); opacity: 0.6;  }
          75%  { transform: translateY(75vh)  translateX(calc(var(--sway) * -1)) rotate(270deg); opacity: 0.4; }
          95%  { opacity: 0.1; }
          100% { transform: translateY(103vh) translateX(0)                 rotate(360deg); opacity: 0;    }
        }
      `}</style>
    </div>
  )
}
