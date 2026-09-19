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

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const cfConnectingIp = req.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp.trim()
  return '127.0.0.1'
}

// Check anti-abuse guard (device quota pooling and IP rate burst limits)
// Fails open on RPC error so legitimate users are never blocked by infra anomalies.
export async function requireAntiAbuseGuard(
  req: Request,
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  user: RateLimitUser,
  deviceId: string | null | undefined,
  functionName: FunctionName,
): Promise<Response | null> {
  if (user.is_service_role) return null

  const clientIp = getClientIp(req)

  const { data, error } = await supabase.rpc('check_anti_abuse_guard', {
    p_user_id: user.id,
    p_device_id: deviceId || null,
    p_client_ip: clientIp,
    p_function: functionName,
  })

  if (error) {
    console.error(`[anti-abuse] RPC failed for ${functionName}:`, error)
    return null
  }

  const row = Array.isArray(data)
    ? (data[0] as { allowed?: boolean; reason?: string } | undefined)
    : (data as { allowed?: boolean; reason?: string } | null)

  if (row && row.allowed === false) {
    let msg = 'Request restricted due to anti-abuse policy.'
    if (row.reason === 'device_monthly_quota_exceeded') {
      msg = 'The monthly free query allowance for this device has been reached across accounts. Upgrade to a paid plan for unlimited access.'
    } else if (row.reason === 'device_account_limit_exceeded') {
      msg = 'Too many free accounts have been used from this device. Please sign in with your primary account or upgrade to continue.'
    } else if (row.reason === 'ip_rate_limit_exceeded') {
      msg = 'High query volume detected from your network. Please wait a few minutes before trying again.'
    }

    return new Response(
      JSON.stringify({
        error: true,
        code: 'ABUSE_GUARD_BLOCKED',
        reason: row.reason,
        message: msg,
        retryable: false,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(req),
        },
      },
    )
  }

  return null
}

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
