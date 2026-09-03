import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Factory — Response bodies are single-use streams, so a shared constant would fail after the first return.
const unauthorized = (req: Request) => new Response(
  JSON.stringify({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.', retryable: false }),
  { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } }
)

export async function requireUser(req: Request): Promise<{ error: Response } | { user: { id: string; [key: string]: unknown }; supabase: ReturnType<typeof createClient> }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: unauthorized(req) }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Internal service-to-service calls (ask-query → translate) present the service-role key.
  // Treat as a synthetic system user so downstream code has a stable user.id shape.
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { user: { id: 'system', is_service_role: true }, supabase }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return { error: unauthorized(req) }
    }
    return { user: user as { id: string; [key: string]: unknown }, supabase }
  } catch (_) {
    return { error: unauthorized(req) }
  }
}
