import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000')
  .split(',').map((s: string) => s.trim()).filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function handleOptions(req: Request): Response {
  return new Response('ok', { headers: corsHeaders(req) })
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: new Response(
      JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } }
    )}
  }
  const token = authHeader.replace('Bearer ', '')
  // Use user's JWT (not service role) so RLS scopes all queries automatically
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  try {
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) {
      return { error: new Response(
        JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } }
      )}
    }
    return { user: user as { id: string; [key: string]: unknown }, supabase }
  } catch (_) {
    return { error: new Response(
      JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } }
    )}
  }
}

const RATE_LIMIT_EXPORT = 3

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const result = await requireUser(req)
  if ('error' in result) return result.error

  const { user, supabase } = result

  // Rate limit: 3/min — heavy DB read
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: rlData, error: rlError } = await adminClient.rpc('check_rate_limit', {
    p_user_id: user.id,
    p_function: 'export-user-data',
    p_limit: RATE_LIMIT_EXPORT,
  })
  if (!rlError) {
    const row = Array.isArray(rlData) ? (rlData[0] as { allowed?: boolean; reset_at?: string } | undefined) : (rlData as { allowed?: boolean; reset_at?: string } | null)
    if (row && row.allowed === false) {
      return new Response(
        JSON.stringify({ error: true, code: 'RATE_LIMITED', message: `Too many requests. Limit: ${RATE_LIMIT_EXPORT}/minute. Try again in a moment.`, retryable: true, reset_at: row.reset_at }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders(req) } },
      )
    }
  }

  try {
    const [userRes, convsRes, absRes, escRes] = await Promise.all([
      supabase.from('users').select('*').single(),
      supabase.from('conversations').select('*'),
      supabase.from('abs_diagnoses').select('*'),
      supabase.from('escalations').select('*'),
    ])

    // Fetch all messages for all conversations the user owns
    const convIds: string[] = (convsRes.data ?? []).map((c: { id: string }) => c.id)
    let messages: unknown[] = []
    if (convIds.length > 0) {
      const { data: msgs } = await supabase.from('messages').select('*').in('conversation_id', convIds)
      messages = msgs ?? []
    }

    return new Response(JSON.stringify({
      exported_at: new Date().toISOString(),
      user: userRes.data ?? null,
      conversations: convsRes.data ?? [],
      messages,
      abs_diagnoses: absRes.data ?? [],
      escalations: escRes.data ?? [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
    })
  } catch (err: unknown) {
    console.error('[export-user-data] error:', err)
    return new Response(JSON.stringify({ ok: false, error: 'An internal error occurred. Please try again later.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
    })
  }
})
