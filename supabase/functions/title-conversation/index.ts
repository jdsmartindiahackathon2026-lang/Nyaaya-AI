import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Auth + rate-limit inlined (not imported from _shared) so the deployed
// bundle is self-contained — the MCP deploy pipeline flattens the source
// directory and cannot resolve ../_shared/*.ts imports.

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const SYSTEM_PROMPT = `You generate very short titles for legal chat threads about Ayurveda IP and regulatory questions.

Rules:
- 3 to 6 words only
- No trailing punctuation
- Title Case
- No quotes, no emoji, no prefixes like "Title:"
- Prefer the concrete subject (statute, formulation, action) over generic words

Respond with the title only.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
  }
  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let userId = 'system'
  let isServiceRole = false
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    isServiceRole = true
  } else {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        return new Response(JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
      }
      userId = user.id
    } catch (_) {
      return new Response(JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
    }
  }

  // Share the mini-guide (Groq) budget — 30/min per user.
  if (!isServiceRole) {
    const { data, error } = await supabase.rpc('check_rate_limit', { p_user_id: userId, p_function: 'mini-guide', p_limit: 30 })
    if (!error) {
      const row = Array.isArray(data) ? (data[0] as { allowed?: boolean; reset_at?: string } | undefined) : (data as { allowed?: boolean; reset_at?: string } | null)
      if (row && row.allowed === false) {
        return new Response(JSON.stringify({ error: true, code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.', retryable: true, reset_at: row.reset_at }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders(req) } })
      }
    }
  }

  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Missing query.', retryable: false }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
    }
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: query.slice(0, 500) }], max_tokens: 24, temperature: 0.2 }),
    })
    if (!groqRes.ok) {
      return new Response(JSON.stringify({ error: true, code: 'GROQ_UNAVAILABLE', message: 'Title service unavailable.', retryable: true }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
    }
    const data = await groqRes.json()
    let title: string = (data.choices?.[0]?.message?.content ?? '').trim()
    title = title.replace(/^["'`]|["'`]$/g, '').replace(/[.!?]+$/g, '').replace(/^title\s*:\s*/i, '').trim()
    if (title.length > 80) title = title.slice(0, 80).trimEnd() + '…'
    return new Response(JSON.stringify({ title }), { headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })
  }
})
