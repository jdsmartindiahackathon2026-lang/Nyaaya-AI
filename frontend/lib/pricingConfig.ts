/**
 * Canonical pricing, tier quotas, and feature matrix configurations for Nyaaya AI.
 * Single source of truth across the frontend marketing pages, in-app billing modals,
 * and quota checks.
 */

export type BillingTier = 'free' | 'starter' | 'pro' | 'enterprise'
export type BillingInterval = 'monthly' | 'annual'

export interface TierFeature {
  text: string
  highlight?: boolean
}

export interface TierConfig {
  id: BillingTier
  name: string
  badge?: string
  description: string
  monthlyPriceINR: number
  annualPriceINR: number // billed annually
  seats: number | 'Unlimited'
  quotas: {
    askQueriesPerMonth: number | 'Unlimited'
    tkdlSearchesPerMonth: number | 'Unlimited'
    formulationsPerMonth: number | 'Unlimited'
  }
  features: TierFeature[]
  pdfWatermarked: boolean
  exemptFromDeviceCaps: boolean
  ctaLabel: string
  ctaHref?: string
  popular?: boolean
}

export const PRICING_TIERS: Record<BillingTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Community',
    description: 'For solo vaidyas, independent researchers, and students exploring AYUSH compliance.',
    monthlyPriceINR: 0,
    annualPriceINR: 0,
    seats: 1,
    quotas: {
      askQueriesPerMonth: 10,
      tkdlSearchesPerMonth: 5,
      formulationsPerMonth: 3,
    },
    features: [
      { text: '1 Workspace Seat' },
      { text: '10 AI Legal Queries / month' },
      { text: '5 TKDL Prior Art Searches / month' },
      { text: '3 Formulation Classifications / month' },
      { text: 'Interactive ABS Diagnostic tool' },
      { text: 'ABS Memo PDF (Community preview watermark)' },
      { text: 'Standard community support' },
    ],
    pdfWatermarked: true,
    exemptFromDeviceCaps: false,
    ctaLabel: 'Get Started Free',
    ctaHref: '/login?mode=signup',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For early Ayurvedic D2C brands and boutique formulation teams filing their first licenses.',
    monthlyPriceINR: 1499,
    annualPriceINR: 14990, // ~17% discount (2 months free)
    seats: 3,
    quotas: {
      askQueriesPerMonth: 150,
      tkdlSearchesPerMonth: 50,
      formulationsPerMonth: 25,
    },
    features: [
      { text: 'Up to 3 Workspace Seats', highlight: true },
      { text: '150 AI Legal Queries / month', highlight: true },
      { text: '50 TKDL Prior Art Searches / month' },
      { text: '25 Formulation Classifications / month' },
      { text: 'Clean Official ABS Memo PDF (No watermark)', highlight: true },
      { text: 'Exempt from device & IP velocity caps', highlight: true },
      { text: 'Full verified IndiaCode statute deep-links' },
      { text: 'Email support (< 48h response)' },
    ],
    pdfWatermarked: false,
    exemptFromDeviceCaps: true,
    ctaLabel: 'Upgrade to Starter',
    popular: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    badge: 'Most Popular',
    description: 'For growing AYUSH manufacturers, multi-brand founders, and regulatory legal advisors.',
    monthlyPriceINR: 4999,
    annualPriceINR: 49990, // ~17% discount (2 months free)
    seats: 10,
    quotas: {
      askQueriesPerMonth: 750,
      tkdlSearchesPerMonth: 250,
      formulationsPerMonth: 100,
    },
    features: [
      { text: 'Up to 10 Workspace Seats', highlight: true },
      { text: '750 AI Legal Queries / month', highlight: true },
      { text: '250 TKDL Prior Art Searches / month' },
      { text: '100 Formulation Classifications / month' },
      { text: 'Clean Official ABS Memo PDF + Multi-State SBB Tracking', highlight: true },
      { text: 'Exempt from device & IP velocity caps', highlight: true },
      { text: 'Statute deep-links + Prior opposition case citations' },
      { text: 'Priority WhatsApp & Email support (< 12h)' },
    ],
    pdfWatermarked: false,
    exemptFromDeviceCaps: true,
    ctaLabel: 'Upgrade to Pro',
    popular: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large pharmaceutical conglomerates, corporate IP counsel, and leading law firms.',
    monthlyPriceINR: 24999,
    annualPriceINR: 249990,
    seats: 'Unlimited',
    quotas: {
      askQueriesPerMonth: 3000,
      tkdlSearchesPerMonth: 1000,
      formulationsPerMonth: 500,
    },
    features: [
      { text: 'Unlimited Workspace Seats + SSO / SAML', highlight: true },
      { text: '3,000 AI Legal Queries / month (Dedicated compute pool)', highlight: true },
      { text: '1,000 TKDL Prior Art Searches / month' },
      { text: '500 Formulation Classifications / month' },
      { text: 'Custom Firm Branding on all Regulatory Filings', highlight: true },
      { text: 'Counsel Sign-Off & Audit Trail export', highlight: true },
      { text: 'Custom Statutory & Precedent Ingestion' },
      { text: 'Dedicated Account Manager & 99.9% Uptime SLA' },
    ],
    pdfWatermarked: false,
    exemptFromDeviceCaps: true,
    ctaLabel: 'Contact Sales',
    ctaHref: 'mailto:sales@nyaaya.ai?subject=Enterprise%20Tier%20Inquiry',
    popular: false,
  },
}

