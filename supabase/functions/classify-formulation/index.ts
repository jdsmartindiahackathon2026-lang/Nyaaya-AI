import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import approvedSources from '../_shared/approved_sources.json' assert { type: 'json' }

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!

const CLASSIFICATIONS = {
  classical: {
    label: 'Classical Formulation',
    ipPosture: 'Patent protection barred under Section 3(p) of the Patents Act 1970. Formulation is documented in TKDL and/or First Schedule texts. Trade secret and trademark protection remain available for proprietary processing methods and branding.',
    regulatoryRequirements: 'Manufacturing licence under Drugs & Cosmetics Act Schedule E(1). Must conform to Ayurvedic Pharmacopoeia of India standards. No clinical trial required for classical indications.',
    nextStep: 'Run a TKDL Prior Art Check to confirm documentation status. Consider trademark registration for brand identity. Review Schedule E(1) manufacturing requirements.'
  },
  proprietary: {
    label: 'Proprietary Ayurvedic Medicine',
    ipPosture: 'Patent potential exists if formulation is novel, non-obvious and has inventive step beyond classical texts. Section 3(p) bar does not apply to genuinely innovative combinations. Trademark registration strongly recommended.',
    regulatoryRequirements: 'Registration as Proprietary Ayurvedic Medicine under Drugs & Cosmetics Act. Clinical data or literature support required. State licensing authority approval needed.',
    nextStep: 'Conduct patentability search at ipindia.gov.in. File provisional patent application to establish priority date. Simultaneously apply for trademark.'
  },
  newdrug: {
    label: 'New Ayurvedic Drug',
    ipPosture: 'Strong patent potential — novel molecular entity or new therapeutic use. Full IP protection available including product and process patents.',
    regulatoryRequirements: 'New Drug approval from CDSCO under Schedule Y. Clinical trials (Phase I–III) required. Central Drugs Standard Control Organisation clearance mandatory before any commercialisation.',
    nextStep: 'File patent application immediately to protect priority. Engage CDSCO for pre-submission meeting. Prepare clinical development plan.'
  },
  phytopharma: {
    label: 'Phytopharmaceutical Drug',
    ipPosture: 'Process patents available for extraction and standardisation methods. Product patent possible if novel formulation. Trademark registration recommended.',
    regulatoryRequirements: 'Regulated under Drugs & Cosmetics Act as Phytopharmaceutical Drug (2015 rules). Requires standardisation data, safety and efficacy evidence. CDSCO approval pathway applies.',
    nextStep: 'Review Phytopharmaceutical Drug rules (2015). File process patent for extraction method. Prepare standardisation dossier for CDSCO.'
  },
  aahar: {
    label: 'Ayurveda-Aahar / Nutraceutical',
    ipPosture: 'Limited IP protection — trade secret for formulation blend, trademark for brand. Patent unlikely due to prior art in traditional use.',
    regulatoryRequirements: 'FSSAI Ayurveda-Aahar regulations apply. Product registration with FSSAI required. Label claims restricted to those approved under FSSAI framework.',
    nextStep: 'Register with FSSAI under Ayurveda-Aahar category. Trademark the brand. Review FSSAI permitted claim list before marketing.'
  },
  cosmetic: {
    label: 'Ayurvedic Cosmetic',
    ipPosture: 'Trademark and trade dress protection primary IP tools. Process patent possible for novel manufacturing. Design registration for packaging.',
    regulatoryRequirements: 'Regulated as cosmetic under Drugs & Cosmetics Act. Import/manufacture licence required. BIS standards compliance for certain categories.',
    nextStep: 'Obtain cosmetic manufacturing licence. Register trademark and trade dress. Review BIS standards applicable to your category.'
  }
}

function classifyFromAnswers(answers: Record<string, string>): keyof typeof CLASSIFICATIONS {
  const { firstSchedule, innovationType, marketStatus } = answers
  if (firstSchedule === 'yes') return 'classical'
  if (firstSchedule === 'no') {
    if (innovationType === 'new_drug') return 'newdrug'
    if (innovationType === 'phyto') return 'phytopharma'
    if (innovationType === 'aahar') return 'aahar'
    if (innovationType === 'cosmetic') return 'cosmetic'
    return 'proprietary'
  }
  return 'proprietary'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { step, answers, language } = await req.json()

    if (step < 3) {
      return new Response(JSON.stringify({ complete: false, nextStep: step + 1 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const classificationKey = classifyFromAnswers(answers)
    const result = CLASSIFICATIONS[classificationKey]

    // Fetch supporting citations from Perplexity
    let citations: object[] = []
    try {
      const pRes = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'system', content: 'You are a legal citation assistant. Return only the most relevant statute sections and official source URLs for the classification given. Be concise.' },
            { role: 'user', content: `Find key statute citations for: ${result.label} under Indian IP and drug regulatory law.` }
          ],
          search_domain_filter: approvedSources.filter_sets.classify_formulation,
          return_citations: true
        })
      })
      if (pRes.ok) {
        const pData = await pRes.json()
        citations = (pData.citations ?? []).map((url: string) => ({
          source: new URL(url).hostname.replace('www.', ''),
          url,
          statute_ref: ''
        }))
      }
    } catch (_) { /* citations optional */ }

    return new Response(JSON.stringify({ ...result, classification: classificationKey, citations, complete: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: true, code: 'DB_ERROR', message: 'An unexpected error occurred.', retryable: true }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
