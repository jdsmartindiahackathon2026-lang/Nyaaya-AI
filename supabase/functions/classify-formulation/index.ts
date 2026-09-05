// NOTE: _shared/* imports are intentionally inlined below.
// The Supabase MCP deploy bundler cannot resolve relative ../_shared/ paths,
// so all shared helpers (cors, auth, rate_limit) are duplicated here verbatim.
// Keep in sync with supabase/functions/_shared/ when those files change.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

// ── INLINED: _shared/cors.ts ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
}

function handleOptions(req: Request): Response {
  return new Response('ok', { headers: corsHeaders(req) })
}

// ── INLINED: _shared/auth.ts ─────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const unauthorized = (req: Request) => new Response(
  JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }),
  { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } }
)

async function requireUser(req: Request): Promise<{ error: Response } | { user: { id: string; [key: string]: unknown }; supabase: ReturnType<typeof createClient> }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: unauthorized(req) }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { user: { id: 'system', is_service_role: true }, supabase }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return { error: unauthorized(req) }
    }
    return { user: user as { id: string; [key: string]: unknown }, supabase }
  } catch (_) {
    return { error: unauthorized(req) }
  }
}

// ── INLINED: _shared/rate_limit.ts ───────────────────────────────────────────
type FunctionName =
  | 'ask-query'
  | 'classify-formulation'
  | 'tkdl-search'
  | 'mini-guide'
  | 'translate'
  | 'escalate'
  | 'embed-query'

const RATE_LIMITS: Record<FunctionName, number> = {
  'ask-query': 20,
  'classify-formulation': 20,
  'tkdl-search': 20,
  'mini-guide': 30,
  'translate': 60,
  'escalate': 5,
  'embed-query': 60,
}

interface RateLimitUser { id: string; is_service_role?: boolean }

async function requireRateLimit(
  req: Request,
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  user: RateLimitUser,
  functionName: FunctionName,
): Promise<Response | null> {
  if (user.is_service_role) return null

  const limit = RATE_LIMITS[functionName]

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: user.id,
    p_function: functionName,
    p_limit: limit,
  })

  if (error) {
    console.error(`[rate-limit] RPC failed for ${functionName}:`, error)
    return null
  }

  const row = Array.isArray(data) ? (data[0] as { allowed?: boolean; reset_at?: string } | undefined) : (data as { allowed?: boolean; reset_at?: string } | null)
  if (row && row.allowed === false) {
    return new Response(
      JSON.stringify({
        error: true,
        code: 'RATE_LIMITED',
        message: `Too many requests. Limit: ${limit}/minute for ${functionName}. Try again in a moment.`,
        retryable: true,
        reset_at: row.reset_at,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...corsHeaders(req),
        },
      },
    )
  }

  return null
}