export const COMPARISON_FEATURES = [
  {
    category: 'Workspace & Collaboration',
    rows: [
      { name: 'Team Seats', free: '1 user', starter: '3 users', pro: '10 users', enterprise: 'Unlimited' },
      { name: 'Role-Based Access Control', free: 'Basic', starter: 'Owner, Member', pro: 'Owner, Admin, Member, Viewer', enterprise: 'Custom RBAC + SSO' },
      { name: '24-Hour Secure Share Links', free: '—', starter: '✓', pro: '✓', enterprise: '✓' },
    ],
  },
  {
    category: 'AI Research & Prior Art',
    rows: [
      { name: 'AI Legal Queries / mo', free: '10 (pooled 25/dev)', starter: '150', pro: '750', enterprise: '3,000' },
      { name: 'TKDL Prior Art Checks / mo', free: '5', starter: '50', pro: '250', enterprise: '1,000' },
      { name: 'Formulation Classifications / mo', free: '3', starter: '25', pro: '100', enterprise: '500' },
      { name: 'Statute Deep-Links (IndiaCode)', free: 'Basic extracts', starter: 'Verified direct links', pro: 'Verified links + Precedents', enterprise: 'Dedicated statutory corpus' },
      { name: 'Confidential Mode (Zero-Retention)', free: '✓', starter: '✓', pro: '✓', enterprise: '✓ (Custom DPA)' },
    ],
  },
  {
    category: 'Regulatory Compliance & Memos',
    rows: [
      { name: 'ABS Interactive Diagnostics', free: '✓', starter: '✓', pro: '✓', enterprise: '✓' },
      { name: 'ABS Memo PDF Export', free: 'Watermarked Preview', starter: 'Clean Official PDF', pro: 'Clean Official PDF', enterprise: 'Custom Firm Branding' },
      { name: 'State Biodiversity Board (SBB) Rules', free: 'National baseline', starter: 'National baseline', pro: 'Multi-State comparative', enterprise: 'Full State-by-State tracking' },
    ],
  },
  {
    category: 'Infrastructure & Support',
    rows: [
      { name: 'Anti-Abuse Limits', free: 'Device & IP caps', starter: 'Fully exempt', pro: 'Fully exempt', enterprise: 'Exempt + Dedicated IP' },
      { name: 'Support Channel', free: 'Community', starter: 'Email (< 48h)', pro: 'Priority WhatsApp & Email (< 12h)', enterprise: 'Dedicated Account Manager' },
      { name: 'Uptime SLA', free: 'Best effort', starter: '99.5%', pro: '99.8%', enterprise: '99.9% guaranteed' },
    ],
  },
]
