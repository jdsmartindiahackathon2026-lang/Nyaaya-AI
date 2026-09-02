# Nyaaya AI — Product Requirements Document
**Team:** Palimpsest  
**Problem Statement:** SIH26045  
**Version:** 1.0  
**Date:** September 2, 2026  
**Status:** Draft — Internal Use Only

---

## 1. Product Overview

### 1.1 What It Is
Nyaaya AI is a multilingual, AI-powered conversational assistant that helps Ayurveda practitioners, AYUSH startups, MSMEs, researchers, and cultivators navigate the complex intersection of Intellectual Property law and Ayurvedic product regulation. It provides accurate, source-backed answers with citations exclusively from verified official government and international body portals.

### 1.2 The Problem It Solves
Ayurvedic IP and regulatory guidance exists across thousands of pages of statutes, rules, treaties, and pharmacopoeial standards. Practitioners, startups, and MSMEs routinely lose IP rights, miss compliance deadlines, or spend lakhs on lawyers for questions that have clear statutory answers — because no accessible, authoritative guidance tool exists for this specific intersection.

### 1.3 What Makes It Different
- First AI assistant built specifically for Ayurveda IP and regulatory guidance — no equivalent exists
- All citations sourced exclusively from a verified whitelist of official government and international body portals — structural hallucination prevention
- Jurisdiction toggle keeps India and international law visibly separate — answers are never conflated
- Formulation classification flow determines the correct IP and regulatory posture before any guidance is given
- TKDL prior art check integrated — prevents teams from filing patents that Section 3(p) would immediately bar
- Covers the 2024 patent rules and 2024 WIPO GRATK Treaty — the most current developments with zero accessible plain-language guidance available anywhere

---

## 2. Team

| Role | Responsibility |
|---|---|
| Frontend (2 people) | Next.js + Stitch UI, all screens, onboarding flow |
| Backend (1 person — Joyjit) | Supabase Edge Functions, API integrations, database |
| Research (1 person) | Knowledge base, approved_sources.json, domain research |
| PPT (1 person) | Presentation design, slide content |
| Public Speaking (1 person) | Demo script, judge Q&A preparation |

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js + Stitch | Web application, UI scaffolding |
| Hosting | Vercel | Frontend deployment |
| Backend | Supabase Edge Functions (Deno) | All server-side logic |
| Database | Supabase PostgreSQL | User sessions, conversation history, onboarding data |
| Auth | Supabase Auth | User authentication |
| Data Privacy | Row Level Security (RLS) | Per-user data isolation |
| Primary AI | Perplexity API (Sonar model) | Live citation retrieval from official sources |
| Hallucination Guard | approved_sources.json whitelist | Restricts Perplexity to verified official domains only |
| Mini Guide AI | Groq API (Llama model) | UI guide bot — explains screens and features |
| Translation | Bhashini API | Hindi and Bengali multilingual delivery |

---

## 4. User Types

The product serves four distinct user types, each routed to a different default experience post-onboarding:

| User Type | Description | Default Landing Screen |
|---|---|---|
| Practitioner / Vaidya | Practices Ayurveda, wants to protect or commercialise formulations | Classify Formulation |
| Startup / MSME | Has a product, needs IP protection and regulatory compliance guidance | Ask Interface |
| Researcher / Student | Exploring Ayurveda IP law and traditional knowledge frameworks | Ask Interface |
| Cultivator / FPO | Grows or supplies medicinal plants, wants to understand rights | ABS Helper |

---

## 5. Supported Languages

- English
- हिंदी (Hindi)
- বাংলা (Bengali)

Language selection happens at onboarding Screen 1. All AI responses are delivered in the selected language via Bhashini translation layer.

---

## 6. Features

### 6.1 Onboarding Flow (5 Screens)

**Screen 1 — Language Selection**
- User selects preferred language: English, Hindi, Bengali
- Large buttons, native script displayed
- Single tap, no explanation needed
- Estimated time: 3 seconds

**Screen 2 — User Type Selection**
- Four options: Practitioner/Vaidya, Startup/MSME, Researcher/Student, Cultivator/FPO
- Each option has descriptor text explaining who it is for
- Single select
- Estimated time: 10 seconds

**Screen 3 — Jurisdiction Preference**
- Three options: India only, India + International, Primarily International
- Sets default jurisdiction toggle for the entire session
- Estimated time: 5 seconds

**Screen 4 — Context Questions (branched by user type)**

*Practitioner/Vaidya:*
- What best describes your formulation? → Classical / Own innovation / Both
- Are you currently selling? → Yes commercially / Personal practice only / Planning to start

*Startup/MSME:*
- What stage are you at? → Formulation stage / Product ready / Already in market
- Primary concern? → Patent / GI or trademark / Drug regulatory / ABS compliance / All

*Researcher/Student:*
- What are you researching? → Patents & TK / GI & geographical origin / ABS & biodiversity / Drug regulation / General overview

*Cultivator/FPO:*
- What are you primarily growing? → Single herb / Multiple herbs / Wild-collected / Cultivated
- Primary concern? → ABS obligations / GI for regional produce / Export compliance / Biopiracy protection

