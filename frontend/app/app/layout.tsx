'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import LeftSidebar from '../../components/LeftSidebar'
import RightSidebar from '../../components/RightSidebar'
import AppHeader from '../../components/AppHeader'
import MiniGuide from '../../components/MiniGuide'
import ParticleField from '../../components/ParticleField'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mode = pathname.split('/').pop() ?? 'ask'

  const [language, setLanguage] = useState('en')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [userType, setUserType] = useState('startup')

  // Read onboarding data from localStorage
  useEffect(() => {
    try {
      const lang = localStorage.getItem('temp_language') ?? localStorage.getItem('nyaaya_language') ?? 'en'
      const type = localStorage.getItem('nyaaya_userType') ?? 'startup'
      const jur  = localStorage.getItem('nyaaya_jurisdiction') ?? 'india'
      setLanguage(lang)
      setUserType(type)
      setJurisdiction(jur)
    } catch {}
  }, [])

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      minHeight: 740,
      background: 'radial-gradient(ellipse 900px 600px at 50% 0%, #10241c 0%, #0b1512 55%, #070d0b 100%)',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '220px 1fr 220px',
      gridTemplateRows: '1fr',
    }}>
      {/* Background particles */}
      <ParticleField />

      {/* Left panel */}
      <LeftSidebar language={language} onLanguageChange={lang => {
        setLanguage(lang)
        try { localStorage.setItem('nyaaya_language', lang) } catch {}
      }} />

      {/* Main content */}
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
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

      {/* Right panel */}
      <RightSidebar userType={userType} jurisdiction={jurisdiction} />

      {/* Mini Guide floating widget */}
      <MiniGuide currentScreen={mode} language={language} />
    </div>
  )
}
