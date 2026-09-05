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

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5'

function getDomainFilter(jurisdiction: string): string[] {
  if (jurisdiction === 'india') return approvedSources.filter_sets.ask_query_india
  if (jurisdiction === 'international') return approvedSources.filter_sets.ask_query_international
  return approvedSources.filter_sets.ask_query_both
}

// --- System prompt for live web-search path ---
const SYSTEM_PROMPT_LIVE = (jurisdiction: string, userType: string) => {
  const domainList = getDomainFilter(jurisdiction)
    .map((d: string) => {
      const meta = (approvedSources.domains as Record<string, { display: string }>)[d]
      return `- ${d}${meta ? ` (${meta.display})` : ''}`
    })
    .join('\n')

  return `You are Nyaaya AI, an authoritative legal information assistant specialising exclusively in Intellectual Property law and regulatory compliance for Ayurvedic products.

JURISDICTION: ${jurisdiction}
USER TYPE: ${userType}

STRICT SOURCE RESTRICTION:
Retrieve and cite ONLY from the following approved official sources:
${domainList}

If no answer is found from these sources, respond exactly: "I cannot find authoritative information on this from official sources."

JURISDICTION RULES:
- india: answer only from Indian statutes and regulatory frameworks
- international: answer only from WIPO, TRIPS, CBD, Nagoya Protocol and export market regulations
- both: answer in two clearly labelled sections — India and International — never conflate them

CITATION RULES:
- Every factual claim must cite the specific statute, section, rule or treaty article
- Citation format: [Source Name — Section/Article reference] e.g. [Patents Act 1970 — Section 3(p)]
- Do not cite secondary sources, legal blogs, or unofficial summaries

CONFIDENCE LINE (required, on its own line, before CITATIONS):
CONFIDENCE: HIGH   — answer directly stated in a retrieved official source
CONFIDENCE: MEDIUM — answer required interpretation of a retrieved source
CONFIDENCE: ABSTAIN — answer not found in approved sources

RESPONSE FORMAT:
Your response must follow this exact order:
1. Answer text
2. CONFIDENCE: <HIGH|MEDIUM|ABSTAIN>
3. CITATIONS block
4. Disclaimer

After your answer, include a structured citations block:
CITATIONS:
[list each citation on its own line as: display_name | url | statute_ref]

DISCLAIMER:
End every response with: "Information, not legal advice. Verify against the official record before filing."

SCOPE: patents, GI, trademarks, designs, copyright, trade secrets, plant variety rights, ABS compliance, drug regulatory classification, FSSAI Ayurveda-Aahar, international IP frameworks only.
For out-of-scope questions: "This is outside the scope of Nyaaya AI. Please consult a qualified professional."`
}

// --- System prompt for hybrid RAG path (local chunks provided inline) ---
const SYSTEM_PROMPT_RAG = (
  jurisdiction: string,
  userType: string,
  hits: Array<{
    statute_display: string
    section_number: string
    clause_id?: string | null
    section_title?: string | null
    text: string
    deep_link?: string | null
    citation_url?: string | null
  }>
) => {
  const sourceBlock = hits
    .map((h, i) => {
      const clauseSuffix = h.clause_id ? ` ${h.clause_id}` : ''
      const titleSuffix = h.section_title ? ` — ${h.section_title}` : ''
      const url = h.deep_link || h.citation_url || ''
      return `[${i + 1}] ${h.statute_display} — Section ${h.section_number}${clauseSuffix}${titleSuffix}
    URL: ${url}
    TEXT: ${h.text}`
    })
    .join('\n\n')

  return `You are Nyaaya AI, an authoritative legal information assistant specialising exclusively in Intellectual Property law and regulatory compliance for Ayurvedic products.

JURISDICTION: ${jurisdiction}
USER TYPE: ${userType}

RETRIEVED SOURCES (use ONLY these to answer; do not invent facts or cite anything else):
${sourceBlock}

If the retrieved sources do not contain enough information to answer, respond exactly: "I cannot find authoritative information on this from official sources."

JURISDICTION RULES:
- india: answer only from Indian statutes and regulatory frameworks
- international: answer only from WIPO, TRIPS, CBD, Nagoya Protocol and export market regulations
- both: answer in two clearly labelled sections — India and International — never conflate them

CITATION RULES:
- Every factual claim must cite the specific retrieved source by its number [1], [2], etc.
- Do not invent facts or cite sources not listed above

CONFIDENCE LINE (required, on its own line at the end of your answer):
CONFIDENCE: HIGH   — answer directly stated in a retrieved source
CONFIDENCE: MEDIUM — answer required interpretation of a retrieved source
CONFIDENCE: ABSTAIN — answer not found in retrieved sources

RESPONSE FORMAT:
1. Answer text (citing retrieved sources by number)
2. CONFIDENCE: <HIGH|MEDIUM|ABSTAIN>
3. Disclaimer

DISCLAIMER:
End every response with: "Information, not legal advice. Verify against the official record before filing."

SCOPE: patents, GI, trademarks, designs, copyright, trade secrets, plant variety rights, ABS compliance, drug regulatory classification, FSSAI Ayurveda-Aahar, international IP frameworks only.
For out-of-scope questions: "This is outside the scope of Nyaaya AI. Please consult a qualified professional."`
}

