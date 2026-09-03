import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Use sonar-pro for legal accuracy; fall back to sonar if quota hit
const PERPLEXITY_MODEL = 'sonar-pro'
const PERPLEXITY_FALLBACK_MODEL = 'sonar'

function getDomainFilter(jurisdiction: string): string[] {
  if (jurisdiction === 'india') return approvedSources.filter_sets.ask_query_india
  if (jurisdiction === 'international') return approvedSources.filter_sets.ask_query_international
  return approvedSources.filter_sets.ask_query_both
}

const SYSTEM_PROMPT = (jurisdiction: string, userType: string) => {
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

CONFIDENCE LEVEL:
- HIGH: answer is directly stated in a retrieved official source
- MEDIUM: answer requires interpretation of a retrieved source
- ABSTAIN: answer not found in approved sources — never guess

RESPONSE FORMAT:
After your answer, include a structured citations block:
CITATIONS:
[list each citation on its own line as: display_name | url | statute_ref]

DISCLAIMER:
End every response with: "Information, not legal advice. Verify against the official record before filing."

SCOPE: patents, GI, trademarks, designs, copyright, trade secrets, plant variety rights, ABS compliance, drug regulatory classification, FSSAI Ayurveda-Aahar, international IP frameworks only.
For out-of-scope questions: "This is outside the scope of Nyaaya AI. Please consult a qualified professional."`
}

async function callPerplexity(model: string, systemPrompt: string, query: string, domainFilter: string[]) {
  return fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      search_domain_filter: domainFilter,
      return_citations: true,
      temperature: 0.1
    })
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

function extractStatuteRef(text: string, domain: string): string {
  // Extract statute references mentioned near domain citations in the answer text
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
  const lower = answerText.toLowerCase()
  if (lower.includes('i cannot find authoritative') || lower.includes('abstain')) return 'abstain'
  if (lower.includes('may ') || lower.includes('could ') || lower.includes('might ') || lower.includes('interpret')) return 'medium'
  return 'high'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { query, jurisdiction, language, userType, conversationId } = await req.json()

    if (!query || !jurisdiction || !language || !userType) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields: query, jurisdiction, language, userType', false, 400)
    }

    const domainFilter = getDomainFilter(jurisdiction)
    const systemPrompt = SYSTEM_PROMPT(jurisdiction, userType)

    // Try sonar-pro first, fall back to sonar on 402/429
    let perplexityRes = await callPerplexity(PERPLEXITY_MODEL, systemPrompt, query, domainFilter)
    if (perplexityRes.status === 402 || perplexityRes.status === 429) {
      perplexityRes = await callPerplexity(PERPLEXITY_FALLBACK_MODEL, systemPrompt, query, domainFilter)
    }

    if (!perplexityRes.ok) {
      if (perplexityRes.status === 429) return errorResponse('RATE_LIMITED', 'Too many requests. Please try again in a moment.', true)
      return errorResponse('PERPLEXITY_UNAVAILABLE', 'Our knowledge service is temporarily unavailable. Please try again.', true)
    }

    const perplexityData = await perplexityRes.json()
    const answerText: string = perplexityData.choices[0].message.content
    const rawCitations: string[] = perplexityData.citations ?? []

    // Strip the internal CITATIONS block from the user-facing answer
    const cleanAnswer = answerText.replace(/CITATIONS:\s*[\s\S]*?(?=Information, not legal advice|$)/i, '').trim()

    const citations = parseCitations(answerText, rawCitations)
    const confidence = deriveConfidence(answerText)

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

    // Persist to DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const authHeader = req.headers.get('Authorization')
    if (authHeader && conversationId) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
        if (user) {
          await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: query, citations: [], confidence: null },
            { conversation_id: conversationId, role: 'assistant', content: finalAnswer, citations, confidence }
          ])
        }
      } catch (_) { /* non-fatal — DB write failure should not block response */ }
    }

    return new Response(JSON.stringify({
      answer: finalAnswer,
      citations,
      confidence,
      jurisdiction,
      model_used: perplexityData.model ?? PERPLEXITY_MODEL,
      disclaimer: 'Information, not legal advice. Verify against the official record before filing.'
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

  } catch (err) {
    console.error(err)
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred. Please try again.', true)
  }
})

function errorResponse(code: string, message: string, retryable: boolean, status = 500) {
  return new Response(JSON.stringify({ error: true, code, message, retryable }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
