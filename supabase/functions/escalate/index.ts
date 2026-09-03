import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireUser } from '../_shared/auth.ts'
import { requireRateLimit } from '../_shared/rate_limit.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)

  const authResult = await requireUser(req)
  if ('error' in authResult) return authResult.error
  const { user, supabase } = authResult

  const rateLimited = await requireRateLimit(req, supabase, user, 'escalate')
  if (rateLimited) return rateLimited

  try {
    const { querySummary, contact, urgency } = await req.json()

    if (!querySummary || !contact || !urgency) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'All fields are required.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    const { data, error } = await supabase.from('escalations').insert({
      user_id: user.id,
      query_summary: querySummary,
      contact,
      urgency,
      status: 'pending'
    }).select('id').single()

    if (error) {
      console.error(error)
      return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'Could not save your request. Please try again.', retryable: true }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Your query has been logged. A human IP facilitator will be in touch within 48 hours.',
      escalationId: data.id
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    })
  }
})
