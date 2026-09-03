'use client'
import { useMemo } from 'react'

interface Leaf {
  id: number
  size: number
  left: number
  opacity: number
  duration: number
  delay: number
  drift: number
  rot: number
}

export default function OnboardingBackground() {
  const leaves = useMemo<Leaf[]>(() => {
    return Array.from({ length: 22 }, (_, i) => ({
      id: i,
      size: 14 + Math.random() * 12,           // 14–26
      left: Math.random() * 100,               // 0–100%
      opacity: 0.25 + Math.random() * 0.35,    // 0.25–0.60
      duration: 14 + Math.random() * 10,       // 14–24s
      delay: -(Math.random() * 20),            // 0 to -20s
      drift: -100 + Math.random() * 200,       // ±100px
      rot: 180 + Math.random() * 360,          // 180–540deg
    }))
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 900px 600px at 50% 0%, #10241c 0%, #0b1512 55%, #070d0b 100%)',
        backgroundColor: '#0b1512',
      }}
    >
      {/* SVG filter for gooey reveal — referenced by text animations */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="gooeyReveal">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140" />
          </filter>
        </defs>
      </svg>

      {/* Tree watermark */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', opacity: 0.5 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tree-logo-full.png"
          alt=""
          style={{
            width: 'min(70vw, 900px)',
            opacity: 0.35,
            filter: 'drop-shadow(0 0 60px #1b4a34)',
            objectFit: 'contain',
            objectPosition: 'center 38%',
          }}
        />
      </div>

      {/* Radial glow washes */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 700px 500px at 20% 15%, rgba(90,154,118,0.10), transparent 60%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 700px 500px at 80% 85%, rgba(90,154,118,0.08), transparent 60%)',
      }} />

      {/* Drifting leaves */}
      {leaves.map(leaf => (
        <div
          key={leaf.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${leaf.left}%`,
            width: leaf.size,
            height: leaf.size,
            opacity: leaf.opacity,
            animation: `leafDrift ${leaf.duration}s linear ${leaf.delay}s infinite`,
            // CSS custom properties used in the keyframe
            ['--leaf-drift' as string]: `${leaf.drift}px`,
            ['--leaf-rot' as string]: `${leaf.rot}deg`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="#5a9a76" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 1.25-13.5 3.25C4.5 8.25 3.5 12 3.5 12S6 8 17 8z" />
          </svg>
        </div>
      ))}
    </div>
  )
}