// ── RAG HELPER ───────────────────────────────────────────────────────────────
async function retrieveChunks(
  supabase: ReturnType<typeof createClient>,
  queryText: string,
  opts?: { threshold?: number; count?: number; statuteFilter?: string[] }
): Promise<any[]> {
  try {
    const embedRes = await fetch(`${SUPABASE_URL}/functions/v1/embed-query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: queryText }),
    })
    if (!embedRes.ok) {
      console.warn('[rag] embed-query failed:', embedRes.status)
      return []
    }
    const { embedding } = await embedRes.json()
    const { data } = await supabase.rpc('match_statute_chunks', {
      query_embedding: embedding,
      match_threshold: opts?.threshold ?? 0.65,
      match_count: opts?.count ?? 8,
    })
    if (!data) return []
    const filtered = opts?.statuteFilter?.length
      ? data.filter((r: any) => opts.statuteFilter!.includes(r.statute_id))
      : data
    return filtered
  } catch (err) {
    console.warn('[rag] retrieveChunks error:', err)
    return []
  }
}

// ── DOMAIN LOGIC ─────────────────────────────────────────────────────────────
function parseCitations(answerText: string, rawCitations: string[]) {
  const domainMeta = approvedSources.domains as Record<string, { display: string }>

  const citationsBlockMatch = answerText.match(/CITATIONS:\s*([\s\S]*?)$/i)
  if (citationsBlockMatch) {
    const lines = citationsBlockMatch[1].trim().split('\n').filter(l => l.trim())
    const parsed = lines.map(line => {
      const parts = line.split('|').map(p => p.trim())
      const url = parts[1] ?? ''
      let hostname = ''
      try { hostname = new URL(url).hostname.replace('www.', '') } catch (_) { hostname = url }
      return {
        source: parts[0] || domainMeta[hostname]?.display || hostname,
        url,
        statute_ref: parts[2] || ''
      }
    }).filter(c => c.url)
    if (parsed.length > 0) return parsed
  }

  return rawCitations.map((url: string) => {
    let hostname = ''
    try { hostname = new URL(url).hostname.replace('www.', '') } catch (_) { hostname = url }
    return {
      source: domainMeta[hostname]?.display || hostname,
      url,
      statute_ref: ''
    }
  })
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const ANTHROPIC_MODEL = 'claude-haiku-4-5'
const CLASSIFY_DOMAINS = approvedSources.filter_sets.classify_formulation

const CLASSIFICATIONS = {
  classical: {
    label: 'Classical Formulation',
    ipPosture: 'Patent protection barred under Section 3(p) of the Patents Act 1970. Formulation is documented in TKDL and/or First Schedule texts. Trade secret and trademark protection remain available for proprietary processing methods and branding.',
    regulatoryRequirements: 'Manufacturing licence under Drugs & Cosmetics Act Schedule E(1). Must conform to Ayurvedic Pharmacopoeia of India standards. No clinical trial required for classical indications.',
    nextStep: 'Run a TKDL Prior Art Check to confirm documentation status. Consider trademark registration for brand identity. Review Schedule E(1) manufacturing requirements.'
  },
  proprietary: {
    label: 'Proprietary Ayurvedic Medicine',
    ipPosture: 'Patent potential exists if formulation is novel, non-obvious and has inventive step beyond classical texts. Section 3(p) bar does not apply to genuinely innovative combinations. Trademark registration strongly recommended.',
    regulatoryRequirements: 'Registration as Proprietary Ayurvedic Medicine under Drugs & Cosmetics Act. Clinical data or literature support required. State licensing authority approval needed.',
    nextStep: 'Conduct patentability search at ipindia.gov.in. File provisional patent application to establish priority date. Simultaneously apply for trademark.'
  },
  newdrug: {
    label: 'New Ayurvedic Drug',
    ipPosture: 'Strong patent potential — novel molecular entity or new therapeutic use. Full IP protection available including product and process patents.',
    regulatoryRequirements: 'New Drug approval from CDSCO under Schedule Y. Clinical trials (Phase I–III) required. Central Drugs Standard Control Organisation clearance mandatory before any commercialisation.',
    nextStep: 'File patent application immediately to protect priority. Engage CDSCO for pre-submission meeting. Prepare clinical development plan.'
  },
  phytopharma: {
    label: 'Phytopharmaceutical Drug',
    ipPosture: 'Process patents available for extraction and standardisation methods. Product patent possible if novel formulation. Trademark registration recommended.',
    regulatoryRequirements: 'Regulated under Drugs & Cosmetics Act as Phytopharmaceutical Drug (2015 rules). Requires standardisation data, safety and efficacy evidence. CDSCO approval pathway applies.',
    nextStep: 'Review Phytopharmaceutical Drug rules (2015). File process patent for extraction method. Prepare standardisation dossier for CDSCO.'
  },
  aahar: {
    label: 'Ayurveda-Aahar / Nutraceutical',
    ipPosture: 'Limited IP protection — trade secret for formulation blend, trademark for brand. Patent unlikely due to prior art in traditional use.',
    regulatoryRequirements: 'FSSAI Ayurveda-Aahar regulations apply. Product registration with FSSAI required. Label claims restricted to those approved under FSSAI framework.',
    nextStep: 'Register with FSSAI under Ayurveda-Aahar category. Trademark the brand. Review FSSAI permitted claim list before marketing.'
  },
  cosmetic: {
    label: 'Ayurvedic Cosmetic',
    ipPosture: 'Trademark and trade dress protection primary IP tools. Process patent possible for novel manufacturing. Design registration for packaging.',
    regulatoryRequirements: 'Regulated as cosmetic under Drugs & Cosmetics Act. Import/manufacture licence required. BIS standards compliance for certain categories.',
    nextStep: 'Obtain cosmetic manufacturing licence. Register trademark and trade dress. Review BIS standards applicable to your category.'
  }
}

function classifyFromAnswers(answers: Record<string, string>): keyof typeof CLASSIFICATIONS {
  const { firstSchedule, innovationType } = answers
  if (firstSchedule === 'yes') return 'classical'
  if (firstSchedule === 'no') {
    if (innovationType === 'new_drug') return 'newdrug'
    if (innovationType === 'phyto') return 'phytopharma'
    if (innovationType === 'aahar') return 'aahar'
    if (innovationType === 'cosmetic') return 'cosmetic'
    return 'proprietary'
  }
  return 'proprietary'
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error
  const { user, supabase } = authResult

  const rateLimited = await requireRateLimit(req, supabase, user, 'classify-formulation')
  if (rateLimited) return rateLimited

  try {
    const { step, answers, language } = await req.json()

    if (step < 3) {
      return new Response(JSON.stringify({ complete: false, nextStep: step + 1 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const classificationKey = classifyFromAnswers(answers)
    const result = CLASSIFICATIONS[classificationKey]

    // ── Step 1: attempt local RAG for citations ───────────────────────────────
    const retrievalQuery = `${result.label} ${answers.innovationType ?? ''} ${answers.usesTraditionalKnowledge ? 'traditional knowledge biopiracy' : ''}`.trim()
    const chunks = await retrieveChunks(supabase, retrievalQuery, { threshold: 0.65, count: 5 })

    let citations: object[] = []
    let model_used: string

    if (chunks.length > 0) {
      // RAG hit — build citations from local corpus, skip Anthropic
      citations = chunks.map((c: any) => ({
        display_name: c.statute_display,
        url: c.deep_link || c.citation_url,
        statute_ref: `Section ${c.section_number}${c.clause_id ? ' ' + c.clause_id : ''}`,
        category: 'statute',
      }))
      model_used = 'hybrid-rag'
    } else {
      // ── Step 2 (fallback): Anthropic web-search citation generation ──────────
      model_used = 'claude-haiku-4-5+web-search'
      try {
        const doFetch = () => fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: 'You are a legal citation assistant. Output ONLY a CITATIONS block — no prose, no preamble. Each line must be exactly: display_name | url | statute_ref (e.g. "Patents Act 1970 | https://ipindia.gov.in/... | Section 3(p) of the Patents Act 1970"). Include only official Indian statute and regulatory sources.',
            messages: [{ role: 'user', content: `Find key statute citations for: ${result.label} under Indian IP and drug regulatory law.\n\nCITATIONS:` }],
            tools: [{
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 3,
              allowed_domains: CLASSIFY_DOMAINS,
            }],
          }),
        })

        let aRes = await doFetch()

        if (aRes.status === 401) {
          console.error('[classify-formulation] Anthropic key invalid or missing')
        } else {
          if (aRes.status === 429 || aRes.status >= 500) {
            await new Promise(r => setTimeout(r, 1000))
            aRes = await doFetch()
          }

          if (aRes.ok) {
            const aData = await aRes.json()
            if (aData.stop_reason !== 'refusal') {
              let answerText = ''
              for (const block of (aData.content ?? [])) {
                if (block.type === 'text') answerText += block.text
              }
              // Collect web-search citation URLs
              const webUrls: string[] = []
              for (const block of (aData.content ?? [])) {
                if (block.type === 'web_search_tool_result') {
                  for (const item of (block.content ?? [])) {
                    if (item.url) webUrls.push(item.url)
                  }
                }
              }
              citations = parseCitations(answerText, webUrls)
            }
          } else {
            const snippet = await aRes.text().catch(() => '')
            console.warn('[classify-formulation] Anthropic error:', aRes.status, snippet.slice(0, 200))
          }
        }
      } catch (_) { /* citations optional */ }
    }

    return new Response(JSON.stringify({ ...result, classification: classificationKey, citations, model_used, complete: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })
  }
})
