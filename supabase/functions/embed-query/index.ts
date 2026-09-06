// Cold-start behaviour: first request downloads the quantized bge-small-en-v1.5 model (~30MB)
// and may take 5–15 s. Subsequent invocations on the same isolate reuse the cached pipeline
// and typically respond in ~150 ms.
//
// NOTE: shared utilities (cors, auth, rate-limit) are inlined here because the Supabase
// MCP deploy tool bundles a single-file payload; the `../_shared/` imports in sibling
// functions work via the CLI's multi-file context but not via the API bundler.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { pipeline, env } from 'https://esm.sh/@huggingface/transformers@3.3.3'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

env.allowLocalModels = false
env.useBrowserCache = false

// --------------- cors ---------------
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

// --------------- auth ---------------
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const unauthorized = (req: Request) => new Response(
  JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }),
  { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } },
)

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: unauthorized(req) }
  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  if (token === SUPABASE_SERVICE_ROLE_KEY) return { user: { id: 'system', is_service_role: true }, supabase }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return { error: unauthorized(req) }
    return { user: user as { id: string; is_service_role?: boolean; [key: string]: unknown }, supabase }
  } catch (_) {
    return { error: unauthorized(req) }
  }
}

// --------------- rate limit ---------------
// 60 requests per user per minute — matches 'translate' bucket (high-frequency internal call)
const RATE_LIMIT = 60

async function requireRateLimit(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  user: { id: string; is_service_role?: boolean },
): Promise<Response | null> {
  if (user.is_service_role) return null
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: user.id,
    p_function: 'embed-query',
    p_limit: RATE_LIMIT,
  })
  if (error) { console.error('[rate-limit] RPC failed:', error); return null }
  const row = Array.isArray(data)
    ? (data[0] as { allowed?: boolean; reset_at?: string } | undefined)
    : (data as { allowed?: boolean; reset_at?: string } | null)
  if (row && row.allowed === false) {
    return new Response(
      JSON.stringify({ error: true, code: 'RATE_LIMITED', message: `Too many requests. Limit: ${RATE_LIMIT}/minute. Try again in a moment.`, retryable: true, reset_at: row.reset_at }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders(req) } },
    )
  }
  return null
}

// --------------- model ---------------
let extractorPromise: Promise<any> | null = null
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true, device: 'wasm' })
  }
  return extractorPromise
}

// --------------- handler ---------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error
  const { user, supabase } = authResult

  const rateLimited = await requireRateLimit(req, supabase, user as { id: string; is_service_role?: boolean })
  if (rateLimited) return rateLimited

  try {
    const body = await req.json().catch(() => null)
    const text: string | undefined = body?.text

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return new Response(
        JSON.stringify({ error: true, code: 'INVALID_INPUT' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } },
      )
    }

    const prefixed = `query: ${text}`
    const ex = await getExtractor()
    const out = await ex(prefixed, { pooling: 'mean', normalize: true })
    const embedding = Array.from(out.data as Float32Array)

    return new Response(
      JSON.stringify({ embedding }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[embed-query] error:', err)
    return new Response(
      JSON.stringify({ error: true, code: 'EMBED_FAILED', message: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } },
    )
  }
})
