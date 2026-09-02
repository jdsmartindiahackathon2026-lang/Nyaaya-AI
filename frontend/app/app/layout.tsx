'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import LeftSidebar from '../../components/LeftSidebar'
import RightSidebar from '../../components/RightSidebar'
import AppHeader from '../../components/AppHeader'
import MiniGuide from '../../components/MiniGuide'
import ParticleField from '../../components/ParticleField'
import OpeningSplash from '../../components/OpeningSplash'

const SIDEBAR_W = 310

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mode = pathname.split('/').pop() ?? 'ask'

  const [splashDone, setSplashDone] = useState(false)
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

  return (
    <>
    {!splashDone && <OpeningSplash onDone={() => setSplashDone(true)} />}
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
    </>
  )
}