async function callAnthropic(
  systemPrompt: string,
  query: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  allowedDomains?: string[]
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [...history, { role: 'user', content: query }],
  }
  if (allowedDomains) {
    body.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 3,
      allowed_domains: allowedDomains,
    }]
  }
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function parseCitations(answerText: string, rawCitations: string[]) {
  const domainMeta = approvedSources.domains as Record<string, { display: string }>

  // Try to parse the structured CITATIONS block we asked the model to produce
  const citationsBlockMatch = answerText.match(/CITATIONS:\s*([\s\S]*?)(?:Information, not legal advice|$)/i)
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

  // Fallback: use raw citation URLs, enrich with domain metadata
  return rawCitations.map((url: string) => {
    let hostname = ''
    try { hostname = new URL(url).hostname.replace('www.', '') } catch (_) { hostname = url }
    return {
      source: domainMeta[hostname]?.display || hostname,
      url,
      statute_ref: extractStatuteRef(answerText, hostname)
    }
  })
}

function extractStatuteRef(text: string, _domain: string): string {
  const patterns = [
    /(?:Section|Sec\.|Art\.)\s*\d+(?:\([a-z]\))?(?:\s+of\s+[^.]+)?/gi,
    /(?:Rule|Schedule)\s*[A-Z]?\d+[A-Z]?(?:\([a-z]\))?/gi,
    /(?:Article)\s*\d+(?:\.\d+)?/gi
  ]
  const refs: string[] = []
  for (const pat of patterns) {
    const matches = text.match(pat) ?? []
    refs.push(...matches.slice(0, 2))
  }
  return refs[0] ?? ''
}

