import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { userId, querySummary, contact, urgency } = await req.json()

    if (!userId || !querySummary || !contact || !urgency) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'All fields are required.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data, error } = await supabase.from('escalations').insert({
      user_id: userId,
      query_summary: querySummary,
      contact,
      urgency,
      status: 'pending'
    }).select('id').single()

    if (error) {
      console.error(error)
      return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'Could not save your request. Please try again.', retryable: true }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Your query has been logged. A human IP facilitator will be in touch within 48 hours.',
      escalationId: data.id
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
