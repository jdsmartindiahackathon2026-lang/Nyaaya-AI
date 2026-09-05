import { corsHeaders } from './cors.ts'

// Per-function per-user-per-minute caps. Service-role callers bypass.
// Tuned for hackathon demo: expensive Perplexity endpoints get the tightest budget.
export type FunctionName =
  | 'ask-query'
  | 'classify-formulation'
  | 'tkdl-search'
  | 'mini-guide'
  | 'translate'
  | 'escalate'
  | 'embed-query'
  | 'delete-account'
  | 'export-user-data'
  | 'title-conversation'

export const RATE_LIMITS: Record<FunctionName, number> = {
  'ask-query': 20,
  'classify-formulation': 20,
  'tkdl-search': 20,
  'mini-guide': 30,
  'translate': 60,
  'escalate': 5,
  'embed-query': 60,
  'delete-account': 3,
  'export-user-data': 3,
  'title-conversation': 30,
}

interface RateLimitUser { id: string; is_service_role?: boolean }

// Returns a 429 Response when the cap is hit; null when the request may proceed.
// Fails open on RPC error — a broken rate-limiter should never lock real users out.
export async function requireRateLimit(
  req: Request,
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  user: RateLimitUser,
  functionName: FunctionName,
): Promise<Response | null> {
  if (user.is_service_role) return null

  const limit = RATE_LIMITS[functionName]

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: user.id,
    p_function: functionName,
    p_limit: limit,
  })

  if (error) {
    console.error(`[rate-limit] RPC failed for ${functionName}:`, error)
    return null
  }

  const row = Array.isArray(data) ? (data[0] as { allowed?: boolean; reset_at?: string } | undefined) : (data as { allowed?: boolean; reset_at?: string } | null)
  if (row && row.allowed === false) {
    return new Response(
      JSON.stringify({
        error: true,
        code: 'RATE_LIMITED',
        message: `Too many requests. Limit: ${limit}/minute for ${functionName}. Try again in a moment.`,
        retryable: true,
        reset_at: row.reset_at,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...corsHeaders(req),
        },
      },
    )
  }

  return null
}
