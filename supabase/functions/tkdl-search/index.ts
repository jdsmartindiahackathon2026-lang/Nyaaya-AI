import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!

import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

const TKDL_DOMAINS = approvedSources.filter_sets.tkdl_search

const DISCLAIMER = 'Records shown are illustrative of TKDL and IndiaCode retrieval. The deployed system queries the official databases directly. A not-found result does not constitute freedom to operate.'

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error

  try {
    const { query, language } = await req.json()

    if (!query) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Query is required.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const pRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a TKDL (Traditional Knowledge Digital Library) search assistant. Search only tkdl.res.in and indiacode.nic.in. Output ONLY a JSON array — no prose, no markdown fences. Each element must have exactly these fields: { "name": "<formulation name>", "status": "documented" | "partial" | "not_found", "tkdlRef": "<AY-XXXX or null>", "description": "<one-sentence summary>", "source": "<url>" }. Return up to 5 records, one per distinct formulation match. Return [] if nothing found.`
          },
          { role: 'user', content: `Search TKDL for: ${query}` }
        ],
        search_domain_filter: TKDL_DOMAINS,
        return_citations: true
      })
    })

    if (!pRes.ok) {
      return new Response(JSON.stringify({ error: true, code: 'PERPLEXITY_UNAVAILABLE', message: 'Search service temporarily unavailable.', retryable: true }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const pData = await pRes.json()
    const answerText: string = pData.choices[0].message.content

    const VALID_STATUSES = new Set(['documented', 'partial', 'not_found'])

    let results: object[]
    try {
      // Strip markdown fences if present
      const cleaned = answerText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        results = parsed
          .filter((r: Record<string, unknown>) => r && typeof r.name === 'string' && typeof r.status === 'string')
          .map((r: Record<string, unknown>) => ({
            name: r.name,
            status: VALID_STATUSES.has(r.status as string) ? r.status : 'documented',
            tkdlRef: (r.tkdlRef === '' || r.tkdlRef === undefined) ? null : r.tkdlRef,
            description: r.description ?? '',
            source: r.source ?? ''
          }))
      } else {
        throw new Error('Not an array')
      }
    } catch (parseErr) {
      console.warn('tkdl-search: JSON parse failed, falling back to single-record mode:', parseErr)
      // Fallback: single-record behavior
      const status = answerText.toLowerCase().includes('not found') ? 'not_found'
        : answerText.toLowerCase().includes('partial') ? 'partial'
        : 'documented'
      const tkdlRefMatch = answerText.match(/[A-Z]{2}-\d{4,5}/)
      results = [{
        name: query,
        status,
        description: answerText,
        tkdlRef: tkdlRefMatch ? tkdlRefMatch[0] : null,
        source: (pData.citations ?? [])[0] ?? 'tkdl.res.in'
      }]
    }

    return new Response(JSON.stringify({ results, disclaimer: DISCLAIMER }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })
  }
})
