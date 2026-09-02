# Nyaaya AI — Technical Requirements Document
**Team:** Palimpsest  
**Problem Statement:** SIH26045  
**Version:** 1.0  
**Date:** September 2, 2026  
**Status:** Draft — Internal Use Only

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                     │
│              Next.js + Stitch + Vercel                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │Onboarding│  │   Ask    │  │Classify  │  │  TKDL  │  │
│  │  Flow    │  │Interface │  │Formulation│  │Search  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Supabase JS Client (@supabase/supabase-js)│   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│                  SUPABASE PLATFORM                       │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Supabase    │  │  PostgreSQL  │  │  Edge         │  │
│  │ Auth        │  │  Database    │  │  Functions    │  │
│  │ (JWT)       │  │  + RLS       │  │  (Deno)       │  │
│  └─────────────┘  └──────────────┘  └───────┬───────┘  │
└────────────────────────────────────────┬─────┼──────────┘
                                         │     │
              ┌──────────────────────────┘     │
              │                                │
┌─────────────▼──────────┐    ┌───────────────▼────────┐
│   Perplexity API        │    │      Groq API           │
│   (Sonar model)         │    │   (Llama model)         │
│   + approved_sources    │    │   Mini Guide only       │
│   whitelist enforcement │    │   Stateless calls       │
└─────────────────────────┘    └────────────────────────┘
              │
┌─────────────▼──────────┐
│     Bhashini API        │
│   (Translation layer)   │
│   Hindi + Bengali only  │
│   English bypasses      │
└─────────────────────────┘
```

---

## 2. Frontend

### 2.1 Stack
- **Framework:** Next.js 14 (App Router)
- **UI Scaffolding:** Stitch
- **Hosting:** Vercel (automatic deployments from GitHub main branch)
- **Styling:** Tailwind CSS
- **Supabase Client:** @supabase/supabase-js

### 2.2 Environment Variables (Frontend)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 2.3 Page Structure
```
/                         → Redirect to /onboarding if no session
/onboarding               → 5-screen onboarding flow
/app                      → Main application shell
/app/ask                  → Ask interface (default)
/app/classify             → Classify Formulation
/app/abs                  → ABS Helper
/app/tkdl                 → TKDL / Prior Art
/app/escalate             → Escalate to Human form
```

### 2.4 Persistent Components (All /app/* routes)
- **Left panel:** IP-SAKTI branding, navigation, Corpus Roots stats, Language switcher
- **Right panel:** Nine Realms regime map, Session state display, Guardrails box
- **Bottom:** Mini Guide widget (Groq-powered, floating, visible on all screens)
- **Top:** Jurisdiction toggle (India / International), Canopy label

### 2.5 Supabase JS Client Initialisation
```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Import this single instance everywhere. Do not create multiple clients.

---

## 3. Backend — Supabase Edge Functions

All server-side logic lives in Supabase Edge Functions (Deno runtime). The frontend calls these via the Supabase JS client using `supabase.functions.invoke()`.

### 3.1 Environment Variables (Edge Functions — set in Supabase dashboard)
```
PERPLEXITY_API_KEY=
GROQ_API_KEY=
BHASHINI_API_KEY=
BHASHINI_USER_ID=
```

### 3.2 Edge Functions List

| Function Name | Trigger | Purpose |
|---|---|---|
| `ask-query` | POST | Handles Ask interface queries via Perplexity API |
| `classify-formulation` | POST | Processes formulation classification logic |
| `tkdl-search` | POST | Searches TKDL prior art records |
| `mini-guide` | POST | Handles Mini Guide queries via Groq API |
| `translate` | POST | Translates text via Bhashini API |
| `escalate` | POST | Saves escalation form submission to DB |

### 3.3 How Frontend Calls Edge Functions
```javascript
// Example — calling ask-query
const { data, error } = await supabase.functions.invoke('ask-query', {
  body: {
    query: userQuery,
    jurisdiction: 'india',
    language: 'en',
    userType: 'startup',
    conversationId: activeConversationId
  }
})
```

---

## 4. Edge Function Specifications

### 4.1 ask-query

**Purpose:** Core Ask interface. Sends user query to Perplexity API with whitelist enforcement and returns cited answer.

