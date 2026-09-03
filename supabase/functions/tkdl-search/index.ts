import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!

import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

const TKDL_DOMAINS = approvedSources.filter_sets.tkdl_search

const DISCLAIMER = 'Records shown are illustrative of TKDL and IndiaCode retrieval. The deployed system queries the official databases directly. A not-found result does not constitute freedom to operate.'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { query, language } = await req.json()

    if (!query) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Query is required.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
            content: `You are a TKDL (Traditional Knowledge Digital Library) search assistant. Search only tkdl.res.in and indiacode.nic.in. For each result found, identify whether it is DOCUMENTED (clearly in TKDL corpus with entry reference), PARTIAL MATCH (partially documented), or NOT FOUND. Always include the TKDL entry reference number (e.g. AY-3140) if documented. Return structured results only.`
          },
          { role: 'user', content: `Search TKDL for: ${query}` }
        ],
        search_domain_filter: TKDL_DOMAINS,
        return_citations: true
      })
    })

    if (!pRes.ok) {
      return new Response(JSON.stringify({ error: true, code: 'PERPLEXITY_UNAVAILABLE', message: 'Search service temporarily unavailable.', retryable: true }), {
        status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const pData = await pRes.json()
    const answerText: string = pData.choices[0].message.content

    const status = answerText.toLowerCase().includes('not found') ? 'not_found'
      : answerText.toLowerCase().includes('partial') ? 'partial'
      : 'documented'

    const tkdlRefMatch = answerText.match(/[A-Z]{2}-\d{4,5}/)

    const results = [{
      name: query,
      status,
      description: answerText,
      tkdlRef: tkdlRefMatch ? tkdlRefMatch[0] : null,
      source: (pData.citations ?? [])[0] ?? 'tkdl.res.in'
    }]

    return new Response(JSON.stringify({ results, disclaimer: DISCLAIMER }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
