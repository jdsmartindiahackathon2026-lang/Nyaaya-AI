import type { Metadata } from 'next'
import './globals.css'
// eslint-disable-next-line @next/next/no-page-custom-font
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google'

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-serif' })

export const metadata: Metadata = {
  title: 'Nyaaya AI — IP-SAKTI',
  description: 'AI-powered Ayurveda IP and regulatory guidance'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontClasses = `${ibmPlexSans.variable} ${ibmPlexMono.variable} ${sourceSerif.variable}`
  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  )
}
