/** @type {import('next').NextConfig} */
const SUPABASE_ORIGIN = 'https://nrsfljvrtsnewkbufdid.supabase.co'

// One-liner CSP — spread only across strings so it stays greppable.
// - 'self' for our own assets
// - Google Fonts stylesheet + font files (used by next/font and the landing @import fallback)
// - Supabase for XHR/WebSocket (auth, functions, storage)
// - Google OAuth endpoints for the redirect flow
// - unsafe-inline on style-src because Next 14 emits inline <style> tags for CSS-in-JS
//   and next/font; removing this needs nonces which are gated on Next 15+.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  `connect-src 'self' ${SUPABASE_ORIGIN} wss://${new URL(SUPABASE_ORIGIN).host} https://accounts.google.com`,
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
