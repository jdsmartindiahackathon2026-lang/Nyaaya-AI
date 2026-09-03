// ABS Compliance Wizard — pure logic module (no React, no DOM, no I/O)

export type Answer = boolean | null

export interface AbsAnswers {
  q1: Answer // Sourcing biological resource from India?
  q2: Answer // Wild-collected or from protected area?
  q3: Answer // Foreign entity, NRI, or exporter?
  q4: Answer // Using associated Traditional Knowledge?
  q5: Answer // Filing patents abroad after Nov 2024?
}

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5'

export interface Question {
  id: QuestionId
  text: string
  explainer: string
  statuteAnchor: string
}

export interface Obligation {
  code: string
  label: string
  statute: string
  link: string
  detail: string
}

export interface AbsResult {
  answers: AbsAnswers
  obligations: Obligation[]
  obligationCount: number
  headline: string
  intro: string
  disclaimer: string
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'Are you sourcing a biological resource from India?',
    explainer:
      'This includes any plant, animal, micro-organism, or derivative obtained from Indian territory. If your raw material or extract originates in India, answer Yes.',
    statuteAnchor: 'BD Act 2002, §3–4',
  },
  {
    id: 'q2',
    text: 'Is the resource wild-collected or from a protected area?',
    explainer:
      'Wild-collected means gathered from forests, wetlands, or any non-cultivated source. Protected areas include national parks, wildlife sanctuaries, and biosphere reserves.',
    statuteAnchor: 'BD Act §7 + ABS Guidelines 2014',
  },
  {
    id: 'q3',
    text: 'Are you a foreign entity, NRI, or exporting the resource?',
    explainer:
      'Foreign companies, non-resident Indians, and any person exporting biological material require NBA approval under §3(2). Domestic Indian companies without export intent do not fall here.',
    statuteAnchor: 'BD Act §3(2)',
  },
  {
    id: 'q4',
    text: 'Are you using associated Traditional Knowledge (TK)?',
    explainer:
      'Traditional Knowledge means documented or oral knowledge of indigenous or local communities about the use of the biological resource. If the resource was wild-collected (Q2), the specific TK rules for wild-harvest communities apply.',
    statuteAnchor: 'BD Act §21 + TK Rules',
  },
  {
    id: 'q5',
    text: 'Are you filing patents abroad after November 2024?',
    explainer:
      'The WIPO GRATK Treaty (adopted May 2024) requires disclosure of the origin of genetic resources and associated TK in all PCT and national patent filings from member states after November 2024.',
    statuteAnchor: 'WIPO GRATK Treaty (adopted May 2024)',
  },
]

/** Returns the next unanswered question id, or 'done' when the flow is complete. */
export function nextQuestion(answers: AbsAnswers): QuestionId | 'done' {
  if (answers.q1 === null) return 'q1'

  if (answers.q1 === false) {
    // q2/q3/q4 are skipped; only q5 remains
    if (answers.q5 === null) return 'q5'
    return 'done'
  }

  // q1 === true
  if (answers.q2 === null) return 'q2'
  if (answers.q3 === null) return 'q3'
  if (answers.q4 === null) return 'q4'
  if (answers.q5 === null) return 'q5'
  return 'done'
}

/** Returns the question ids that were skipped because q1 was answered No. */
export function skippedQuestions(answers: AbsAnswers): QuestionId[] {
  if (answers.q1 === false) return ['q2', 'q3', 'q4']
  return []
}

