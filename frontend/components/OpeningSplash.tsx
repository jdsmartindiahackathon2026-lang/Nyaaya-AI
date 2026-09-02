'use client'
import { useEffect, useRef, useState } from 'react'

export default function OpeningSplash({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const finish = () => {
      setFading(true)
      setTimeout(onDone, 700)
    }
    v.addEventListener('ended', finish)
    // Safety fallback — skip if video fails to load
    v.addEventListener('error', finish)
    return () => { v.removeEventListener('ended', finish); v.removeEventListener('error', finish) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#070d0b',
      opacity: fading ? 0 : 1,
      transition: 'opacity 700ms ease',
      overflow: 'hidden',
    }}>
      {/* Scale up ~9% and nudge left to crop Gemini watermark at bottom-right */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          objectFit: 'contain',
          background: '#070d0b',
        }}
      >
        <source src="/opening.mp4" type="video/mp4" />
      </video>

      {/* Bottom gradient — covers watermark and looks cinematic */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '30%',
        background: 'linear-gradient(to bottom, transparent, #070d0b 60%)',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* Skip button */}
      <button
        onClick={() => { setFading(true); setTimeout(onDone, 700) }}
        style={{
          position: 'absolute', bottom: 28, right: 28,
          padding: '7px 16px', borderRadius: 7,
          border: '1px solid rgba(127,217,174,0.3)',
          background: 'rgba(11,21,17,0.6)',
          color: 'rgba(127,217,174,0.7)',
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 12, cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          transition: 'border-color 150ms, color 150ms',
        }}
      >
        Skip →
      </button>
    </div>
  )
}
