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

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const ANTHROPIC_MODEL = 'claude-haiku-4-5'
const TKDL_DOMAINS = approvedSources.filter_sets.tkdl_search

const DISCLAIMER = 'Records shown are illustrative of TKDL and IndiaCode retrieval. The deployed system queries the official databases directly. A not-found result does not constitute freedom to operate.'
const DISCLAIMER_ANTHROPIC_MISSING = 'TKDL record lookup is temporarily unavailable. Legal context is sourced from the local statutory corpus. A not-found result does not constitute freedom to operate.'

// ── HANDLER ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error
  const { user, supabase } = authResult

  const rateLimited = await requireRateLimit(req, supabase, user, 'tkdl-search')
  if (rateLimited) return rateLimited

  try {
    const { query, language } = await req.json()

    if (!query) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Query is required.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    // ── Call A (legal framing via local RAG) + Call B (TKDL via Anthropic) in parallel
    const legalQuery = `${query} biopiracy prior art traditional knowledge patent opposition`

    const anthropicBody = {
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: `You are a TKDL (Traditional Knowledge Digital Library) search assistant. Search only tkdl.res.in and indiacode.nic.in. Output ONLY a JSON array — no prose, no markdown fences. Each element must have exactly these fields: { "name": "<formulation name>", "status": "documented" | "partial" | "not_found", "tkdlRef": "<AY-XXXX or null>", "description": "<one-sentence summary>", "source": "<url>" }. Return up to 5 records, one per distinct formulation match. Return [] if nothing found.`,
      messages: [{ role: 'user', content: `Search TKDL for: ${query}` }],
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
        allowed_domains: TKDL_DOMAINS,
      }],
    }

    const doAnthropicFetch = () => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(anthropicBody),
    }).catch(err => {
      console.warn('[tkdl-search] Anthropic fetch error:', err)
      return null
    })

    const [legalChunks, aRes] = await Promise.all([
      retrieveChunks(supabase, legalQuery, {
        threshold: 0.60,
        count: 3,
        statuteFilter: ['patents-act-1970', 'bd-act-2002', 'bd-rules-2004'],
      }),
      doAnthropicFetch()
    ])

    const legal_context = legalChunks.map((c: any) => ({
      statute_display: c.statute_display,
      section_number: c.section_number,
      clause_id: c.clause_id,
      text: typeof c.text === 'string' ? c.text.slice(0, 300) : '',
      deep_link: c.deep_link,
    }))

    // ── Handle Anthropic 401 ──────────────────────────────────────────────────
    if (aRes && aRes.status === 401) {
      console.error('[tkdl-search] Anthropic key invalid or missing')
      return new Response(JSON.stringify({
        results: [],
        legal_context,
        model_used: 'hybrid-rag+claude-haiku-4-5',
        disclaimer: DISCLAIMER_ANTHROPIC_MISSING,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    // ── Retry on 429 / 5xx ────────────────────────────────────────────────────
    let finalARes = aRes
    if (aRes && (aRes.status === 429 || aRes.status >= 500)) {
      await new Promise(r => setTimeout(r, 1000))
      finalARes = await doAnthropicFetch()
    }

    // ── Handle Anthropic failure gracefully ───────────────────────────────────
    if (!finalARes || !finalARes.ok) {
      if (finalARes) {
        const snippet = await finalARes.text().catch(() => '')
        console.warn('[tkdl-search] Anthropic error:', finalARes.status, snippet.slice(0, 200))
      } else {
        console.warn('[tkdl-search] Anthropic unavailable, returning legal_context only')
      }
      return new Response(JSON.stringify({
        results: [],
        legal_context,
        model_used: 'hybrid-rag+claude-haiku-4-5',
        disclaimer: DISCLAIMER_ANTHROPIC_MISSING,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const aData = await finalARes.json()

    if (aData.stop_reason === 'refusal') {
      console.warn('[tkdl-search] Anthropic refused the request')
      return new Response(JSON.stringify({
        results: [],
        legal_context,
        model_used: 'hybrid-rag+claude-haiku-4-5',
        disclaimer: DISCLAIMER_ANTHROPIC_MISSING,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    // Extract text answer from content blocks
    let answerText = ''
    for (const block of (aData.content ?? [])) {
      if (block.type === 'text') answerText += block.text
    }

    // Collect all URLs Claude actually saw via the web_search tool. These are
    // the only URLs we let through as record.source — anything else Claude
    // wrote is treated as a fabrication and dropped.
    const trustedUrls = new Set<string>()
    let fallbackSource = 'https://tkdl.res.in/'
    for (const block of (aData.content ?? [])) {
      if (block.type === 'web_search_tool_result') {
        for (const item of (block.content ?? [])) {
          if (item.url) {
            trustedUrls.add(item.url)
            if (fallbackSource === 'https://tkdl.res.in/') fallbackSource = item.url
          }
        }
      }
    }

    const VALID_STATUSES = new Set(['documented', 'partial', 'not_found'])

    let results: object[]
    try {
      const cleaned = answerText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        results = parsed
          .filter((r: Record<string, unknown>) => r && typeof r.name === 'string' && typeof r.status === 'string')
          .map((r: Record<string, unknown>) => {
            const claudeSource = typeof r.source === 'string' ? r.source : ''
            const source = trustedUrls.has(claudeSource) ? claudeSource : fallbackSource
            return {
              name: r.name,
              status: VALID_STATUSES.has(r.status as string) ? r.status : 'documented',
              tkdlRef: (r.tkdlRef === '' || r.tkdlRef === undefined) ? null : r.tkdlRef,
              description: r.description ?? '',
              source,
            }
          })
      } else {
        throw new Error('Not an array')
      }
    } catch (parseErr) {
      console.warn('tkdl-search: JSON parse failed, falling back to single-record mode:', parseErr)
      const status = answerText.toLowerCase().includes('not found') ? 'not_found'
        : answerText.toLowerCase().includes('partial') ? 'partial'
        : 'documented'
      const tkdlRefMatch = answerText.match(/[A-Z]{2}-\d{4,5}/)
      results = [{
        name: query,
        status,
        description: answerText,
        tkdlRef: tkdlRefMatch ? tkdlRefMatch[0] : null,
        source: fallbackSource
      }]
    }

    return new Response(JSON.stringify({
      results,
      legal_context,
      model_used: 'hybrid-rag+claude-haiku-4-5',
      disclaimer: DISCLAIMER,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })
  }
})
