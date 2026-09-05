'use client'
import { useState, useEffect, useRef, useMemo } from 'react'

interface Leaf {
  size: number; left: string; opacity: string; duration: string; delay: string; dx: string; rot: string;
}
interface Firefly {
  left: string; top: string; size: string; duration: string; flickerDuration: string; delay: string;
  fx: string; fy: string; fx2: string; fy2: string;
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  const [progress, setProgress] = useState(0)
  const [mx, setMx] = useState(0)
  const [my, setMy] = useState(0)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const elsRef = useRef<Record<string, HTMLElement | null>>({})

  const leaves = useMemo<Leaf[]>(() => Array.from({ length: 45 }, () => ({
    size: 12 + Math.round(Math.random() * 10),
    left: Math.round(Math.random() * 100) + '%',
    opacity: (0.18 + Math.random() * 0.25).toFixed(2),
    duration: (16 + Math.random() * 10).toFixed(1) + 's',
    delay: (-Math.random() * 20).toFixed(1) + 's',
    dx: Math.round((Math.random() - 0.5) * 200) + 'px',
    rot: Math.round(180 + Math.random() * 360) + 'deg',
  })), [])

  const fireflies = useMemo<Firefly[]>(() => Array.from({ length: 55 }, () => ({
    left: Math.round(Math.random() * 100) + '%',
    top: Math.round(Math.random() * 100) + '%',
    size: (3 + Math.random() * 3).toFixed(1) + 'px',
    duration: (8 + Math.random() * 6).toFixed(1) + 's',
    flickerDuration: (1.5 + Math.random() * 2).toFixed(1) + 's',
    delay: (-Math.random() * 12).toFixed(1) + 's',
    fx: Math.round((Math.random() - 0.5) * 120) + 'px',
    fy: Math.round((Math.random() - 0.5) * 120) + 'px',
    fx2: Math.round((Math.random() - 0.5) * 160) + 'px',
    fy2: Math.round((Math.random() - 0.5) * 160) + 'px',
  })), [])

  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY || window.pageYOffset || 0
      const doc = document.documentElement
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight)
      const prog = Math.min(1, Math.max(0, sy / maxScroll))
      const vh = window.innerHeight || 800
      const toReveal: Record<string, boolean> = {}
      let changed = false
      Object.keys(elsRef.current).forEach(id => {
        if (revealed[id]) return
        const el = elsRef.current[id]
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.top < vh * 0.85 && rect.bottom > 0) { toReveal[id] = true; changed = true }
      })
      setScrollY(sy)
      setProgress(prog)
      if (changed) setRevealed(prev => ({ ...prev, ...toReveal }))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    setTimeout(onScroll, 50)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  const reg = (id: string) => (el: HTMLElement | null) => { elsRef.current[id] = el }

  const rev = (id: string) => !!revealed[id]
  const gooey = (id: string, delayMs: number) =>
    rev(id) ? `gooeyIn 600ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms both` : 'none'
  const capAnim = (i: number) =>
    rev('capabilities') ? `cardZoomInLand 650ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms both` : 'none'

  const treeOffsetPx = Math.min(scrollY * 0.22, 380)

  const corpusListAll = [
    'Patents Act 1970', 'Trade Marks Act 1999', 'Copyright Act 1957', 'Designs Act 2000',
    'Geographical Indications Act 1999', 'Biological Diversity Act 2002', 'Biological Diversity Rules 2004',
    'Scheduled Tribes and Other Traditional Forest Dwellers Act 2006', 'Wild Life Protection Act 1972',
    'Indian Forest Act 1927', 'Drugs and Cosmetics Act 1940', 'Phytopharmaceutical Rules 2015',
    'Food Safety and Standards Act 2006', 'Drugs and Magic Remedies Act 1954', 'Pharmacy Act 1948',
    'Consumer Protection Act 2019', 'Legal Metrology Act 2009',
    "Protection of Plant Varieties and Farmers' Rights Act 2001", 'TRIPS Agreement',
  ]

  const stats = [
    { value: '7,438', label: 'per-clause chunks' },
    { value: '19', label: 'Indian & international sources' },
    { value: '384-dim', label: 'local bge-small-en-v1.5 embeddings' },
    { value: 'HNSW', label: 'pgvector, cosine ≥ 0.65 threshold' },
  ]

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    setMx(nx); setMy(ny)
  }

  return (
    <>
      <style>{`
        html { scroll-behavior: smooth; }
        html, body { margin: 0; padding: 0; background: #070d0b; }
        a { color: #5ac9a8; text-decoration: none; }
        a:hover { color: #86e0bd; }
        ::selection { background: #1c4a37; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>

      <div style={{ position: 'relative', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: '#eaf3ee', background: '#070d0b', overflowX: 'hidden' }}>

        {/* Scroll progress rail */}
        <div style={{ position: 'fixed', left: 0, top: 0, width: 3, height: '100vh', zIndex: 60, background: 'rgba(90,201,168,0.1)', pointerEvents: 'none' }}>
          <div style={{ width: '100%', background: 'linear-gradient(180deg,#5ac9a8,#5ff0c4)', height: `${(progress * 100).toFixed(1)}%`, boxShadow: '0 0 8px rgba(95,240,196,0.6)' }} />
        </div>

        {/* Nav */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 48px', background: 'rgba(6,12,10,0.72)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(90,201,168,0.14)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="2.6" fill="#7fd9ae" style={{ filter: 'drop-shadow(0 0 6px #7fd9ae)' }} />
              <path d="M10 12.6 L10 19 M10 7.4 L4.5 2.5 M10 7.4 L15.5 2.5 M6.8 9 L1.3 8.5 M13.2 9 L18.7 8.5" stroke="#4f8f70" strokeWidth="1.1" fill="none" />
            </svg>
            <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, fontWeight: 700, color: '#f2f6f3' }}>IP-SAKTI</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6f9683', marginLeft: 2, paddingLeft: 10, borderLeft: '1px solid rgba(90,201,168,0.25)' }}>Nyaaya AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 14 }}>
            <a href="#product" style={{ color: '#cfe0d5' }}>Product</a>
            <a href="#corpus" style={{ color: '#cfe0d5' }}>Corpus</a>
            <a href="/login" style={{ color: '#5ac9a8', fontWeight: 500, padding: '8px 16px', border: '1px solid rgba(90,201,168,0.35)', borderRadius: 999 }}>Sign in</a>
          </div>
        </nav>

        {/* Parallax + hero container */}
        <div onMouseMove={handleMouseMove} style={{ position: 'relative' }}>

          {/* Tree background */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -450, left: 0, right: 0, height: 'calc(100% + 900px)', transform: `translate3d(${mx * 10}px, ${treeOffsetPx}px, 0)`, willChange: 'transform' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/yggdrasil-hero.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 32%', filter: 'brightness(1.1) saturate(1.25)', animation: 'bgBreathe 30s ease-in-out infinite' }} />
            </div>
          </div>
          {/* Dark gradient overlay */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(5,10,9,0.42) 0%,rgba(5,10,9,0.38) 30%,rgba(6,12,10,0.62) 55%,rgba(7,13,11,0.86) 78%,#0a1613 100%)' }} />
          {/* Radial aura */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100vh', zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse 55% 45% at 50% 30%,rgba(95,240,196,0.18),transparent 70%)', animation: 'treeAura 6s ease-in-out infinite' }} />

          {/* Leaf particles */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, transform: `translate(${mx * -20}px,${my * -20}px)`, transition: 'transform 400ms ease-out' }}>
            {mounted && leaves.map((leaf, i) => (
              <svg key={i} width={leaf.size} height={leaf.size} viewBox="0 0 24 24" style={{ position: 'absolute', left: leaf.left, top: -40, opacity: parseFloat(leaf.opacity), animation: `leafDrift ${leaf.duration} linear ${leaf.delay} infinite`, ['--dx' as string]: leaf.dx, ['--rot' as string]: leaf.rot }}>
                <path d="M12 2C7 6 3 10 3 15a9 9 0 0 0 9 7 9 9 0 0 0 9-7c0-5-4-9-9-13z" fill="#4fd6b5" />
              </svg>
            ))}
          </div>
          {/* Firefly particles */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, transform: `translate(${mx * -32}px,${my * -32}px)`, transition: 'transform 400ms ease-out' }}>
            {mounted && fireflies.map((fly, i) => (
              <div key={i} style={{ position: 'absolute', left: fly.left, top: fly.top, width: fly.size, height: fly.size, borderRadius: '50%', background: '#a6f5db', boxShadow: '0 0 8px 2px rgba(166,245,219,0.85)', animation: `fireflyDrift ${fly.duration} ease-in-out ${fly.delay} infinite, flicker ${fly.flickerDuration} ease-in-out ${fly.delay} infinite`, ['--fx' as string]: fly.fx, ['--fy' as string]: fly.fy, ['--fx2' as string]: fly.fx2, ['--fy2' as string]: fly.fy2 }} />
            ))}
          </div>

          {/* Hero */}
          <section id="hero" style={{ position: 'relative', zIndex: 4, minHeight: '92vh', display: 'flex', alignItems: 'center', padding: '0 48px' }}>
            <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 26, margin: '0 auto', animation: 'riseIn 600ms cubic-bezier(0.22,1,0.36,1) both' }}>
              <h1 style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: 58, lineHeight: 1.08, letterSpacing: '-0.01em', color: '#f5f8f6', textShadow: '0 2px 30px rgba(0,0,0,0.55)' }}>The statute knows your formulation.</h1>
              <p style={{ margin: 0, fontSize: 20, lineHeight: 1.55, color: '#cfe0d5', textShadow: '0 1px 14px rgba(0,0,0,0.5)', maxWidth: 620 }}>AI legal guidance for India&rsquo;s Ayurveda industry &mdash; grounded in <strong style={{ color: '#f2f6f3' }}>7,438 clauses across 19 acts</strong>, cited to the exact section, with a human escalation path when the citation isn&rsquo;t enough.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 6 }}>
                <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 30px', borderRadius: 999, background: '#5ac9a8', color: '#06120f', fontWeight: 600, fontSize: 15, boxShadow: '0 0 30px rgba(90,201,168,0.35)' }}>Enter the app</a>
                <a href="#demo" onClick={(e) => { e.preventDefault(); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }) }} style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 26px', borderRadius: 999, border: '1px solid rgba(234,243,238,0.3)', color: '#eaf3ee', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>See it work</a>
              </div>
              <div style={{ marginTop: 34, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6f9683' }}>SIH 2026 &middot; Problem Statement SIH26045 &middot; Team Palimpsest &middot; NSEC</div>
            </div>
          </section>

          {/* Problem */}
          <section ref={reg('problem')} style={{ position: 'relative', zIndex: 4, padding: '160px 48px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 34, opacity: rev('problem') ? 1 : 0, animation: gooey('problem', 0) }}>
              <p style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 21, lineHeight: 1.75, color: '#d7e6dd' }}>An Ayurveda formulator files a patent and doesn&rsquo;t know their base recipe is already in <strong style={{ color: '#c9a227' }}>TKDL</strong> &mdash; the application is refused under Section 3(p).</p>
              <p style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 21, lineHeight: 1.75, color: '#d7e6dd' }}>A startup exports an ashwagandha extract and doesn&rsquo;t file <strong style={{ color: '#c9a227' }}>Form III</strong> under BD Rules 2004 &mdash; the shipment is held, the FTO is at risk.</p>
              <p style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 21, lineHeight: 1.75, color: '#d7e6dd' }}>A traditional healer&rsquo;s clinic labels a churna as a food and misses <strong style={{ color: '#c9a227' }}>FSSAI Ayurveda-Aahara 2022</strong> &mdash; the batch is recalled.</p>
              <p style={{ margin: '24px 0 0', fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: 25, lineHeight: 1.4, color: '#f2f6f3', textAlign: 'center' }}>Every one of these is a statute away from being avoided.</p>
            </div>
          </section>

          {/* Capabilities */}
          <section id="product" style={{ position: 'relative', zIndex: 4, padding: '160px 48px 180px' }}>
            <div ref={reg('capabilities')} style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 56 }}>
              <h2 style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 34, fontWeight: 700, color: '#f2f6f3', textAlign: 'center', opacity: rev('capabilities') ? 1 : 0, animation: gooey('capabilities', 0) }}>What it does</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center' }}>
                {[
                  {
                    icon: <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="3" fill="#7fd9ae" /><path d="M20 23 L20 34 M20 17 L11 8 M20 17 L29 8 M14 19 L4 18 M26 19 L36 18" stroke="#4f8f70" strokeWidth="1.4" fill="none" /><circle cx="11" cy="8" r="2" fill="#5ac9a8" /><circle cx="29" cy="8" r="2" fill="#5ac9a8" /></svg>,
                    title: 'Ask', what: 'Grounded Q&A over 19 acts, with live fallback.', how: 'Hybrid RAG + Perplexity Sonar fallback. Deep-linked citations to the exact clause.',
                  },
                  {
                    icon: <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="30" r="3" fill="#7fd9ae" /><path d="M20 27 L20 20 M20 20 L10 12 M20 20 L20 8 M20 20 L30 12" stroke="#4f8f70" strokeWidth="1.4" fill="none" /><circle cx="10" cy="12" r="2" fill="#5ac9a8" /><circle cx="20" cy="8" r="2" fill="#5ac9a8" /><circle cx="30" cy="12" r="2" fill="#5ac9a8" /></svg>,
                    title: 'Classify Formulation', what: 'Find your regulatory regime in three steps.', how: 'Name, innovation type, TK flag → D&C Act §33N, Phytopharma Rules 2015, or dietary supplement.',
                  },
                  {
                    icon: <svg width="40" height="40" viewBox="0 0 40 40"><path d="M20 30 L20 22 M20 22 L12 14 M20 22 L28 14" stroke="#4f8f70" strokeWidth="1.4" fill="none" /><circle cx="16" cy="13" r="6" fill="none" stroke="#5ac9a8" strokeWidth="1.6" /><path d="M20.2 17.2 L24.5 21.5" stroke="#5ac9a8" strokeWidth="1.8" strokeLinecap="round" /><circle cx="20" cy="30" r="3" fill="#7fd9ae" /></svg>,
                    title: 'TKDL Prior Art Search', what: 'Check if your formulation is already documented.', how: 'Queries the Traditional Knowledge Digital Library. Status: documented / partial / not_found.',
                  },
                  {
                    icon: <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="30" r="3" fill="#7fd9ae" /><path d="M20 27 L20 18 M20 18 L11 10 M20 18 L29 10" stroke="#4f8f70" strokeWidth="1.4" fill="none" /><path d="M7 9 L10.5 12.5 L16 6" stroke="#5ac9a8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="29" cy="10" r="2" fill="#5ac9a8" /></svg>,
                    title: 'ABS Compliance Wizard', what: 'Work out your biodiversity obligations.', how: 'Branching interview under BD Act 2002 + BD Rules 2004. Emits a downloadable memo.',
                  },
                  {
                    icon: <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="12" cy="24" r="4" fill="none" stroke="#5ac9a8" strokeWidth="1.6" /><circle cx="28" cy="14" r="4" fill="none" stroke="#7fd9ae" strokeWidth="1.6" /><path d="M15.5 21.5 L24.5 16.5" stroke="#4f8f70" strokeWidth="1.4" strokeDasharray="3 3" /></svg>,
                    title: 'Escalate to Human', what: "Hand off when the model can’t sign off.", how: 'Full session summary sent to a facilitator for binding advice.',
                  },
                ].map((card, i) => (
                  <div key={i} style={{ flex: '1 1 320px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14, padding: 26, borderRadius: 14, border: '1px solid rgba(90,201,168,0.22)', background: 'rgba(9,18,15,0.72)', backdropFilter: 'blur(6px)', opacity: rev('capabilities') ? 1 : 0, animation: capAnim(i) }}>
                    {card.icon}
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 17, fontWeight: 600, color: '#f2f6f3' }}>{card.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: '#cfe0d5' }}>{card.what}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.6, color: '#7fb0a0' }}>{card.how}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Corpus */}
        <section id="corpus" style={{ padding: '140px 48px', background: '#0a1613' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 52 }}>
            <div ref={reg('corpus')} style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center', opacity: rev('corpus') ? 1 : 0, animation: gooey('corpus', 0) }}>
              <h2 style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 34, fontWeight: 700, color: '#f2f6f3' }}>Built on primary sources, not summaries.</h2>
              <p style={{ margin: 0, fontSize: 15, color: '#7fb0a0' }}>Every answer traces back to a real clause, in a real act.</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
              {stats.map((st, i) => (
                <div key={i} style={{ flex: '1 1 200px', maxWidth: 230, padding: 24, borderRadius: 12, border: '1px solid rgba(90,201,168,0.18)', background: 'rgba(9,18,15,0.6)', textAlign: 'center', opacity: rev('corpus') ? 1 : 0, animation: gooey('corpus', i * 70) }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 30, fontWeight: 600, color: '#5ff0c4' }}>{st.value}</div>
                  <div style={{ marginTop: 8, fontSize: 12.5, color: '#9fc2b0', lineHeight: 1.5 }}>{st.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6f9683' }}>The corpus, in full</div>
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px 24px', padding: 20, borderRadius: 12, border: '1px solid rgba(90,201,168,0.14)', background: 'rgba(9,18,15,0.4)' }}>
                {corpusListAll.map((act, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#cfe0d5', padding: '5px 0', borderBottom: '1px solid rgba(90,201,168,0.08)', opacity: rev('corpus') ? 1 : 0, animation: gooey('corpus', 200 + i * 30) }}>
                    <span style={{ color: '#4f8f70' }}>&bull;</span>{act}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 10, padding: '22px 26px', borderRadius: 10, border: '1px dashed rgba(201,162,39,0.35)', background: 'rgba(9,18,15,0.6)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#b7d4c5', minWidth: 380, opacity: rev('corpus') ? 1 : 0, animation: gooey('corpus', 200 + corpusListAll.length * 30 + 150) }}>
              <div style={{ color: '#6f9683' }}>query &gt; <span style={{ color: '#eaf3ee' }}>&ldquo;Fee/form for accessing biological resources&rdquo;</span></div>
              <div style={{ color: '#6f9683' }}>top hit &gt; <span style={{ color: '#eaf3ee' }}>bd-rules-2004 &sect;14</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, paddingTop: 10, borderTop: '1px solid rgba(90,201,168,0.15)' }}>
                <span style={{ color: '#6f9683' }}>cosine</span><span style={{ color: '#c9a227', fontWeight: 600 }}>0.836</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: '0.1em', color: '#c9a227', border: '1px solid rgba(201,162,39,0.4)', padding: '2px 8px', borderRadius: 4 }}>MATCH</span>
              </div>
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" style={{ padding: '140px 48px', background: '#070d0b', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 620, width: '100%', display: 'flex', flexDirection: 'column', gap: 28, alignItems: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6f9683' }}>See it work</div>
            <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(90,201,168,0.2)', background: 'rgba(9,18,15,0.75)', boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', background: 'rgba(14,26,21,0.8)', borderBottom: '1px solid rgba(90,201,168,0.14)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e2836a', display: 'inline-block' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d9b25a', display: 'inline-block' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#5ac9a8', display: 'inline-block' }} />
                <span style={{ marginLeft: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6f9683' }}>ask &mdash; IP-SAKTI Sahayak</span>
              </div>
              <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 20, minHeight: 220 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: '#eaf3ee', whiteSpace: 'nowrap', overflow: 'hidden', width: '58ch', borderRight: '2px solid #5ac9a8', animation: 'demoType58 9s ease-in-out infinite, cursorBlink 0.8s step-end infinite' }}>Can I patent a classical ashwagandha rasayana formulation?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', animation: 'demoPills 9s ease-in-out infinite' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#c9a227', border: '1px solid rgba(201,162,39,0.4)', padding: '4px 10px', borderRadius: 999 }}>Patents Act 1970 &sect;3(p)</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#c9a227', border: '1px solid rgba(201,162,39,0.4)', padding: '4px 10px', borderRadius: 999 }}>Patents Act 1970 &sect;25(1)(k)</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#c9a227', border: '1px solid rgba(201,162,39,0.4)', padding: '4px 10px', borderRadius: 999 }}>BD Act 2002 &sect;6</span>
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#cfe0d5', animation: 'demoAnswer 9s ease-in-out infinite' }}>
                  No &mdash; Section 3(p) of the Patents Act 1970 excludes an invention which is in effect traditional knowledge or an aggregation of known properties of traditionally known component(s)&hellip;
                  <span style={{ display: 'inline-block', marginTop: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', color: '#5ac9a8', border: '1px solid rgba(90,201,168,0.35)', padding: '3px 9px', borderRadius: 4 }}>CONFIDENCE: HIGH</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section ref={reg('trust')} style={{ padding: '120px 48px', background: '#0a1613' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 40 }}>
            {[
              { label: 'Privacy', color: '#5ac9a8', text: 'Anonymous auth by default. Nothing leaves your browser until you save. RLS-scoped by user.' },
              { label: 'Grounding', color: '#5ac9a8', text: 'Every answer carries statute anchors. The model is instructed to emit CONFIDENCE: HIGH | MEDIUM | ABSTAIN.' },
              { label: 'Not legal advice', color: '#d9a441', text: 'IP-SAKTI is decision-support. Escalate binds you to a facilitator; final counsel comes from a human.' },
            ].map((item, i) => (
              <div key={i} style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10, opacity: rev('trust') ? 1 : 0, animation: gooey('trust', i * 80) }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: item.color }}>{item.label}</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#9fc2b0' }}>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer id="footer" style={{ padding: '56px 48px 40px', background: '#070d0b', borderTop: '1px solid rgba(90,201,168,0.14)', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto', width: '100%', display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="2.6" fill="#7fd9ae" />
                  <path d="M10 12.6 L10 19 M10 7.4 L4.5 2.5 M10 7.4 L15.5 2.5 M6.8 9 L1.3 8.5 M13.2 9 L18.7 8.5" stroke="#4f8f70" strokeWidth="1.1" fill="none" />
                </svg>
                <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 15, fontWeight: 700, color: '#f2f6f3' }}>IP-SAKTI</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#6f9683' }}>AI legal &amp; regulatory guidance for India&rsquo;s Ayurveda industry.</div>
            </div>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <a href="#product" style={{ color: '#9fc2b0' }}>Product</a>
                <a href="#corpus" style={{ color: '#9fc2b0' }}>Corpus</a>
                <a href="#demo" style={{ color: '#9fc2b0' }}>Demo</a>
                <a href="/login" style={{ color: '#9fc2b0' }}>Sign in</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <a href="https://github.com/jdsmartindiahackathon2026-lang/Nyaaya-AI" target="_blank" rel="noopener noreferrer" style={{ color: '#9fc2b0' }}>GitHub</a>
                <a href="https://github.com/jdsmartindiahackathon2026-lang/Nyaaya-AI/issues/new" target="_blank" rel="noopener noreferrer" style={{ color: '#9fc2b0' }}>Contact</a>
              </div>
            </div>
          </div>
          <div style={{ maxWidth: 1160, margin: '0 auto', width: '100%', paddingTop: 20, borderTop: '1px solid rgba(90,201,168,0.1)', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#55766a' }}>
            <span>Built by Team Palimpsest &middot; Smart India Hackathon 2026 &middot; SIH26045 &middot; NSEC</span>
            <span>&copy; 2026 Team Palimpsest &middot; Made in India</span>
          </div>
        </footer>

      </div>
    </>
  )
}