function deriveConfidence(answerText: string): 'high' | 'medium' | 'abstain' {
  const match = answerText.match(/^CONFIDENCE:\s*(HIGH|MEDIUM|ABSTAIN)\b/im)
  if (match) return match[1].toLowerCase() as 'high' | 'medium' | 'abstain'
  return 'medium'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error
  const { user, supabase } = authResult

  const rateLimited = await requireRateLimit(req, supabase, user, 'ask-query')
  if (rateLimited) return rateLimited

  try {
    const { query, jurisdiction, language, userType, conversationId, history: rawHistory } = await req.json()

    if (!query || !jurisdiction || !language || !userType) {
      return errorResponse(req, 'VALIDATION_ERROR', 'Missing required fields: query, jurisdiction, language, userType', false, 400)
    }

    // Validate and sanitize history
    const validatedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (Array.isArray(rawHistory)) {
      for (const item of rawHistory) {
        if (item && typeof item.role === 'string' && typeof item.content === 'string'
            && (item.role === 'user' || item.role === 'assistant')) {
          validatedHistory.push({ role: item.role, content: item.content })
        }
      }
    }
    const history = validatedHistory.slice(-6)

    // -------------------------------------------------------------------------
    // STEP 1: Embed query via embed-query Edge Function (non-fatal on failure)
    // -------------------------------------------------------------------------
    let embedding: number[] | null = null
    try {
      const embedRes = await fetch(`${SUPABASE_URL}/functions/v1/embed-query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: query }),
      })
      if (embedRes.ok) {
        const embedData = await embedRes.json()
        if (Array.isArray(embedData.embedding)) {
          embedding = embedData.embedding as number[]
        } else {
          console.warn('[ask-query] embed-query returned unexpected shape:', JSON.stringify(embedData).slice(0, 200))
        }
      } else {
        console.warn('[ask-query] embed-query HTTP error:', embedRes.status, await embedRes.text().catch(() => ''))
      }
    } catch (embedErr) {
      console.warn('[ask-query] embed-query fetch failed:', embedErr)
    }

    // -------------------------------------------------------------------------
    // STEP 2: Retrieve local statute chunks via pgvector RPC (non-fatal)
    // -------------------------------------------------------------------------
    type ChunkHit = {
      id: string
      statute_display: string
      section_number: string
      clause_id: string | null
      section_title: string | null
      text: string
      deep_link: string | null
      citation_url: string | null
      similarity: number
    }
    let hits: ChunkHit[] = []

    if (embedding) {
      const { data, error: rpcError } = await supabase.rpc('match_statute_chunks', {
        query_embedding: embedding,
        match_threshold: 0.65,
        match_count: 8,
      })
      if (rpcError) {
        console.warn('[ask-query] match_statute_chunks RPC error:', rpcError)
      } else if (Array.isArray(data)) {
        hits = data as ChunkHit[]
      }
    }

    // -------------------------------------------------------------------------
    // STEP 3: Branch — hybrid RAG vs live web-search
    // -------------------------------------------------------------------------
    const useLocalHits = hits.length > 0

    if (!ANTHROPIC_API_KEY) {
      return errorResponse(req, 'ANTHROPIC_MISSING', 'Knowledge service is not configured. Please contact support.', false, 503)
    }

    const domainFilter = getDomainFilter(jurisdiction)

    // Build the appropriate system prompt and decide whether to pass web-search domains
    const systemPrompt = useLocalHits
      ? SYSTEM_PROMPT_RAG(jurisdiction, userType, hits)
      : SYSTEM_PROMPT_LIVE(jurisdiction, userType)

    const webSearchDomains = useLocalHits ? undefined : domainFilter

    // Call Anthropic with single retry on 429 / 5xx
    let anthropicRes = await callAnthropic(systemPrompt, query, history, webSearchDomains)

    if (anthropicRes.status === 401) {
      console.error('[ask-query] Anthropic key invalid or missing')
      return errorResponse(req, 'ANTHROPIC_AUTH', 'Service authentication failed. Please contact support.', false, 502)
    }

    if (anthropicRes.status === 429 || anthropicRes.status >= 500) {
      await new Promise(r => setTimeout(r, 1000))
      anthropicRes = await callAnthropic(systemPrompt, query, history, webSearchDomains)
    }

    if (!anthropicRes.ok) {
      const snippet = await anthropicRes.text().catch(() => '')
      console.error('[ask-query] Anthropic error:', anthropicRes.status, snippet.slice(0, 200))
      if (anthropicRes.status === 429) return errorResponse(req, 'RATE_LIMITED', 'Too many requests. Please try again in a moment.', true)
      return errorResponse(req, 'UPSTREAM_UNAVAILABLE', 'Our knowledge service is temporarily unavailable. Please try again.', true, 503)
    }

    const anthropicData = await anthropicRes.json()

    if (anthropicData.stop_reason === 'refusal') {
      console.warn('[ask-query] Anthropic refused the request')
      return errorResponse(req, 'REFUSAL', 'Request could not be processed. Please rephrase your question.', false, 502)
    }

    // Extract text answer from content blocks
    let answerText = ''
    for (const block of (anthropicData.content ?? [])) {
      if (block.type === 'text') answerText += block.text
    }

    // Extract web-search citations from content blocks (live path only)
    const webCitationUrls: string[] = []
    if (!useLocalHits) {
      for (const block of (anthropicData.content ?? [])) {
        if (block.type === 'web_search_tool_result') {
          for (const item of (block.content ?? [])) {
            if (item.url) webCitationUrls.push(item.url)
          }
        }
      }
    }

    const confidence = deriveConfidence(answerText)

    // Strip the CONFIDENCE line from the user-facing answer
    const cleanAnswer = answerText
      .replace(/^CONFIDENCE:\s*(HIGH|MEDIUM|ABSTAIN)\b.*$/im, '')
      .replace(/CITATIONS:\s*[\s\S]*?(?=Information, not legal advice|$)/i, '')
      .trim()

    // Build citations
    let citations: Array<{ source: string; url: string; statute_ref: string }>
    if (useLocalHits) {
      citations = hits.slice(0, 5).map(h => ({
        source: h.statute_display,
        url: h.deep_link || h.citation_url || '',
        statute_ref: `Section ${h.section_number}${h.clause_id ? ' ' + h.clause_id : ''}`,
      }))
    } else {
      citations = parseCitations(answerText, webCitationUrls)
    }

    const modelUsedLabel = useLocalHits ? 'claude-haiku-4-5+hybrid-rag' : 'claude-haiku-4-5+web-search'

    // Translate if needed
    let finalAnswer = cleanAnswer
    if (language !== 'en') {
      try {
        const translateRes = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanAnswer, targetLanguage: language })
        })
        if (translateRes.ok) {
          const tData = await translateRes.json()
          finalAnswer = tData.translatedText ?? cleanAnswer
        }
      } catch (_) { /* fallback to English */ }
    }

    // Persist to DB (non-fatal)
    if (conversationId) {
      try {
        await supabase.from('messages').insert([
          { conversation_id: conversationId, role: 'user', content: query, citations: [], confidence: null },
          { conversation_id: conversationId, role: 'assistant', content: finalAnswer, citations, confidence }
        ])
      } catch (_) { /* non-fatal — DB write failure should not block response */ }
    }

    return new Response(JSON.stringify({
      answer: finalAnswer,
      citations,
      confidence,
      jurisdiction,
      model_used: modelUsedLabel,
      disclaimer: 'Information, not legal advice. Verify against the official record before filing.'
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })

  } catch (err) {
    console.error(err)
    return errorResponse(req, 'INTERNAL_ERROR', 'An unexpected error occurred. Please try again.', true)
  }
})

function errorResponse(req: Request, code: string, message: string, retryable: boolean, status = 500) {
  return new Response(JSON.stringify({ error: true, code, message, retryable }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
  })
}
