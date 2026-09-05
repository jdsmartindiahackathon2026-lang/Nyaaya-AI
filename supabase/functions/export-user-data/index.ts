import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000')
  .split(',').map((s: string) => s.trim()).filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const result = await requireUser(req)
  if ('error' in result) return result.error

  const { supabase } = result

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
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
    })
  }
})