**Screen 5 — Personalised Summary + Enter**
- Displays a 2-3 sentence personalised summary of the user's session configuration
- Single CTA: "Enter Nyaaya AI"
- Estimated time: 5 seconds

**Total onboarding time: under 60 seconds**

---

### 6.2 Ask Interface (Core Feature)

The primary conversational interface. User types a question in plain language and receives a structured answer with mandatory citations.

**Input:**
- Free text query in selected language
- Jurisdiction context carried from onboarding (switchable via toggle)
- User type context carried from onboarding

**Processing:**
- Query sent to Perplexity API (Sonar model)
- System prompt enforces: jurisdiction separation, approved_sources whitelist, mandatory statute/article citations, confidence indicators, standing legal disclaimer
- Perplexity retrieves from live official sources within the whitelist only

**Output:**
- Structured answer with jurisdiction clearly labelled
- Clickable citations linking to source documents on official portals
- Confidence indicator (High / Medium / Abstain)
- Standing disclaimer: "Information, not legal advice. Verify against the official record before filing."
- If query is outside scope or source not found in whitelist: "I cannot find authoritative information on this from official sources" — no hallucination, clean abstention

**Starter Questions (pre-loaded by user type):**
- Patents: "Can we patent a classical Ashwagandha formulation drawn from Charaka Samhita?"
- GI: "Does this product qualify for a Geographical Indication, and how is that different from a patent?"
- ABS: "We are sourcing a wild-collected herb for export. What Biological Diversity Act clearances apply?"
- International: "How does the WIPO GRATK Treaty change our disclosure duty when filing abroad?"

---

### 6.3 Classify Formulation

Guided 3-step flow that determines which regulatory and IP category a product falls under before any guidance is given.

**Step 1:** Is the formulation and method drawn from a First-Schedule authoritative text? (Yes / No / Not sure — show both branches)

**Step 2 (conditional):** Additional qualifying questions based on Step 1 answer

**Step 3:** Classification result displayed with visual branch indicator

**Six possible classifications:**
1. Classical — faces Section 3(p) patenting bar, defended through TKDL
2. Proprietary — patent potential exists, trademark and trade secret applicable
3. New Drug — requires clinical evidence, CDSCO approval pathway
4. Phytopharmaceutical — specific regulatory pathway under Drugs & Cosmetics Act
5. Aahar / Nutraceutical — FSSAI Ayurveda-Aahar regulations apply
6. Cosmetic — different regulatory regime, limited IP considerations

Each classification output includes: what IP protection is available, what regulatory approvals are required, what the recommended next step is, and citations to the applicable statutes.

---

### 6.4 ABS Helper

Guided compliance checker for Access and Benefit-Sharing obligations under the Biological Diversity Act 2002 (as amended 2023) and the Nagoya Protocol.

**Covers:**
- Whether ABS obligations apply to the user's activity
- What approvals are required from the National Biodiversity Authority
- Disclosure requirements for patent filings internationally
- Export compliance under the 2024 WIPO GRATK Treaty
- Prior Informed Consent requirements

**Output:** Step-by-step compliance checklist with citations to specific sections of the Biological Diversity Act and relevant NBA guidelines.

---

### 6.5 TKDL / Prior Art Check

Search interface that checks whether a formulation is already documented as traditional knowledge before a patent application is filed.

**Input:** Formulation name, ingredient, or Sanskrit name

**Output:**
- DOCUMENTED — formulation found in TKDL corpus with entry reference (e.g., AY-3140)
- PARTIAL MATCH — partial documentation found, specific ratio or processing method not confirmed
- NOT FOUND — no documentation found in corpus (does not guarantee patentability)

**Data source:** TKDL Ayurveda collection + IndiaCode retrieval

**Important disclaimer displayed on screen:** "Records shown are illustrative of TKDL and IndiaCode retrieval. The deployed system queries the official databases directly. A not-found result does not constitute freedom to operate."

---

### 6.6 Escalate to Human

For queries that are genuinely beyond the scope of automated guidance — complex multi-regime questions, pending litigation, novel formulations with unclear classification — the system escalates to a human IP facilitator.

**Flow:**
- User clicks Escalate to Human from any screen
- Brief form: name, contact, query summary, urgency
- Submission logged in Supabase
- Confirmation message displayed

**Note for hackathon demo:** Form submission is functional. Human facilitator backend is a placeholder — confirmation message shows without actual routing.

---

### 6.7 Mini AI Guide (Groq-powered)

A small persistent bot accessible from any screen that explains what each feature does and how to use it. Not a legal tool — purely a UI navigation assistant.

**Triggered by:** Help icon on any screen

**Powered by:** Groq API (Llama model) — fast, free tier, no web search needed

**Example interactions:**
- "What is the ABS Helper for?"
- "How is Classify Formulation different from Ask?"
- "What does the jurisdiction toggle do?"
- "What is TKDL?"

**System prompt:** Restricts responses strictly to explaining Nyaaya AI features and Ayurveda IP concepts at a basic level. Does not answer legal questions — redirects those to the Ask interface.

---

### 6.8 Nine Realms — Regime Map (Right Panel)