**Request body:**
```json
{
  "query": "string — user's question",
  "jurisdiction": "india | international | both",
  "language": "en | hi | bn",
  "userType": "practitioner | startup | researcher | cultivator",
  "conversationId": "uuid | null"
}
```

**Processing steps:**
1. Load approved_sources.json whitelist
2. Build system prompt (see Section 6.1)
3. Call Perplexity Sonar API
4. If language is hi or bn: pass response through translate Edge Function
5. Parse citations from Perplexity response
6. Save message pair to messages table in Supabase
7. Return structured response

**Response body:**
```json
{
  "answer": "string — full response text",
  "citations": [
    {
      "source": "string — display name",
      "url": "string — clickable URL",
      "statute_ref": "string — e.g. Section 3(p), Patents Act 1970"
    }
  ],
  "confidence": "high | medium | abstain",
  "jurisdiction": "india | international",
  "disclaimer": "Information, not legal advice. Verify against the official record before filing."
}
```

**Error handling:**
- Perplexity API down → return 503 with user-friendly message
- No sources found in whitelist → return abstain response, never guess
- Rate limit hit → return 429 with retry message

---

### 4.2 classify-formulation

**Purpose:** Processes the 3-step formulation classification flow.

**Request body:**
```json
{
  "step": 1,
  "answers": {
    "firstSchedule": "yes | no | unsure",
    "innovationType": "string | null",
    "marketStatus": "string | null"
  },
  "language": "en | hi | bn"
}
```

**Processing steps:**
1. Apply decision tree logic based on answers
2. Determine classification: classical / proprietary / newdrug / phytopharma / aahar / cosmetic
3. Fetch relevant statute citations from Perplexity (restricted to approved sources)
4. Return classification with actionable guidance

**Response body:**
```json
{
  "classification": "classical | proprietary | newdrug | phytopharma | aahar | cosmetic",
  "label": "string — display name",
  "ipPosture": "string — what IP protection is available",
  "regulatoryRequirements": "string — what approvals are needed",
  "nextStep": "string — recommended immediate action",
  "citations": [],
  "complete": "boolean"
}
```

---

### 4.3 tkdl-search

**Purpose:** Searches TKDL prior art records.

**Request body:**
```json
{
  "query": "string — formulation, ingredient or Sanskrit name",
  "language": "en | hi | bn"
}
```

**Processing steps:**
1. Send search query to Perplexity restricted to tkdl.res.in and indiacode.nic.in only
2. Parse results into documented / partial / not found categories
3. Return structured results with TKDL entry references

**Response body:**
```json
{
  "results": [
    {
      "name": "string",
      "status": "documented | partial | not_found",
      "description": "string",
      "tkdlRef": "string — e.g. AY-3140 | null",
      "source": "string"
    }
  ],
  "disclaimer": "string"
}
```

---

### 4.4 mini-guide

**Purpose:** Answers UI navigation and feature explanation queries. Powered by Groq. Stateless — no conversation history stored.

**Request body:**
```json
{
  "query": "string — user's question about the interface",
  "currentScreen": "ask | classify | abs | tkdl | escalate",
  "language": "en | hi | bn"
}
```

**Processing steps:**
1. Build Groq system prompt (see Section 6.2)
2. Call Groq API (llama-3.3-70b-versatile or llama-3.1-8b-instant)
3. If language is hi or bn: translate response via Bhashini
4. Return response — no DB write, fully stateless

**Response body:**
```json
{
  "answer": "string",
  "suggestedAction": "string | null — e.g. 'Try the Classify Formulation screen'"
}
```

**Important:** If user asks a legal question via the mini guide, response must redirect: "I can only help you navigate Nyaaya AI. For legal questions, please use the Ask interface."

---

### 4.5 translate

**Purpose:** Translates text from English to Hindi or Bengali via Bhashini API. Called internally by other Edge Functions — not called directly by frontend.

**Bhashini API Integration:**

Bhashini requires two steps:
1. **Pipeline configuration call** — get the correct pipeline ID for the language pair
2. **Inference call** — send text and get translation