export function deriveObligations(answers: AbsAnswers): Obligation[] {
  const obligations: Obligation[] = []

  if (answers.q1 === true) {
    obligations.push({
      code: 'NBA_SBB_APPROVAL',
      label: 'File NBA / SBB approval application',
      statute: 'BD Act 2002, §3–4',
      link: 'https://nbaindia.org/content/40/33/1/guidelines.html',
      detail:
        'State Biodiversity Boards handle approvals for domestic commercial use; the NBA handles foreign or export-linked applications — identify the correct authority before filing.',
    })
  }

  if (answers.q2 === true) {
    obligations.push({
      code: 'ABS_CLEARANCE_WILD',
      label: 'Obtain ABS clearance for wild-collected material',
      statute: 'BD Act §7 + ABS Guidelines 2014',
      link: 'https://nbaindia.org/content/40/33/1/guidelines.html',
      detail:
        'Wild collection requires prior informed consent from the relevant Biodiversity Management Committee and a mutually agreed benefit-sharing arrangement before harvest begins.',
    })
  }

  if (answers.q3 === true) {
    obligations.push({
      code: 'NBA_FOREIGN_APPROVAL',
      label: 'File NBA Form I / Form III (foreign entity/export)',
      statute: 'BD Act §3(2)',
      link: 'https://nbaindia.org/forms.html',
      detail:
        'NBA processes Form III applications in approximately 90 days; factor this into your commercial or R&D timeline before committing to launch dates.',
    })
  }

  if (answers.q4 === true) {
    obligations.push({
      code: 'TK_BENEFIT_SHARING',
      label: 'Sign benefit-sharing agreement with source community',
      statute: 'BD Act §21 + TK Rules',
      link: 'https://nbaindia.org/uploaded/pdf/Guidelines_BenefitSharing.pdf',
      detail:
        'Benefit-sharing terms must be negotiated directly with the identified community and submitted to the NBA for approval before any commercial exploitation.',
    })
  }

  if (answers.q5 === true) {
    obligations.push({
      code: 'GRATK_DISCLOSURE',
      label: 'Include GRATK disclosure in foreign patent filings',
      statute: 'WIPO GRATK Treaty 2024',
      link: 'https://www.wipo.int/tk/en/genetic/',
      detail:
        'Patent applications must disclose the country of origin of the genetic resource and, where applicable, the associated traditional knowledge — omission is grounds for revocation.',
    })
  }

  return obligations
}

export function buildResult(answers: AbsAnswers): AbsResult {
  const obligations = deriveObligations(answers)
  const count = obligations.length

  let headline: string
  if (count === 0) {
    headline = 'You are in the clear. No ABS approvals apply to your case.'
  } else if (count <= 2) {
    headline = `You will need ${count} clearance${count === 1 ? '' : 's'} before commercialising.`
  } else {
    headline =
      'Your case triggers substantial ABS obligations — plan for 90+ days of clearance work.'
  }

  let intro: string
  if (answers.q1 === false) {
    intro =
      "Since you're not sourcing from India directly, most of the BD Act does not apply to you — but GRATK still does when filing abroad."
  } else {
    intro =
      'Your sourcing from India brings you within the scope of the Biological Diversity Act, 2002. The obligations below must be cleared before any commercial use or patent filing.'
  }

  const disclaimer =
    'Compliance diagnostic based on the Biological Diversity Act, 2002 and WIPO GRATK 2024. This is not legal advice — have your NBA-registered facilitator confirm before filing.'

  return {
    answers,
    obligations,
    obligationCount: count,
    headline,
    intro,
    disclaimer,
  }
}

/** Returns a pre-filled question string for /app/ask?q= based on the obligation code. */
export function buildAskQuery(obligation: Obligation): string {
  switch (obligation.code) {
    case 'NBA_SBB_APPROVAL':
      return 'What is the NBA or SBB approval process for commercial use of biological resources from India?'
    case 'ABS_CLEARANCE_WILD':
      return 'How do I obtain ABS clearance for wild-collected biological material under the BD Act and 2014 guidelines?'
    case 'NBA_FOREIGN_APPROVAL':
      return 'What does NBA Form III require, and how do I file it as a foreign entity or exporter?'
    case 'TK_BENEFIT_SHARING':
      return 'How do I negotiate and register a benefit-sharing agreement with a source community under BD Act §21?'
    case 'GRATK_DISCLOSURE':
      return 'What GRATK disclosure language is required in a PCT or foreign patent application under the WIPO GRATK Treaty 2024?'
    default:
      return 'What ABS compliance steps apply to my case under the Biological Diversity Act, 2002?'
  }
}

/** Builds a plain-text summary for pre-filling the /app/escalate description field. */
export function buildEscalateSummary(result: AbsResult): string {
  const { answers, obligations } = result

  const yn = (a: Answer): string => {
    if (a === true) return 'yes'
    if (a === false) return 'no'
    return 'skipped'
  }

  const lines: string[] = [
    'ABS diagnostic summary:',
    `- Sourcing from India: ${yn(answers.q1)}`,
    `- Wild-collected: ${yn(answers.q2)}`,
    `- Foreign entity / NRI / exporter: ${yn(answers.q3)}`,
    `- Uses Traditional Knowledge: ${yn(answers.q4)}`,
    `- Filing patents abroad after Nov 2024: ${yn(answers.q5)}`,
    '',
    `Obligations triggered (${obligations.length}):`,
  ]

  if (obligations.length === 0) {
    lines.push('- None')
  } else {
    for (const ob of obligations) {
      lines.push(`- ${ob.label} — ${ob.statute}`)
    }
  }

  return lines.join('\n')
}
