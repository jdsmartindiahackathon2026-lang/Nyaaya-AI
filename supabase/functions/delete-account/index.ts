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
    'Access-Control-Allow-Headers': 'authorization, content-type',
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
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
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

  const { user } = result
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Delete profile row first (child rows cascade via existing FKs)
    await adminClient.from('users').delete().eq('auth_id', user.id)

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id as string)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ ok: true }), {
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
