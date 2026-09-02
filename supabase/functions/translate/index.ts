import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { text, targetLanguage } = await req.json()

    if (!text || !targetLanguage) {
      return new Response(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'Missing text or targetLanguage.', retryable: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (targetLanguage === 'en') {
      return new Response(JSON.stringify({ translatedText: text, sourceLanguage: 'en', targetLanguage: 'en' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'en', target: targetLanguage, format: 'text' })
      }
    )

    if (!res.ok) throw new Error(`Google Translate error: ${res.status}`)

    const data = await res.json()
    const translatedText: string = data.data.translations[0].translatedText

    return new Response(JSON.stringify({ translatedText, sourceLanguage: 'en', targetLanguage }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error('Translation failed, returning original:', err)
    const body = await req.clone().json().catch(() => ({ text: '' }))
    return new Response(JSON.stringify({ translatedText: body.text, sourceLanguage: 'en', targetLanguage: 'en' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
