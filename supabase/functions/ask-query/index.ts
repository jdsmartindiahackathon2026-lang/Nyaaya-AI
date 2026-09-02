import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SYSTEM_PROMPT = (jurisdiction: string, userType: string) => `
You are Nyaaya AI, an authoritative legal information assistant specialising exclusively in Intellectual Property law and regulatory compliance for Ayurvedic products in India and under international frameworks.

JURISDICTION: ${jurisdiction}
USER TYPE: ${userType}

STRICT SOURCE RESTRICTION:
You must only retrieve information and cite from the following approved official sources:
${approvedSources.all_domains.map((d: string) => `- ${d}`).join('\n')}

If you cannot find an answer from these sources, respond exactly: "I cannot find authoritative information on this from official sources."

JURISDICTION RULES:
- If jurisdiction is india: answer only from Indian statutes, rules and regulatory frameworks
- If jurisdiction is international: answer only from WIPO, TRIPS, CBD, Nagoya Protocol and relevant export market regulations
- If jurisdiction is both: answer in two clearly labelled sections — India and International — never conflate them

CITATION RULES:
- Every factual claim must cite the specific statute, section, rule or treaty article it comes from
- Citation format: [Source Name — Section/Article reference]
- Do not cite secondary sources, legal blogs, or unofficial summaries under any circumstances

CONFIDENCE:
- Respond HIGH confidence only when the answer is directly stated in an official source you have retrieved
- Respond MEDIUM confidence when the answer requires interpretation of a retrieved source
- Respond ABSTAIN when you cannot find the answer in the approved sources — never guess

DISCLAIMER:
End every response with exactly: "Information, not legal advice. Verify against the official record before filing."

SCOPE:
You only answer questions about: patents, GI, trademarks, designs, copyright, trade secrets, plant variety rights, ABS compliance, drug regulatory classification, FSSAI Ayurveda-Aahar regulations, and related international frameworks.
For questions outside this scope, say: "This is outside the scope of Nyaaya AI. Please consult a qualified professional."
`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { query, jurisdiction, language, userType, conversationId } = await req.json()

    if (!query || !jurisdiction || !language || !userType) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields', false, 400)
    }

    // Call Perplexity API
    const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(jurisdiction, userType) },
          { role: 'user', content: query }
        ],
        search_domain_filter: approvedSources.all_domains,
        return_citations: true
      })
    })

    if (!perplexityRes.ok) {
      if (perplexityRes.status === 429) return errorResponse('RATE_LIMITED', 'Too many requests. Please try again in a moment.', true)
      return errorResponse('PERPLEXITY_UNAVAILABLE', 'Our knowledge service is temporarily unavailable. Please try again.', true)
    }

    const perplexityData = await perplexityRes.json()
    const answerText: string = perplexityData.choices[0].message.content
    const rawCitations = perplexityData.citations ?? []

    const citations = rawCitations.map((url: string) => ({
      source: new URL(url).hostname.replace('www.', ''),
      url,
      statute_ref: ''
    }))

    const confidence = answerText.includes('I cannot find authoritative') ? 'abstain'
      : answerText.toLowerCase().includes('may') || answerText.toLowerCase().includes('could') ? 'medium'
      : 'high'

    // Translate if needed
    let finalAnswer = answerText
    if (language !== 'en') {
      try {
        const translateRes = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: answerText, targetLanguage: language })
        })
        if (translateRes.ok) {
          const tData = await translateRes.json()
          finalAnswer = tData.translatedText ?? answerText
        }
      } catch (_) { /* fallback to English */ }
    }

    // Save to DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const authHeader = req.headers.get('Authorization')
    if (authHeader && conversationId) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (user) {
        await supabase.from('messages').insert([
          { conversation_id: conversationId, role: 'user', content: query, citations: [], confidence: null },
          { conversation_id: conversationId, role: 'assistant', content: finalAnswer, citations, confidence }
        ])
      }
    }

    return new Response(JSON.stringify({
      answer: finalAnswer,
      citations,
      confidence,
      jurisdiction,
      disclaimer: 'Information, not legal advice. Verify against the official record before filing.'
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

  } catch (err) {
    console.error(err)
    return errorResponse('DB_ERROR', 'An unexpected error occurred. Please try again.', true)
  }
})

function errorResponse(code: string, message: string, retryable: boolean, status = 500) {
  return new Response(JSON.stringify({ error: true, code, message, retryable }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