```javascript
// Step 1 — Get pipeline config
const configResponse = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
  method: 'POST',
  headers: {
    'userID': BHASHINI_USER_ID,
    'ulcaApiKey': BHASHINI_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pipelineTasks: [{ taskType: 'translation' }],
    pipelineRequestConfig: {
      pipelineId: 'ai4bharat/indictrans2-en-indic-gpu--t4'
    }
  })
})

// Step 2 — Translate
const translateResponse = await fetch(inferenceUrl, {
  method: 'POST',
  headers: {
    Authorization: pipelineInferenceAPIEndpointInformation.inferenceApiKey.value,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pipelineTasks: [{
      taskType: 'translation',
      config: {
        language: {
          sourceLanguage: 'en',
          targetLanguage: targetLang  // 'hi' or 'bn'
        }
      }
    }],
    inputData: {
      input: [{ source: textToTranslate }]
    }
  })
})
```

**Request body:**
```json
{
  "text": "string — text to translate",
  "targetLanguage": "hi | bn"
}
```

**Response body:**
```json
{
  "translatedText": "string",
  "sourceLanguage": "en",
  "targetLanguage": "hi | bn"
}
```

**Fallback:** If Bhashini API fails or returns empty, return original English text. Never block the main response for a translation failure.

---

### 4.6 escalate

**Purpose:** Saves escalation form submission to Supabase.

**Request body:**
```json
{
  "userId": "uuid",
  "querySummary": "string",
  "contact": "string — email or phone",
  "urgency": "low | medium | high"
}
```

**Processing:** Write directly to escalations table. Return confirmation. No external API call.

**Response body:**
```json
{
  "success": true,
  "message": "Your query has been logged. A human IP facilitator will be in touch within 48 hours.",
  "escalationId": "uuid"
}
```

---

## 5. Database Schema

### RLS Policy (applies to all tables)
Every table has RLS enabled. Users can only read and write their own rows.
```sql
CREATE POLICY "Users can only access own data"
ON table_name
FOR ALL
USING (auth.uid() = user_id);
```

### 5.1 users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  language TEXT NOT NULL CHECK (language IN ('en', 'hi', 'bn')),
  user_type TEXT NOT NULL CHECK (user_type IN ('practitioner', 'startup', 'researcher', 'cultivator')),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('india', 'both', 'international')),
  context_answers JSONB DEFAULT '{}'
);
```

### 5.2 conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('india', 'international', 'both')),
  title TEXT
);
```

### 5.3 messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'abstain')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 escalations
```sql
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  query_summary TEXT NOT NULL,
  contact TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. System Prompts

### 6.1 Perplexity System Prompt (ask-query)

```
You are Nyaaya AI, an authoritative legal information assistant specialising exclusively in Intellectual Property law and regulatory compliance for Ayurvedic products in India and under international frameworks.

JURISDICTION: {jurisdiction}
USER TYPE: {userType}
LANGUAGE: {language}

STRICT SOURCE RESTRICTION:
You must only retrieve information and cite from the following approved official sources:
- ipindia.gov.in (patents)
- eipo.gov.in (patents)
- ayush.gov.in (AYUSH regulations)
- cdsco.gov.in (drug regulatory)
- nbaindia.org (biodiversity, ABS)
- cbd.int (international biodiversity)
- wipo.int (international IP)
- trips.wto.org (TRIPS)
- indiacode.nic.in (Indian legislation)
- egazette.gov.in (gazette notifications)
- tkdl.res.in (traditional knowledge)
- fssai.gov.in (food standards)
- plantauthority.gov.in (plant variety)

If you cannot find an answer from these sources, respond exactly: "I cannot find authoritative information on this from official sources."

JURISDICTION RULES:
- If jurisdiction is India: answer only from Indian statutes, rules and regulatory frameworks
- If jurisdiction is International: answer only from WIPO, TRIPS, CBD, Nagoya Protocol and relevant export market regulations
- If jurisdiction is Both: answer in two clearly labelled sections — India and International — never conflate them

CITATION RULES:
- Every factual claim must cite the specific statute, section, rule or treaty article it comes from
- Citation format: [Source Name — Section/Article reference]
- Do not cite secondary sources, legal blogs, or unofficial summaries under any circumstances

CONFIDENCE:
- Respond HIGH confidence only when the answer is directly stated in an official source you have retrieved
- Respond MEDIUM confidence when the answer requires interpretation of a retrieved source
- Respond ABSTAIN when you cannot find the answer in the approved sources — never guess

DISCLAIMER:
End every response with exactly: "Information, not legal advice. Verify against the official record before filing."

