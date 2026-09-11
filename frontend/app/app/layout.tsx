'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import LeftSidebar from '../../components/LeftSidebar'
import RightSidebar from '../../components/RightSidebar'
import AppHeader from '../../components/AppHeader'
import MiniGuide from '../../components/MiniGuide'
import ParticleField from '../../components/ParticleField'
import { supabase } from '../../lib/supabase'
import { WorkspaceProvider } from '../../lib/workspaceContext'

const SIDEBAR_W = 310

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const mode = pathname.split('/').pop() ?? 'ask'

  // Dynamic route-specific SEO titles and meta descriptions
  useEffect(() => {
    const routeMeta: Record<string, { title: string; desc: string }> = {
      ask: {
        title: 'Statutory IP Guidance | Nyaaya AI — IP-SAKTI',
        desc: 'Consult Nyaaya AI on the Patents Act, Biological Diversity Act, and WIPO treaties for Ayurvedic and traditional formulations.',
      },
      classify: {
        title: 'Formulation Classifier | Nyaaya AI — IP-SAKTI',
        desc: 'Classify your Ayurvedic product across Patents, Trade Secrets, GI, and ASU regulatory regimes with actionable next steps.',
      },
      tkdl: {
        title: 'TKDL Prior Art Search | Nyaaya AI — IP-SAKTI',
        desc: 'Cross-reference traditional herbal formulations and formulations against the Traditional Knowledge Digital Library prior art citations.',
      },
      abs: {
        title: 'ABS Compliance Wizard | Nyaaya AI — IP-SAKTI',
        desc: 'Navigate Access and Benefit Sharing obligations under India’s Biological Diversity Act for wild-harvested herbs and medicinal plants.',
      },
      escalate: {
        title: 'Legal Escalation & Attorney Support | Nyaaya AI — IP-SAKTI',
        desc: 'Escalate complex Ayurvedic IP, patent prosecution, or ABS disputes directly to specialized IP attorneys and regulatory counsel.',
      },
      profile: {
        title: 'Workspace Profile & Settings | Nyaaya AI — IP-SAKTI',
        desc: 'Manage your personal profile, organization workspaces, team members, and enterprise preferences on Nyaaya AI.',
      },
    }

    const current = routeMeta[mode] || {
      title: 'Nyaaya AI — IP-SAKTI | Dashboard',
      desc: 'AI-powered legal intelligence platform for Ayurveda, TKDL, and Biological Diversity Act compliance.',
    }

    document.title = current.title

    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    metaDesc.setAttribute('content', current.desc)
  }, [mode])

  const [authChecked, setAuthChecked] = useState(false)
  const [language, setLanguage] = useState('en')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [userType, setUserType] = useState('startup')

  useEffect(() => {
    try {
      setLanguage(localStorage.getItem('nyaaya_language') ?? 'en')
      setUserType(localStorage.getItem('nyaaya_userType') ?? 'startup')
      setJurisdiction(localStorage.getItem('nyaaya_jurisdiction') ?? 'india')
    } catch {}
  }, [])

  // Auth gate: if no session, bounce to /login
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) { router.replace('/login'); return }
      setAuthChecked(true)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [router])

  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#060b0a', color: '#b7d4c5',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14,
      }}>Loading…</div>
    )
  }

  return (
    <WorkspaceProvider>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse 900px 600px at 50% 0%, #10241c 0%, #0b1512 55%, #070d0b 100%)',
        overflow: 'hidden',
      }}>
        {/* Yggdrasil tree — center panel only, preserves the correct crop */}
        <img
          src="/yggdrasil-tree.png"
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: SIDEBAR_W,
            right: SIDEBAR_W,
            width: `calc(100% - ${SIDEBAR_W * 2}px)`,
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 38%',
            opacity: 0.58,
            userSelect: 'none',
            pointerEvents: 'none',
            filter: 'saturate(1.6) brightness(1.15)',
            maskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
            zIndex: 0,
          }}
        />

        <ParticleField />

        {/* Left sidebar — fixed */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: SIDEBAR_W,
          borderRight: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(11,21,17,0.6) 0%, rgba(7,13,11,0.8) 100%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <LeftSidebar language={language} onLanguageChange={lang => {
            setLanguage(lang)
            try { localStorage.setItem('nyaaya_language', lang) } catch {}
          }} />
        </div>

        {/* Center — scrollable content */}
        <main style={{
          position: 'absolute',
          left: SIDEBAR_W,
          right: SIDEBAR_W,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <AppHeader
            mode={mode}
            jurisdiction={jurisdiction}
            onJurisdictionChange={jur => {
              setJurisdiction(jur)
              try { localStorage.setItem('nyaaya_jurisdiction', jur) } catch {}
            }}
          />
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {children}
          </div>
        </main>

        {/* Right sidebar — fixed */}
        <div style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: SIDEBAR_W,
          borderLeft: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(11,21,17,0.6) 0%, rgba(7,13,11,0.8) 100%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <RightSidebar userType={userType} jurisdiction={jurisdiction} />
        </div>

        <MiniGuide currentScreen={mode} language={language} />
      </div>
    </WorkspaceProvider>
  )
}
