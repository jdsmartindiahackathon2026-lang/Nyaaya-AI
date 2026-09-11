import type { Metadata } from 'next'
import './globals.css'
// eslint-disable-next-line @next/next/no-page-custom-font
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google'

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-serif' })

export const metadata: Metadata = {
  title: {
    default: 'Nyaaya AI — IP-SAKTI | Ayurvedic IP, Patents & ABS Intelligence',
    template: '%s | Nyaaya AI — IP-SAKTI',
  },
  description: 'AI-powered legal intelligence platform for Ayurveda, traditional knowledge (TKDL), Biological Diversity Act (ABS) compliance, and patent classification.',
  keywords: [
    'Nyaaya AI',
    'IP-SAKTI',
    'Ayurveda IP',
    'TKDL',
    'Traditional Knowledge Digital Library',
    'Biological Diversity Act',
    'Access and Benefit Sharing',
    'Indian Patent Office',
    'WIPO GRATK',
    'Section 3p Patents Act',
  ],
  authors: [{ name: 'Nyaaya AI Team' }],
  creator: 'Nyaaya AI',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Nyaaya AI — IP-SAKTI',
    title: 'Nyaaya AI — IP-SAKTI | Ayurvedic IP, Patents & ABS Intelligence',
    description: 'AI-powered legal intelligence platform for Ayurveda, traditional knowledge (TKDL), Biological Diversity Act (ABS) compliance, and patent classification.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nyaaya AI — IP-SAKTI',
    description: 'AI-powered legal intelligence platform for Ayurveda, traditional knowledge (TKDL), Biological Diversity Act (ABS) compliance, and patent classification.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontClasses = `${ibmPlexSans.variable} ${ibmPlexMono.variable} ${sourceSerif.variable}`
  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  )
}