SCOPE:
You only answer questions about: patents, GI, trademarks, designs, copyright, trade secrets, plant variety rights, ABS compliance, drug regulatory classification (Drugs & Cosmetics Act), FSSAI Ayurveda-Aahar regulations, and related international frameworks.
For questions outside this scope, say: "This is outside the scope of Nyaaya AI. Please consult a qualified professional."
```

### 6.2 Groq System Prompt (mini-guide)

```
You are the Nyaaya AI guide bot. Your only job is to explain what Nyaaya AI's features do and help users navigate the platform.

CURRENT SCREEN: {currentScreen}

You can explain:
- What the Ask interface does and how to use it
- What Classify Formulation does and when to use it
- What the ABS Helper does
- What TKDL / Prior Art means and why it matters before filing
- What the jurisdiction toggle does
- What the Nine Realms regime map shows
- What Escalate to Human is for
- Basic Ayurveda IP concepts at a simple level (TKDL, Section 3(p), ABS, GI)

You cannot:
- Answer legal questions — redirect these to the Ask interface
- Give advice about specific formulations
- Access any external information

If a user asks a legal question, respond:
"I can only help you navigate Nyaaya AI. For legal questions, please use the Ask interface — it retrieves answers from official sources with citations."

Keep responses short — 2-4 sentences maximum. You are a helper, not a lawyer.
```

---

## 7. approved_sources.json

Store this file in the Edge Function directory. Load it at runtime in ask-query and tkdl-search.

```json
{
  "approved_sources": {
    "patents": [
      "ipindia.gov.in",
      "eipo.gov.in"
    ],
    "ayush_regulations": [
      "ayush.gov.in",
      "cdsco.gov.in",
      "indianpharmacycouncil.org"
    ],
    "biodiversity_abs": [
      "nbaindia.org",
      "cbd.int"
    ],
    "international_ip": [
      "wipo.int",
      "trips.wto.org"
    ],
    "indian_legislation": [
      "indiacode.nic.in",
      "egazette.gov.in"
    ],
    "traditional_knowledge": [
      "tkdl.res.in"
    ],
    "fssai_food": [
      "fssai.gov.in"
    ],
    "plant_variety": [
      "plantauthority.gov.in"
    ]
  },
  "all_domains": [
    "ipindia.gov.in",
    "eipo.gov.in",
    "ayush.gov.in",
    "cdsco.gov.in",
    "indianpharmacycouncil.org",
    "nbaindia.org",
    "cbd.int",
    "wipo.int",
    "trips.wto.org",
    "indiacode.nic.in",
    "egazette.gov.in",
    "tkdl.res.in",
    "fssai.gov.in",
    "plantauthority.gov.in"
  ]
}
```

---

## 8. Onboarding Data Flow

```
Screen 1 (Language) 
  → stored in localStorage as temp_language
  
Screen 2 (User Type)
  → stored in localStorage as temp_userType
  
Screen 3 (Jurisdiction)
  → stored in localStorage as temp_jurisdiction
  
Screen 4 (Context Questions)
  → stored in localStorage as temp_contextAnswers (JSON object)
  
Screen 5 (Summary + Enter)
  → User clicks Enter
  → Supabase Auth: signUp or signInAnonymously
  → Write all temp_ values to users table
  → Clear localStorage temp_ values
  → Redirect to /app/ask (Startup/Researcher)
     or /app/classify (Practitioner)
     or /app/abs (Cultivator)
