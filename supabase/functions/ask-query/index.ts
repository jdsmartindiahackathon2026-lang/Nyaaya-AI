import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireRateLimit } from '../_shared/rate_limit.ts'
import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Use sonar-pro for legal accuracy; fall back to sonar if quota hit or model unavailable
const PERPLEXITY_MODEL = 'sonar-pro'
const PERPLEXITY_FALLBACK_MODEL = 'sonar'

// Module-level flag: flip to false when sonar-pro returns a structural "model not available" error
let sonarProAvailable = true

function getDomainFilter(jurisdiction: string): string[] {
  if (jurisdiction === 'india') return approvedSources.filter_sets.ask_query_india
  if (jurisdiction === 'international') return approvedSources.filter_sets.ask_query_international
  return approvedSources.filter_sets.ask_query_both
}

// --- System prompt for live Perplexity path (domain-filtered) ---
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

async function callPerplexity(
  model: string,
  systemPrompt: string,
  query: string,
  domainFilter: string[],
  history: Array<{ role: string; content: string }>,
  useSearch: boolean
) {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: query }
    ],
    temperature: 0.1,
  }
  if (useSearch) {
    body.search_domain_filter = domainFilter
    body.return_citations = true
  } else {
    body.return_citations = false
  }
  return fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
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

  // Fallback: use raw citation URLs from Perplexity, enrich with domain metadata
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
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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
    // STEP 3: Branch — hybrid RAG vs pure live-retrieval
    // -------------------------------------------------------------------------
    const useLocalHits = hits.length > 0

    // Guard: if no Perplexity key, we can't call the LLM at all.
    // TODO(session-11): when local hits exist and PERPLEXITY_API_KEY is absent,
    // return a synthesized answer built directly from chunk texts instead of 503.
    if (!PERPLEXITY_API_KEY) {
      return errorResponse(req, 'PERPLEXITY_MISSING', 'Knowledge service is not configured. Please contact support.', false, 503)
    }

    const domainFilter = getDomainFilter(jurisdiction)

    let perplexityRes: Response
    let usedFallback = false
    let modelUsedLabel: string

    if (useLocalHits) {
      // --- HYBRID RAG PATH ---
      // Build a grounded system prompt with inline retrieved sources.
      // Omit search_domain_filter; model should stay within the provided chunks.
      const systemPrompt = SYSTEM_PROMPT_RAG(jurisdiction, userType, hits)

      if (!sonarProAvailable) {
        perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter, history, false)
        usedFallback = true
      } else {
        perplexityRes = await callPerplexity(PERPLEXITY_MODEL, systemPrompt, query, domainFilter, history, false)

        if (!perplexityRes.ok && (perplexityRes.status === 400 || perplexityRes.status === 403)) {
          sonarProAvailable = false
          console.warn('[ask-query] sonar-pro unavailable; downgrading to sonar for this worker lifetime')
          perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter, history, false)
          usedFallback = true
        } else if (!perplexityRes.ok && (perplexityRes.status === 402 || perplexityRes.status === 429)) {
          perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter, history, false)
          usedFallback = true
        }
      }

      modelUsedLabel = usedFallback ? `hybrid-rag+${PERPLEXITY_FALLBACK_MODEL}` : `hybrid-rag+${PERPLEXITY_MODEL}`
    } else {
      // --- PURE LIVE-RETRIEVAL PATH (no local hits / embed failed / RPC error) ---
      const systemPrompt = SYSTEM_PROMPT_LIVE(jurisdiction, userType)

      if (!sonarProAvailable) {
        perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter, history, true)
        usedFallback = true
      } else {
        perplexityRes = await callPerplexity(PERPLEXITY_MODEL, systemPrompt, query, domainFilter, history, true)

        if (!perplexityRes.ok && (perplexityRes.status === 400 || perplexityRes.status === 403)) {
          sonarProAvailable = false
          console.warn('[ask-query] sonar-pro unavailable; downgrading to sonar for this worker lifetime')
          perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter, history, true)
          usedFallback = true
        } else if (!perplexityRes.ok && (perplexityRes.status === 402 || perplexityRes.status === 429)) {
          perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter, history, true)
          usedFallback = true
        }
      }

      modelUsedLabel = usedFallback ? PERPLEXITY_FALLBACK_MODEL : PERPLEXITY_MODEL
    }

    if (!perplexityRes.ok) {
      if (perplexityRes.status === 429) return errorResponse(req, 'RATE_LIMITED', 'Too many requests. Please try again in a moment.', true)
      return errorResponse(req, 'PERPLEXITY_UNAVAILABLE', 'Our knowledge service is temporarily unavailable. Please try again.', true)
    }

    const perplexityData = await perplexityRes.json()
    const answerText: string = perplexityData.choices[0].message.content

    const confidence = deriveConfidence(answerText)

    // Strip the CONFIDENCE line from the user-facing answer.
    // In the RAG path the model won't emit a CITATIONS block (we told it not to), but strip it defensively.
    const cleanAnswer = answerText
      .replace(/^CONFIDENCE:\s*(HIGH|MEDIUM|ABSTAIN)\b.*$/im, '')
      .replace(/CITATIONS:\s*[\s\S]*?(?=Information, not legal advice|$)/i, '')
      .trim()

    // Build citations
    let citations: Array<{ source: string; url: string; statute_ref: string }>
    if (useLocalHits) {
      // Derive citations from the local chunk hits; ignore any model-emitted citations
      citations = hits.slice(0, 5).map(h => ({
        source: h.statute_display,
        url: h.deep_link || h.citation_url || '',
        statute_ref: `Section ${h.section_number}${h.clause_id ? ' ' + h.clause_id : ''}`,
      }))
    } else {
      const rawCitations: string[] = perplexityData.citations ?? []
      citations = parseCitations(answerText, rawCitations)
    }

    // Translate if needed
    let finalAnswer = cleanAnswer
    if (language !== 'en') {
      try {
        const translateRes = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
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
