'use client'
import { useEffect, useRef, useState } from 'react'

const W = 220, H = 260
const CYCLE = 3400, DRAW_DONE = 1800, HOLD_END = 2700, FADE_END = 3200

interface Branch { x1: number; y1: number; x2: number; y2: number; t0: number; dur: number; lw: number }

function buildTree(): Branch[] {
  const branches: Branch[] = []

  function add(x1: number, y1: number, angleDeg: number, length: number, depth: number, lw: number, t0: number) {
    if (depth === 0 || length < 2.2) return
    const rad = angleDeg * Math.PI / 180
    const x2 = x1 + Math.cos(rad) * length
    const y2 = y1 - Math.sin(rad) * length
    const dur = Math.max(50, length * 7.8)
    branches.push({ x1, y1, x2, y2, t0, dur, lw })
    const nextT = t0 + dur * 0.80
    const spread = 22 + Math.max(0, 6 - depth) * 3.5
    const ratio = 0.66
    add(x2, y2, angleDeg + spread,         length * ratio,        depth - 1, lw * 0.70, nextT)
    add(x2, y2, angleDeg - spread,         length * ratio,        depth - 1, lw * 0.70, nextT)
    if (depth >= 5) add(x2, y2, angleDeg + spread * 0.16, length * ratio * 0.80, depth - 2, lw * 0.56, nextT)
    if (depth >= 6) add(x2, y2, angleDeg - spread * 0.20, length * ratio * 0.75, depth - 3, lw * 0.50, nextT + 30)
  }

  add(W / 2, H - 10, 90, 76, 7, 2.6, 0)
  branches.sort((a, b) => a.t0 - b.t0)
  return branches
}

function eio(t: number) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t }

export default function OpeningSplash({ onDone }: { onDone: () => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const labelRef   = useRef<HTMLDivElement>(null)
  const rafRef     = useRef<number>(0)
  const startRef   = useRef<number | null>(null)
  const loopsRef   = useRef(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const branches = buildTree()

    function render(ts: number) {
      if (!startRef.current) startRef.current = ts
      const elapsed = (ts - startRef.current) % CYCLE
      const loop    = Math.floor((ts - startRef.current) / CYCLE)

      // After 2 full loops, fade out and call onDone
      if (loop >= 2 && loopsRef.current < loop) {
        loopsRef.current = loop
        setFading(true)
        setTimeout(onDone, 700)
        return
      }

      ctx.clearRect(0, 0, W, H)

      let alpha = 1
      if (elapsed > HOLD_END) alpha = Math.max(0, 1 - (elapsed - HOLD_END) / (FADE_END - HOLD_END))

      // Label
      const lbl = labelRef.current
      if (lbl) {
        if (elapsed > DRAW_DONE * 0.75 && elapsed < HOLD_END) {
          lbl.style.opacity = '1'
          lbl.style.letterSpacing = '0.26em'
        } else {
          lbl.style.opacity = '0'
          lbl.style.letterSpacing = '0.34em'
        }
      }

      if (alpha > 0) {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.lineCap = 'round'
        ctx.shadowColor = 'rgba(62,207,128,0.55)'

        for (const b of branches) {
          if (elapsed < b.t0) continue
          const p  = eio(Math.min(1, (elapsed - b.t0) / b.dur))
          const cx = b.x1 + (b.x2 - b.x1) * p
          const cy = b.y1 + (b.y2 - b.y1) * p
          ctx.beginPath()
          ctx.moveTo(b.x1, b.y1)
          ctx.lineTo(cx, cy)
          ctx.strokeStyle = '#3ecf80'
          ctx.lineWidth   = b.lw
          ctx.shadowBlur  = b.lw > 1.4 ? 8 : 4
          ctx.stroke()
        }

        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#070d0b',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20,
      opacity: fading ? 0 : 1,
      transition: 'opacity 700ms ease',
    }}>
      <canvas ref={canvasRef} style={{ width: W, height: H }} />
      <div
        ref={labelRef}
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 8.5,
          fontWeight: 300,
          letterSpacing: '0.26em',
          color: 'rgba(127,217,174,0.42)',
          textTransform: 'uppercase',
          opacity: 0,
          transition: 'opacity 300ms, letter-spacing 500ms',
          userSelect: 'none',
        }}
      >
        Nyaaya AI
      </div>

      <button
        onClick={() => { setFading(true); setTimeout(onDone, 700) }}
        style={{
          position: 'absolute', bottom: 28, right: 28,
          padding: '7px 16px', borderRadius: 7,
          border: '1px solid rgba(127,217,174,0.3)',
          background: 'rgba(11,21,17,0.6)',
          color: 'rgba(127,217,174,0.7)',
          fontFamily: "'IBM Plex Mono', sans-serif",
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
