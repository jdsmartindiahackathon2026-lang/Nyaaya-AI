import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali' }

const SYSTEM_PROMPT = (currentScreen: string, lang: string) => `
You are the Nyaaya AI guide bot. Your only job is to explain what Nyaaya AI's features do and help users navigate the platform.

CURRENT SCREEN: ${currentScreen}
LANGUAGE: Respond in ${LANGUAGE_NAMES[lang]}. Keep the response tight and natural in that language — do not mix languages.

You can explain:
- What the Ask interface does and how to use it
- What Classify Formulation does and when to use it
- What the ABS Helper does
- What TKDL / Prior Art means and why it matters before filing
- What the jurisdiction toggle does
- What the Nine Realms regime map shows
- What Escalate to Human is for
- Basic Ayurveda IP concepts at a simple level (TKDL, Section 3(p), ABS, GI)

You cannot:
- Answer legal questions — redirect these to the Ask interface
- Give advice about specific formulations
- Access any external information

If a user asks a legal question, respond: "I can only help you navigate Nyaaya AI. For legal questions, please use the Ask interface — it retrieves answers from official sources with citations."

Keep responses short — 2-4 sentences maximum. You are a helper, not a lawyer.
`

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error

  try {
    const { query, currentScreen, language } = await req.json()

    if (!query || !currentScreen) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Missing required fields.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const lang = LANGUAGE_NAMES[language] ? language : 'en'

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(currentScreen, lang) },
          { role: 'user', content: query }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    })

    if (!groqRes.ok) {
      return new Response(JSON.stringify({ error: true, code: 'GROQ_UNAVAILABLE', message: 'Guide service temporarily unavailable.', retryable: true }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const groqData = await groqRes.json()
    const answer: string = groqData.choices[0].message.content

    const suggestedAction = answer.toLowerCase().includes('ask interface') ? 'Try the Ask interface for legal questions' : null

    return new Response(JSON.stringify({ answer, suggestedAction }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })
  }
})