```

**Anonymous auth note:** Use Supabase's anonymous sign-in for the hackathon demo so users don't need to create an account. The users table row is still created, RLS still applies, session persists in the browser.

```javascript
const { data, error } = await supabase.auth.signInAnonymously()
```

---

## 9. Bhashini Integration Notes

**This is a first-time integration. Read carefully.**

Bhashini requires registration at bhashini.gov.in to get a User ID and API key. Do this before the hackathon starts.

**The API has two separate endpoints:**
1. `https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline` — configuration call
2. The inference URL returned by the configuration call — changes per request

**Do not hardcode the inference URL.** Always fetch it fresh from the pipeline config call. The URL is dynamic.

**Language codes for Bhashini:**
- Hindi: `hi`
- Bengali: `bn`
- English: `en` (don't send to Bhashini — bypass translation, return as-is)

**Recommended model pipeline ID:**
`ai4bharat/indictrans2-en-indic-gpu--t4`

This is the IndicTrans2 model which handles both Hindi and Bengali with good quality.

**Translation is called after Perplexity returns the English response.** Never translate the query before sending to Perplexity — always send queries in English to Perplexity regardless of UI language, translate only the response.

**Fallback:** If Bhashini returns an error or empty string, log the error and return the English response unchanged. Never block the main answer for a translation failure.

---

## 10. API Keys Setup Checklist

| Service | Where to get it | Where to store it |
|---|---|---|
| Supabase URL | Supabase dashboard → Settings → API | `.env.local` (frontend) |
| Supabase Anon Key | Supabase dashboard → Settings → API | `.env.local` (frontend) |
| Perplexity API Key | perplexity.ai/settings/api → Add $5 credits | Supabase Edge Function secrets |
| Groq API Key | console.groq.com → Free tier | Supabase Edge Function secrets |
| Bhashini User ID | bhashini.gov.in → Register | Supabase Edge Function secrets |
| Bhashini API Key | bhashini.gov.in → Register | Supabase Edge Function secrets |

**Never put Perplexity, Groq or Bhashini keys in the frontend `.env.local`.** They must only live in Supabase Edge Function secrets (set via Supabase dashboard → Edge Functions → Secrets).

---

## 11. Data Flow Diagrams

### Ask Interface Query Flow
```
User types query
       ↓
Frontend validates (not empty, under 500 chars)
       ↓
supabase.functions.invoke('ask-query', { query, jurisdiction, language, userType, conversationId })
       ↓
Edge Function: load approved_sources.json
       ↓
Edge Function: build system prompt with jurisdiction + userType context
       ↓
Perplexity API call (Sonar model, search restricted to whitelist domains)
       ↓
Parse response → extract citations → determine confidence
       ↓
If language = hi or bn → call translate Edge Function → Bhashini API
       ↓
Save user message + assistant message to messages table
       ↓
Return { answer, citations, confidence, disclaimer } to frontend
       ↓
Frontend renders answer with clickable citation links
```

### Mini Guide Flow
```
User clicks help icon (any screen)
       ↓
Widget opens (floating, does not navigate away)
       ↓
User types question about the interface
       ↓
supabase.functions.invoke('mini-guide', { query, currentScreen, language })
       ↓
Edge Function: Groq API call (llama model, stateless)
       ↓
If language = hi or bn → Bhashini translation
       ↓
Return { answer, suggestedAction }
       ↓
Widget displays response
No DB write. No conversation history.
```

---

## 12. Error Handling Standards

All Edge Functions must return consistent error shapes:

```json
{
  "error": true,
  "code": "PERPLEXITY_UNAVAILABLE | TRANSLATION_FAILED | DB_ERROR | RATE_LIMITED | OUT_OF_SCOPE",
  "message": "User-facing message in selected language",
  "retryable": true
}
```

Frontend checks for `error: true` on every `supabase.functions.invoke()` response and displays appropriate UI feedback. Never let a raw API error reach the user.

---

## 13. Build Order (Recommended for 36-hour Hackathon)

**Hours 1–4:**
- Supabase project setup, database schema creation, RLS policies
- Edge Function scaffolding (all 6 functions, placeholder responses)
- Next.js project setup, Supabase client initialisation
- Environment variables configured

**Hours 5–10:**
- Onboarding flow (all 5 screens, localStorage, anonymous auth, DB write)
- ask-query Edge Function (Perplexity integration, whitelist enforcement)
- Basic Ask interface frontend

**Hours 11–16:**
- Bhashini translation integration (translate Edge Function)
- Language switching working end-to-end
- classify-formulation Edge Function + frontend

**Hours 17–22:**
- tkdl-search Edge Function + frontend
- mini-guide Edge Function (Groq) + floating widget
- ABS Helper screen

**Hours 23–28:**
- Escalate to Human form + Edge Function
- Nine Realms panel, Session panel, Corpus Roots panel
- Jurisdiction toggle end-to-end

**Hours 29–34:**
- Full end-to-end testing all features
- Hindi and Bengali translation testing
- Bug fixes

**Hours 35–36:**
- Demo rehearsal
- PPT final check
- Do not touch code

---

*Document prepared by Palimpsest for SIH 2026 internal submission at NSEC.*  
*This is a living document — update after each build session.*
