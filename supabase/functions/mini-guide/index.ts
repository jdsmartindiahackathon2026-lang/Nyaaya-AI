import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireUser } from '../_shared/auth.ts'
import { requireRateLimit } from '../_shared/rate_limit.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali' }

const SCREEN_DESCRIPTIONS: Record<string, string> = {
  '/app/ask': 'The user is on the Ask interface, where they can type a legal or regulatory question and receive AI-generated answers with citations from official sources like the Patents Act, Drugs & Cosmetics Act, and TKDL database.',
  '/app/classify': 'The user is on the Classify Formulation screen, a 3-step wizard where they describe their Ayurveda product, add ingredients with flags (wild-collected, endangered, novel, export-bound), and receive a regulatory classification with applicable IP and compliance obligations.',
  '/app/tkdl': 'The user is on the TKDL / Prior Art search screen, where they can search the Traditional Knowledge Digital Library to check whether a traditional formulation is already documented — critical before filing a patent or GI application.',
  '/app/abs': 'The user is on the ABS Helper, an interactive branching questionnaire that determines whether their formulation triggers Access and Benefit Sharing obligations under the Biological Diversity Act, and what steps they must follow.',
  '/app/escalate': 'The user is on the Escalate to Human screen, where they can submit a case to a qualified IP attorney or consultant when their situation is too complex for the AI — they select issue type, urgency level, and add a description.',
  '/app/profile': 'The user is on the Profile screen, where they can update their display name, user type (Practitioner, Researcher, Manufacturer, Student, etc.), preferred language, and jurisdiction.',
}

const SYSTEM_PROMPT = (currentScreen: string, lang: string) => {
  const screenKey = Object.keys(SCREEN_DESCRIPTIONS).find(k => currentScreen.startsWith(k))
  const screenContext = screenKey ? `\n${SCREEN_DESCRIPTIONS[screenKey]}\n` : ''

  return `You are the Nyaaya AI guide bot. Your only job is to explain what Nyaaya AI's features do and help users navigate the platform.

CURRENT SCREEN: ${currentScreen}${screenContext}
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error
  const { user, supabase } = authResult

  const rateLimited = await requireRateLimit(req, supabase, user, 'mini-guide')
  if (rateLimited) return rateLimited

  try {
    const { query, currentScreen, language, history } = await req.json()

    if (!query || !currentScreen) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Missing required fields.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const lang = LANGUAGE_NAMES[language] ? language : 'en'

    // Cap history to last 6 entries (3 turns)
    const safeHistory: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(history)
      ? history.slice(-6).filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : []

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(currentScreen, lang) },
          ...safeHistory,
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