Persistent right panel visible on all main screens showing the nine IP regimes with document counts:

| Regime | Document Count |
|---|---|
| Patents | 2,140 |
| Geographical Indications | 410 |
| Trademarks | 860 |
| Designs | 190 |
| Copyright | 150 |
| Trade Secrets | 80 |
| Plant-variety Rights | 120 |
| Access & Benefit-Sharing | 260 |
| Drug-regulatory | 540 |

Clicking any regime filters the Ask interface to that regime's context.

---

### 6.9 Session Panel

Persistent right panel section showing current session state:
- Jurisdiction: India / International
- Language: English / Hindi / Bengali
- Classification: [user type from onboarding or result from Classify Formulation]

---

### 6.10 Corpus Roots Panel

Persistent left panel section showing knowledge base version and document counts:
- Version: v2026.08 — synced Aug 2026
- Statutes & rules: 412
- Treaties: 9
- TKDL records: 38,000+

---

## 7. Approved Sources Whitelist

All Perplexity API calls are restricted to citations from these official domains only. The whitelist is stored as `approved_sources.json` and passed as part of the system prompt on every API call.

```json
{
  "approved_sources": {
    "patents": ["ipindia.gov.in", "eipo.gov.in"],
    "ayush_regulations": ["ayush.gov.in", "cdsco.gov.in", "indianpharmacycouncil.org"],
    "biodiversity_abs": ["nbaindia.org", "cbd.int"],
    "international_ip": ["wipo.int", "trips.wto.org"],
    "indian_legislation": ["indiacode.nic.in", "egazette.gov.in"],
    "traditional_knowledge": ["tkdl.res.in"],
    "fssai_food": ["fssai.gov.in"],
    "drug_regulatory": ["cdsco.gov.in"],
    "plant_variety": ["plantauthority.gov.in"]
  }
}
```

If Perplexity cannot find an answer within these domains, the system returns: "I cannot find authoritative information on this from official sources" — never guesses or cites from unofficial sources.

---

## 8. Database Schema

### users
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| created_at | timestamp | Account creation |
| language | text | en / hi / bn |
| user_type | text | practitioner / startup / researcher / cultivator |
| jurisdiction | text | india / both / international |
| context_answers | jsonb | Onboarding Screen 4 answers |

### conversations
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Foreign key → users |
| created_at | timestamp | Conversation start |
| jurisdiction | text | Active jurisdiction for this conversation |

### messages
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| conversation_id | uuid | Foreign key → conversations |
| role | text | user / assistant |
| content | text | Message content |
| citations | jsonb | Array of citation objects {source, url, statute_ref} |
| confidence | text | high / medium / abstain |
| created_at | timestamp | Message timestamp |

### escalations
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Foreign key → users |
| query_summary | text | User's query |
| contact | text | User contact |
| urgency | text | low / medium / high |
| status | text | pending / resolved |
| created_at | timestamp | Submission timestamp |

---

## 9. Guardrails

All of the following are enforced at the system prompt level on every Perplexity API call:

1. **Source restriction** — only cite from approved_sources.json whitelist
2. **No fabricated authority** — if source not found, abstain rather than guess
3. **Jurisdiction separation** — India and international law never conflated in a single answer
4. **Standing disclaimer** — every response ends with "Information, not legal advice. Verify against the official record before filing."
5. **Confidence indicator** — every response carries High / Medium / Abstain
6. **Scope boundary** — questions outside Ayurveda IP and regulation redirected to appropriate resources

---

## 10. Out of Scope (Hackathon Demo)

The following are explicitly out of scope for the hackathon build:

- Voice interface (mentioned in problem statement as future phase)
- Deep Research mode (Perplexity Pro feature — cost concern)
- Paid subscription management
- Human facilitator backend routing (escalation form functional, routing is placeholder)
- Real-time TKDL database API (demo uses illustrative records — note displayed on screen)
- Full Bhashini voice integration (text translation only for demo)

---

## 11. Success Criteria (Hackathon Demo)

The demo is considered successful if a judge can:

1. Complete onboarding in under 60 seconds
2. Ask a question in plain language and receive a cited, jurisdiction-correct answer
3. Run the Classify Formulation flow and receive a classification with actionable next steps
4. Search TKDL prior art and see documented vs partial match results
5. Switch jurisdiction mid-session and receive a visibly different answer
6. Ask the Mini Guide what any feature does and receive an accurate explanation

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Perplexity API rate limits during demo | Low | $5 prepaid credits, Sonar base model, well within limits |
| Bhashini translation quality | Medium | Test Hindi and Bengali outputs before demo day, fallback to English if poor |
| Judges ask about real TKDL database access | High | Disclaimer on screen, honest answer prepared: "Demo uses illustrative records, production queries TKDL directly" |
| Judges ask about legal liability | High | Standing disclaimer visible on every screen, "information not legal advice" framing prepared |
| Groq rate limits on mini guide | Very Low | Free tier is generous, mini guide queries are small |

---

*Document prepared by Palimpsest for SIH 2026 internal submission at NSEC.*  
*This is a living document — update after each build session.*
